export type TaskStatusCategory = 'todo' | 'scheduled' | 'overdue' | 'duesoon' | 'inprogress' | 'completed';

/**
 * Normalize a raw lifecycle status (from task_status / member_status) into
 * the simplified buckets used across mobile + web.
 *
 * This mirrors the mobile helpers:
 * - TaskDashboardScreen.getDerivedUserTaskStatus
 * - TaskDetailScreen.normalizeAssigneeLifecycleStatus
 */
function normalizeLifecycleStatus(status: any): TaskStatusCategory | null {
  if (!status) return null;
  const normalized = String(status).toLowerCase();

  if (normalized === 'scheduled') return 'scheduled';

  if (normalized === 'todo' || normalized === 'pending') return 'todo';

  if (
    normalized === 'inprogress' ||
    normalized === 'in_progress' ||
    normalized === 'pending_verification' ||
    normalized === 'under_verification' ||
    normalized === 'awaiting_creator_confirmation'
  ) {
    return 'inprogress';
  }

  if (normalized === 'completed' || normalized === 'verified' || normalized === 'completed_verified') {
    return 'completed';
  }

  if (normalized === 'duesoon' || normalized === 'due_soon') {
    return 'duesoon';
  }

  if (normalized === 'overdue') {
    return 'overdue';
  }

  return null;
}

function getCurrentUserAssignee(task: any, currentUserIdOverride?: string | null): any | null {
  const currentUserStatus = (task as any)?.current_user_status;
  const currentUserId =
    (currentUserIdOverride || currentUserStatus?.user_id || currentUserStatus?.userId || (task as any)?.current_user_id || (task as any)?.currentUserId || null);
  const assignees = Array.isArray((task as any)?.assignees) ? (task as any).assignees : [];
  if (!assignees.length || !currentUserId) return null;

  return (
    assignees.find((a: any) => {
      const assigneeId = a?.id || a?.user_id || a?.userId;
      return assigneeId != null && String(assigneeId) === String(currentUserId);
    }) || null
  );
}

/**
 * Single source of truth for task-level status categorization on the web.
 *
 * This now aligns with the mobile apps by:
 * - Preferring backend-computed lifecycle fields:
 *   - task.task_status (global lifecycle)
 *   - task.current_user_member_status (per-user lane)
 *   - task.current_user_status.assignee_status (fallback)
 * - Falling back to legacy task.status + date rules when those are missing.
 */
export function getTaskStatusCategoryFromTask(
  task: any,
  dueSoonDays: number = 3,
  currentUserId?: string | null
): TaskStatusCategory | null {
  if (!task) return null;
  const derived = normalizeLifecycleStatus((task as any).derived_status);
  if (derived) {
    return derived;
  }
  const debugTaskId = '21b9036f-8eeb-4b7d-b12f-b09246705ef9';
  const isDebugTask = String((task as any)?.id || '') === debugTaskId;

  // Backend/DB-driven scheduled indicator:
  // taskController adds is_before_start_date for list endpoints, and some endpoints also set assignee_status = 'scheduled'.
  if ((task as any).is_before_start_date === true) {
    return 'scheduled';
  }

  // Fallback for endpoints that don't include the flag:
  // derive scheduled from start_date (full timestamp), matching mobile behavior.
  const rawStart = (task as any).start_date ?? (task as any).startDate;
  if (rawStart) {
    try {
      const start = new Date(rawStart);
      if (!isNaN(start.getTime()) && new Date() < start) {
        return 'scheduled';
      }
    } catch {
      // ignore
    }
  }

  // 1. Match Task Details indicator priority:
  // Prefer assignee_status (current user lane) and do not prioritize current_user_member_status.
  const userScoped =
    normalizeLifecycleStatus(task.current_user_status?.assignee_status) ||
    normalizeLifecycleStatus(getCurrentUserAssignee(task, currentUserId)?.assignee_status);

  if (userScoped) {
    if (isDebugTask) {
      console.log('[TaskStatusDebug][shared][userScoped]', {
        taskId: (task as any)?.id,
        currentUserId,
        currentUserAssigneeStatus: task.current_user_status?.assignee_status,
        assigneeStatusFromMembers: getCurrentUserAssignee(task, currentUserId)?.assignee_status,
        resolved: userScoped,
      });
    }
    return userScoped;
  }

  // 1b. Per-user completion/acceptance fallback from task_assignees-style fields.
  // This mirrors Task Details main indicator logic exactly.
  const me = getCurrentUserAssignee(task, currentUserId);
  const cu = task.current_user_status;
  let base: TaskStatusCategory = 'todo';
  const meCompleted = !!(
    me?.completed_at ||
    me?.completion_status === 'completed' ||
    me?.status === 'completed' ||
    me?.verified_at
  );
  if (meCompleted) {
    base = 'completed';
  } else {
    const accepted = !!(me?.accepted_at || me?.has_accepted || cu?.has_accepted);
    base = accepted ? 'inprogress' : 'todo';
  }

  // 2. Date/status override (same precedence as Task Details).
  const rawStatus = String(task.status || '').toLowerCase();
  const due = task.due_date || task.dueDate;
  if (due) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due);
    if (!isNaN(dueDate.getTime())) {
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (base !== 'completed' && (rawStatus === 'overdue' || diffDays < 0)) {
        if (isDebugTask) {
          console.log('[TaskStatusDebug][shared][overdueOverride]', {
            taskId: (task as any)?.id,
            currentUserId,
            base,
            rawStatus,
            diffDays,
            resolved: 'overdue',
          });
        }
        return 'overdue';
      }
      if (base !== 'completed' && diffDays >= 0 && diffDays <= dueSoonDays) {
        if (isDebugTask) {
          console.log('[TaskStatusDebug][shared][dueSoonOverride]', {
            taskId: (task as any)?.id,
            currentUserId,
            base,
            rawStatus,
            diffDays,
            resolved: 'duesoon',
          });
        }
        return 'duesoon';
      }
    }
  }
  if (isDebugTask) {
    console.log('[TaskStatusDebug][shared][base]', {
      taskId: (task as any)?.id,
      currentUserId,
      base,
      rawStatus,
      currentUserAssigneeStatus: task.current_user_status?.assignee_status,
      assigneeStatusFromMembers: getCurrentUserAssignee(task, currentUserId)?.assignee_status,
    });
  }
  return base;
}

