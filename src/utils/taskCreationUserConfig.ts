/** Mirrors backend DEFAULT_TASK_CREATION_USER_CONFIG for offline/fallback use. */
export const FALLBACK_TASK_CREATION_USER_CONFIG = {
  dueDaysFromStart: 10,
  targetDaysBeforeDue: 3,
  autoEscalateTrigger: 'target_date' as const,
  taskUnitPreference: 'cost_centre' as const,
};

export type TaskCreationUserConfig = {
  dueDaysFromStart: number;
  targetDaysBeforeDue: number;
  autoEscalateTrigger: 'target_date' | 'due_date';
  taskUnitPreference:
    | 'cost_centre'
    | 'department'
    | 'depot'
    | 'branch'
    | 'entity'
    | 'warehouse'
    | 'project'
    | 'factory';
};

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
