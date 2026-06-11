/** Normalize conversation IDs for badge map keys (case-insensitive UUID strings). */
export function normalizeConvId(id: string | number | null | undefined): string {
  if (id == null || id === '') return '';
  return String(id).trim().toLowerCase();
}
