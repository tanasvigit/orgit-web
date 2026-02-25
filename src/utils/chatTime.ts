/**
 * Chat time utilities – mirrors orgit-mobile utils/time.js.
 * Parses server timestamps (ISO, epoch, "YYYY-MM-DD HH:mm:ss") and formats
 * using the device's local timezone and locale (toLocaleTimeString / toLocaleDateString).
 */

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

    // "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss" – parse as local (device) time
    const m = s.match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/
    );
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      const hour = Number(m[4]);
      const minute = Number(m[5]);
      const second = Number(m[6] || '0');
      const milliRaw = m[7] || '0';
      const ms = Number(milliRaw.padEnd(3, '0').slice(0, 3));
      const d = new Date(year, month, day, hour, minute, second, ms);
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
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Short date for list items (e.g. "Jan 15" or "Jan 15, 2024" if different year).
 */
export function formatShortDate(value: string | number | Date | null | undefined): string {
  const d = parseTimestamp(value);
  if (!d) return '';
  const today = new Date();
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
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

  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * For conversation list: time if today, "Yesterday", weekday, or short date – device local.
 */
export function formatChatListTimestamp(value: string | number | Date | null | undefined): string {
  const d = parseTimestamp(value);
  if (!d) return '';
  const today = new Date();
  const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return formatShortDate(value);
}
