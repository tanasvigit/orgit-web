/** How long a task stays visible after activity when status/view filters would hide it. */
export const TASK_ACTIVITY_FILTER_GRACE_MS = 30 * 60 * 1000;

export type TaskActivityBumpMap = Map<string, number>;

export function bumpTaskDashboardActivity(
  map: TaskActivityBumpMap,
  ids: { taskId?: string | null; conversationId?: string | null; atMs?: number }
): void {
  const at = ids.atMs ?? Date.now();
  if (ids.taskId) map.set(`task:${String(ids.taskId)}`, at);
  if (ids.conversationId) map.set(`conv:${String(ids.conversationId)}`, at);
}

export function getTaskDashboardBumpMs(
  map: TaskActivityBumpMap | undefined,
  ids: { taskId?: string | null; conversationId?: string | null }
): number {
  if (!map) return 0;
  let max = 0;
  if (ids.taskId) max = Math.max(max, map.get(`task:${String(ids.taskId)}`) ?? 0);
  if (ids.conversationId) max = Math.max(max, map.get(`conv:${String(ids.conversationId)}`) ?? 0);
  return max;
}

export function isTaskRecentlyActiveForFilter(
  map: TaskActivityBumpMap,
  taskId: string | null | undefined,
  now = Date.now()
): boolean {
  if (!taskId) return false;
  const bumped = map.get(`task:${String(taskId)}`);
  return bumped != null && now - bumped < TASK_ACTIVITY_FILTER_GRACE_MS;
}
