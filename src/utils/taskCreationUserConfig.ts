import { TASK_UNIT_PREFERENCE_ORG, type TaskUnitPreferenceOrg } from './orgUnitLabel';
import {
  DEFAULT_TASK_CARD_DISPLAY,
  mergeTaskCardDisplayConfig,
  type TaskCardDisplayConfig,
} from './taskCardDisplayConfig';

export type { TaskCardDisplayConfig };
export {
  DEFAULT_TASK_CARD_DISPLAY,
  mergeTaskCardDisplayConfig,
  TASK_CARD_DISPLAY_FIELD_KEYS,
  TASK_CARD_DISPLAY_FIELD_LABELS,
} from './taskCardDisplayConfig';

/** Mirrors backend DEFAULT_TASK_CREATION_USER_CONFIG for offline/fallback use. */
export const FALLBACK_TASK_CREATION_USER_CONFIG = {
  dueDaysFromStart: 10,
  targetDaysBeforeDue: 3,
  autoEscalateTrigger: 'target_date' as const,
  taskUnitPreference: TASK_UNIT_PREFERENCE_ORG,
  taskCardDisplay: { ...DEFAULT_TASK_CARD_DISPLAY },
};

export type TaskCreationUserConfig = {
  dueDaysFromStart: number;
  targetDaysBeforeDue: number;
  autoEscalateTrigger: 'target_date' | 'due_date';
  taskUnitPreference: TaskUnitPreferenceOrg;
  taskCardDisplay?: TaskCardDisplayConfig;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Merge API/stored JSON with defaults (mirrors backend taskCreationUserConfigService). */
export function mergeTaskCreationUserConfig(
  stored: unknown | null | undefined
): TaskCreationUserConfig {
  const base: TaskCreationUserConfig = {
    ...FALLBACK_TASK_CREATION_USER_CONFIG,
    taskCardDisplay: { ...DEFAULT_TASK_CARD_DISPLAY },
  };

  if (!isPlainObject(stored)) return base;

  const dueRaw = stored.dueDaysFromStart;
  if (typeof dueRaw === 'number' && Number.isFinite(dueRaw)) {
    base.dueDaysFromStart = Math.max(1, Math.min(365, Math.round(dueRaw)));
  }

  const targetRaw = stored.targetDaysBeforeDue;
  if (typeof targetRaw === 'number' && Number.isFinite(targetRaw)) {
    base.targetDaysBeforeDue = Math.max(0, Math.min(365, Math.round(targetRaw)));
  }

  const trig = stored.autoEscalateTrigger;
  if (trig === 'target_date' || trig === 'due_date') {
    base.autoEscalateTrigger = trig;
  }

  const unitPref = stored.taskUnitPreference;
  if (unitPref === 'org_unit' || unitPref === 'org_node') {
    base.taskUnitPreference = TASK_UNIT_PREFERENCE_ORG;
  }

  if (base.targetDaysBeforeDue > base.dueDaysFromStart) {
    base.targetDaysBeforeDue = Math.min(base.targetDaysBeforeDue, base.dueDaysFromStart);
  }

  base.taskCardDisplay = mergeTaskCardDisplayConfig(stored.taskCardDisplay);

  return base;
}

/** Start date at 9:00; target = due minus N days; due = start plus M days. */
export function computeTaskTimelineFromStart(
  start: Date,
  config: Pick<TaskCreationUserConfig, 'dueDaysFromStart' | 'targetDaysBeforeDue'>
): { start: Date; target: Date; due: Date } {
  const startNorm = new Date(start);
  startNorm.setHours(9, 0, 0, 0);

  const due = new Date(startNorm);
  due.setDate(due.getDate() + Math.max(1, config.dueDaysFromStart));
  due.setHours(9, 0, 0, 0);

  const target = new Date(due);
  target.setDate(target.getDate() - Math.max(0, config.targetDaysBeforeDue));
  target.setHours(9, 0, 0, 0);

  if (target < startNorm) {
    target.setTime(startNorm.getTime());
  }

  return { start: startNorm, target, due };
}
