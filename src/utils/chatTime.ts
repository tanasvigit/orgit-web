/**
 * Chat time utilities – mirrors orgit-mobile utils/time.js.
 * Parses server timestamps (ISO, epoch, "YYYY-MM-DD HH:mm:ss") and formats
 * using Indian Standard Time (IST / Asia-Kolkata) for all devices.
 */

const IST_OFFSET_MINUTES = 330; // UTC+5:30

function toIstDate(d: Date): Date {
  // Convert local time to UTC, then shift to IST
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  const istMs = utcMs + IST_OFFSET_MINUTES * 60000;
  return new Date(istMs);
}

function isSameIstDay(a: Date, b: Date): boolean {
  const ia = toIstDate(a);
  const ib = toIstDate(b);
  return (
    ia.getFullYear() === ib.getFullYear() &&
    ia.getMonth() === ib.getMonth() &&
    ia.getDate() === ib.getDate()
  );
}

/**
 * Robust timestamp parsing (same logic as mobile).
 * Handles:
 * - ISO strings (with or without timezone)
 * - epoch seconds / milliseconds (number or numeric string)
 * - "YYYY-MM-DD HH:mm:ss" (device timestamp – parsed as local time)
 * - "YYYY-MM-DDTHH:mm:ss" (without timezone – parsed as local time)
 *
 * Returns a Date in the device's local timezone.
 */
export function parseTimestamp(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;

    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      const ms = n < 1e12 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss" – treat as UTC from backend, then shift to IST on format
    const m = s.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,6}))?$/
    );
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      const hour = Number(m[4]);
      const minute = Number(m[5]);
      const second = Number(m[6] || '0');
      const microRaw = m[7] || '0';
      // DB often stores microseconds; keep only first 3 digits as milliseconds
      const ms = Number(microRaw.padEnd(3, '0').slice(0, 3));
      // Interpret as UTC instant
      const utcMs = Date.UTC(year, month, day, hour, minute, second, ms);
      const d = new Date(utcMs);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const md = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (md) {
      const d = new Date(Number(md[1]), Number(md[2]) - 1, Number(md[3]));
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function timestampToMs(value: string | number | Date | null | undefined, fallback = 0): number {
  const d = parseTimestamp(value);
  return d ? d.getTime() : fallback;
}

/**
 * Format time in device local (same as mobile formatTimeHHMM).
 * Uses toLocaleTimeString so the device's locale and timezone are used.
 */
export function formatTimeHHMM(value: string | number | Date | null | undefined): string {
  const d = parseTimestamp(value);
  if (!d) return '';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * Short date for list items (e.g. "Jan 15" or "Jan 15, 2024" if different year).
 */
export function formatShortDate(value: string | number | Date | null | undefined): string {
  const d = parseTimestamp(value);
  if (!d) return '';
  const today = new Date();
  return d.toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: toIstDate(d).getFullYear() !== toIstDate(today).getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Chat message time label – device local (mirrors mobile formatTime).
 */
export function formatChatTime(value: string | number | Date | null | undefined): string {
  return formatTimeHHMM(value);
}

/**
 * Chat date label: Today / Yesterday / short date – device local (mirrors mobile formatDate).
 */
export function formatChatDate(value: string | number | Date | null | undefined): string {
  const d = parseTimestamp(value);
  if (!d) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameIstDay(d, today)) {
    return 'Today';
  }
  if (isSameIstDay(d, yesterday)) {
    return 'Yesterday';
  }
  return formatShortDate(value);
}

/**
 * For conversation list: time if today, "Yesterday", weekday, or short date – device local.
 */
export function formatChatListTimestamp(value: string | number | Date | null | undefined): string {
  const d = parseTimestamp(value);
  if (!d) return '';
  const today = new Date();

  // Compute day difference in IST
  const istNow = toIstDate(today).getTime();
  const istMsg = toIstDate(d).getTime();
  const diffDays = Math.floor((istNow - istMsg) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)
    return d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });
  return formatShortDate(value);
}
