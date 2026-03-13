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
  dueSoonDays: number = 3
): TaskStatusCategory | null {
  if (!task) return null;

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

  // 1. Prefer per-user lifecycle status when available (mirrors mobile filters)
  const userScoped =
    normalizeLifecycleStatus((task as any).current_user_member_status) ||
    normalizeLifecycleStatus(task.current_user_status?.assignee_status);

  if (userScoped) {
    return userScoped;
  }

  // 2. Then consider global backend-computed task_status
  const globalFromTaskStatus = normalizeLifecycleStatus(task.task_status);
  if (globalFromTaskStatus) {
    return globalFromTaskStatus;
  }

  // 3. Legacy fallback: derive from task.status and due dates
  const rawStatus = String(task.status || '').toLowerCase();
  const due = task.due_date || task.dueDate;

  // completed takes absolute precedence
  if (rawStatus === 'completed') {
    return 'completed';
  }

  // Date-based buckets (overdue / due soon)
  if (due) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due);
    if (!isNaN(dueDate.getTime())) {
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays < 0) {
        return 'overdue';
      }
      if (diffDays >= 0 && diffDays <= dueSoonDays) {
        return 'duesoon';
      }
    }
  }

  // In progress: only when backend / task.status explicitly says so
  if (rawStatus === 'in_progress' || rawStatus === 'inprogress') {
    return 'inprogress';
  }

  // Fallback = To Do
  return 'todo';
}

