import { getEffectiveHasAccepted, getTaskStatusCategoryFromTask } from './taskStatus';
import { isTaskDeleted } from './taskUtils';

export type TaskUserActionFlags = {
  isCreator: boolean;
  canMoveToInProgress: boolean;
  canMarkComplete: boolean;
  canAddMember: boolean;
  canExitWithComments: boolean;
  canRequestDelete: boolean;
  canDeleteDirect: boolean;
};

export function getTaskUserActionFlags(
  task: any,
  currentUserId: string | null | undefined,
  options?: { userRole?: string; dueSoonDays?: number }
): TaskUserActionFlags {
  const empty: TaskUserActionFlags = {
    isCreator: false,
    canMoveToInProgress: false,
    canMarkComplete: false,
    canAddMember: false,
    canExitWithComments: false,
    canRequestDelete: false,
    canDeleteDirect: false,
  };

  if (!task?.id || !currentUserId || isTaskDeleted(task)) return empty;

  const creatorId = task.created_by ?? task.creator_id;
  const isCreator = creatorId != null && String(creatorId) === String(currentUserId);
  const userRole = options?.userRole || '';
  const isAdminOrSuper = userRole === 'admin' || userRole === 'super_admin';
  const canDeleteDirect = isCreator || isAdminOrSuper;

  const taskStatusSimple =
    task.task_status_simple ||
    (task.task_status === 'COMPLETED' || task.status === 'completed' ? 'complete' : 'incomplete');
  const lifecycleStatus = getTaskStatusCategoryFromTask(
    task,
    options?.dueSoonDays,
    currentUserId
  );
  const taskActive =
    String(task.status || '').toLowerCase() !== 'rejected' &&
    String(task.status || '').toLowerCase() !== 'deleted';
  const taskNotCompletedOrRejected =
    taskStatusSimple !== 'complete' &&
    String(task.status || '').toLowerCase() !== 'rejected' &&
    lifecycleStatus !== 'completed';

  const currentUserAssignee = Array.isArray(task.assignees)
    ? task.assignees.find((a: any) => {
        const assigneeId = a?.id || a?.user_id || a?.userId;
        return assigneeId != null && String(assigneeId) === String(currentUserId);
      })
    : null;
  const currentUserStatus = task.current_user_status;
  const isAssigned = currentUserAssignee != null || currentUserStatus != null;
  const isParticipant = isCreator || isAssigned;
  const effectiveHasAccepted = getEffectiveHasAccepted({
    isCreator,
    isAssigned,
    currentUserStatus,
    currentUserAssignee,
  });
  const effectiveHasRejected = isCreator
    ? false
    : !!(currentUserStatus?.has_rejected || currentUserAssignee?.has_rejected);

  return {
    isCreator,
    canMoveToInProgress:
      taskNotCompletedOrRejected &&
      isParticipant &&
      !effectiveHasRejected &&
      lifecycleStatus === 'todo',
    canMarkComplete:
      taskNotCompletedOrRejected &&
      isParticipant &&
      (effectiveHasAccepted || isCreator) &&
      taskStatusSimple !== 'complete' &&
      (isCreator || lifecycleStatus !== 'completed'),
    canAddMember:
      (isCreator || isAssigned) &&
      (isCreator || effectiveHasAccepted) &&
      taskNotCompletedOrRejected &&
      taskStatusSimple !== 'complete',
    canExitWithComments:
      isAssigned &&
      !isCreator &&
      effectiveHasAccepted &&
      taskNotCompletedOrRejected &&
      taskStatusSimple !== 'complete',
    canRequestDelete:
      taskActive &&
      !canDeleteDirect &&
      (isAssigned || currentUserStatus != null),
    canDeleteDirect: canDeleteDirect && taskActive,
  };
}

export type BulkTaskActionKey =
  | 'in_progress'
  | 'mark_complete'
  | 'add_member'
  | 'exit_with_comments'
  | 'request_delete'
  | 'delete_direct';

export function getBulkTaskActionCounts(
  tasks: any[],
  currentUserId: string | null | undefined,
  options?: { userRole?: string; dueSoonDays?: number }
): Record<BulkTaskActionKey, any[]> {
  const buckets: Record<BulkTaskActionKey, any[]> = {
    in_progress: [],
    mark_complete: [],
    add_member: [],
    exit_with_comments: [],
    request_delete: [],
    delete_direct: [],
  };

  tasks.forEach((task) => {
    const flags = getTaskUserActionFlags(task, currentUserId, options);
    if (flags.canMoveToInProgress) buckets.in_progress.push(task);
    if (flags.canMarkComplete) buckets.mark_complete.push(task);
    if (flags.canAddMember) buckets.add_member.push(task);
    if (flags.canExitWithComments) buckets.exit_with_comments.push(task);
    if (flags.canRequestDelete) buckets.request_delete.push(task);
    if (flags.canDeleteDirect) buckets.delete_direct.push(task);
  });

  return buckets;
}
