/** Canonical task-card unit preference (legacy stored value: org_node). */
export const TASK_UNIT_PREFERENCE_ORG = 'org_unit' as const;

export type TaskUnitPreferenceOrg = typeof TASK_UNIT_PREFERENCE_ORG;

export function normalizeTaskUnitPreference(
  pref: string | null | undefined
): TaskUnitPreferenceOrg {
  if (pref === 'org_unit' || pref === 'org_node') return TASK_UNIT_PREFERENCE_ORG;
  return TASK_UNIT_PREFERENCE_ORG;
}

/** Dropdown / picker label: level + name (+ optional code), no hierarchy path. */
export function formatOrgUnitLabel(
  node:
    | {
        name?: string | null;
        levelLabel?: string | null;
        code?: string | null;
      }
    | null
    | undefined
): string {
  if (!node) return '';
  const name = String(node.name ?? '').trim();
  const levelLabel = String(node.levelLabel ?? '').trim();
  const code = String(node.code ?? '').trim();
  const base = levelLabel && name ? `${levelLabel}: ${name}` : name || levelLabel;
  if (!base) return '';
  return code ? `${base} [${code}]` : base;
}
