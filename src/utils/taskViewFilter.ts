export type TaskViewFilter = 'all' | 'self' | 'assigned';

/** Resolve current user's assignee role on a task (matches dashboard Self/Assigned rules). */
export function getCurrentUserTaskRole(
  task: any,
  currentUserId: string | null | undefined
): string {
  if (!currentUserId) return 'member';

  const roleFromCurrent = task?.current_user_status?.role;
  if (roleFromCurrent) return String(roleFromCurrent).toLowerCase();

  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  const mine = assignees.find((a: any) => {
    const id = a?.id ?? a?.user_id ?? a?.userId;
    return id != null && String(id) === String(currentUserId);
  });
  if (mine?.role) return String(mine.role).toLowerCase();

  const creatorId = task?.created_by ?? task?.creator_id;
  if (creatorId != null && String(creatorId) === String(currentUserId)) return 'creator';

  if (
    task?.reporting_member_id != null &&
    String(task.reporting_member_id) === String(currentUserId)
  ) {
    return 'reporting_member';
  }

  return 'member';
}

export function taskHasOtherAssignees(
  task: any,
  currentUserId: string | null | undefined
): boolean {
  if (task?.total_assignees != null) {
    const n = Number(task.total_assignees);
    if (Number.isFinite(n)) return n > 1;
  }
  if (!Array.isArray(task?.assignees) || !currentUserId) return false;
  return task.assignees.some((a: any) => {
    const id = a?.id ?? a?.user_id ?? a?.userId;
    return id != null && String(id) !== String(currentUserId);
  });
}

/**
 * Self: non-creator assignee, OR creator-only task (no other assignees).
 * Assigned: current user is creator AND there is at least one other assignee.
 */
export function taskMatchesViewFilter(
  task: any,
  viewFilter: TaskViewFilter,
  currentUserId: string | null | undefined
): boolean {
  if (!viewFilter || viewFilter === 'all') return true;
  if (!task || !currentUserId) return false;

  const myRole = getCurrentUserTaskRole(task, currentUserId);
  const hasOthers = taskHasOtherAssignees(task, currentUserId);

  if (viewFilter === 'self') {
    if (myRole !== 'creator') return true;
    return !hasOthers;
  }

  if (viewFilter === 'assigned') {
    return myRole === 'creator' && hasOthers;
  }

  return true;
}
