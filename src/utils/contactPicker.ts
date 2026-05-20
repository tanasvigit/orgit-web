/** Filter org / contact lists by name or phone (local search). */
export function filterContactsByQuery<T extends { name?: string; mobile?: string; phone?: string }>(
  users: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(q) ||
      `${u.mobile || u.phone || ''}`.toLowerCase().includes(q)
  );
}
