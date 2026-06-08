/** Parse due-soon window from dashboard/task API or reminder config payload. */
export function parseDueSoonDays(value: unknown): number {
  if (value == null) return 3;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 1 && value <= 30 ? Math.floor(value) : 3;
  }
  const obj = value as Record<string, unknown>;
  const nested = obj.data as Record<string, unknown> | undefined;
  const n = Number(obj.dueSoonDays ?? nested?.dueSoonDays ?? obj.due_soon_days);
  return Number.isFinite(n) && n >= 1 && n <= 30 ? Math.floor(n) : 3;
}
