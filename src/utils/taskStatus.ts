export type TaskStatusCategory = 'todo' | 'scheduled' | 'overdue' | 'duesoon' | 'inprogress' | 'completed';

const toDayStartMs = (input?: string | Date | null): number | null => {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** Calendar day: true when today is strictly before start_date's day. */
export const isBeforeStartDateCalendarDay = (
  startDate?: string | Date | null,
  now?: Date
): boolean => {
  const todayMs = toDayStartMs(now ?? new Date());
  const startMs = toDayStartMs(startDate);
  if (startMs == null || todayMs == null) return false;
  return todayMs < startMs;
};

const isExplicitInProgressStatus = (status: string | null | undefined): boolean => {
  const normalized = String(status || '').toLowerCase().trim();
  return (
    normalized === 'inprogress' ||
    normalized === 'in_progress' ||
    normalized === 'pending_verification' ||
    normalized === 'under_verification' ||
    normalized === 'awaiting_creator_confirmation'
  );
};

export const normalizeLifecycleStatus = (status: unknown): TaskStatusCategory | null => {
  if (!status) return null;
  const normalized = String(status).toLowerCase().trim();

  if (normalized === 'scheduled') return 'scheduled';
  if (normalized === 'todo' || normalized === 'pending' || normalized === 'active' || normalized === 'accepted') {
    return 'todo';
  }
  if (isExplicitInProgressStatus(normalized)) {
    return 'inprogress';
  }
  if (normalized === 'duesoon' || normalized === 'due_soon') return 'duesoon';
  if (normalized === 'overdue') return 'overdue';
  if (normalized === 'completed' || normalized === 'verified' || normalized === 'completed_verified') {
    return 'completed';
  }
  if (normalized === 'rejected') return 'todo';

  return null;
};

function getCurrentUserAssignee(task: any, currentUserIdOverride?: string | null): any | null {
  const currentUserStatus = task?.current_user_status;
  const currentUserId =
    currentUserIdOverride ||
    currentUserStatus?.user_id ||
    currentUserStatus?.userId ||
    task?.current_user_id ||
    task?.currentUserId ||
    null;
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  if (!assignees.length || !currentUserId) return null;

  return (
    assignees.find((a: any) => {
      const assigneeId = a?.id || a?.user_id || a?.userId;
      return assigneeId != null && String(assigneeId) === String(currentUserId);
    }) || null
  );
};

const isDueSoon = (todayMs: number, dueMs: number, dueSoonDays: number): boolean => {
  const diffDays = Math.ceil((dueMs - todayMs) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= dueSoonDays;
};

const isDueSoonEligible = (
  todayMs: number,
  startMs: number | null,
  targetMs: number | null,
  dueMs: number | null,
  dueSoonDays: number
): boolean => {
  if (dueMs == null || todayMs == null) return false;
  const gateMs = targetMs ?? startMs;
  if (gateMs != null && todayMs < gateMs) return false;
  return isDueSoon(todayMs, dueMs, dueSoonDays);
};

export const resolveUserLifecycleCategory = (input: {
  assigneeStatus?: string | null;
  verifiedAt?: string | Date | null;
  startDate?: string | Date | null;
  targetDate?: string | Date | null;
  dueDate?: string | Date | null;
  dueSoonDays?: number;
  now?: Date;
}): TaskStatusCategory => {
  const todayMs = toDayStartMs(input.now ?? new Date());
  const startMs = toDayStartMs(input.startDate);
  const targetMs = toDayStartMs(input.targetDate);
  const dueMs = toDayStartMs(input.dueDate);
  const overdueMs = dueMs ?? targetMs;
  const dueSoonDays = input.dueSoonDays ?? 3;
  const rawAssigneeStatus = input.assigneeStatus;

  if (input.verifiedAt) {
    return 'completed';
  }

  const fromStatus = normalizeLifecycleStatus(rawAssigneeStatus);
  if (fromStatus === 'completed') {
    return 'inprogress';
  }

  if (startMs != null && todayMs != null && todayMs < startMs) {
    return 'scheduled';
  }

  if (overdueMs != null && todayMs != null && todayMs > overdueMs) {
    return 'overdue';
  }

  if (fromStatus === 'overdue') {
    return 'overdue';
  }

  if (isExplicitInProgressStatus(rawAssigneeStatus)) {
    return 'inprogress';
  }

  if (isDueSoonEligible(todayMs, startMs, targetMs, dueMs, dueSoonDays)) {
    return 'duesoon';
  }

  if (fromStatus === 'duesoon') {
    return 'todo';
  }

  if (fromStatus === 'scheduled') {
    return 'todo';
  }

  if (fromStatus) {
    return fromStatus;
  }

  return 'todo';
};

function getAssigneeId(assignee: any): string | null {
  const id = assignee?.id || assignee?.user_id || assignee?.userId;
  return id != null ? String(id) : null;
}

function isPendingVerificationAssignee(assignee: any): boolean {
  return !!(assignee?.completed_at && !assignee?.verified_at);
}

/** Whether current user may verify the target assignee's completion (matches task chat rules). */
export function canUserVerifyAssigneeCompletion(
  task: any,
  currentUserId: string,
  targetAssigneeId: string
): boolean {
  const creatorId = task?.created_by ?? task?.creator_id;
  const reportingMemberId = task?.reporting_member_id;
  const isCreator = creatorId != null && String(creatorId) === String(currentUserId);
  const isReportingMember =
    reportingMemberId != null && String(reportingMemberId) === String(currentUserId);
  const isTargetCreator = creatorId != null && String(targetAssigneeId) === String(creatorId);
  const isTargetReportingMember =
    reportingMemberId != null && String(targetAssigneeId) === String(reportingMemberId);
  const isTargetSelf = String(targetAssigneeId) === String(currentUserId);

  if (isTargetSelf) return false;

  if (isCreator) {
    if (reportingMemberId) return isTargetReportingMember;
    return !isTargetCreator;
  }
  if (isReportingMember) {
    return !isTargetCreator && !isTargetReportingMember;
  }
  return false;
}

/** True when owner/reporting manager should see the task under Todo (pending verification work). */
export function hasPendingVerificationsForVerifier(
  task: any,
  currentUserId?: string | null
): boolean {
  if (!task || !currentUserId) return false;
  if (String(task.status || '').toLowerCase() === 'completed') return false;

  const creatorId = task?.created_by ?? task?.creator_id;
  const reportingMemberId = task?.reporting_member_id;
  const isCreator = creatorId != null && String(creatorId) === String(currentUserId);
  const isReportingMember =
    reportingMemberId != null && String(reportingMemberId) === String(currentUserId);

  if (!isCreator && !isReportingMember) return false;

  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  return assignees.some((assignee: any) => {
    const assigneeId = getAssigneeId(assignee);
    if (!assigneeId || !isPendingVerificationAssignee(assignee)) return false;
    if (String(assigneeId) === String(currentUserId)) return false;

    if (isReportingMember) {
      return canUserVerifyAssigneeCompletion(task, currentUserId, assigneeId);
    }
    // Task owner: surface when any other member awaits verification on the task.
    return isCreator;
  });
}

export function getTaskStatusCategoryFromTask(
  task: any,
  dueSoonDays?: number,
  currentUserId?: string | null
): TaskStatusCategory | null {
  if (!task) return null;
  if (task.hide_user_status === true) return null;

  const me = getCurrentUserAssignee(task, currentUserId);
  const cu = task.current_user_status;
  const resolvedDueSoonDays =
    dueSoonDays ??
    (task.dueSoonDays as number | undefined) ??
    (task.due_soon_days as number | undefined) ??
    3;

  return resolveUserLifecycleCategory({
    assigneeStatus: cu?.assignee_status ?? me?.assignee_status,
    verifiedAt: me?.verified_at ?? cu?.verified_at,
    startDate: task.start_date ?? task.startDate,
    targetDate: task.target_date ?? task.targetDate,
    dueDate: task.due_date ?? task.dueDate,
    dueSoonDays: resolvedDueSoonDays,
  });
}

/** Dashboard/filter status: surfaces tasks needing verification under Todo for owner & reporting manager. */
export function getTaskDashboardFilterStatus(
  task: any,
  dueSoonDays?: number,
  currentUserId?: string | null
): TaskStatusCategory | null {
  const category = getTaskStatusCategoryFromTask(task, dueSoonDays, currentUserId);
  if (!category || category === 'completed' || category === 'scheduled') return category;
  if (hasPendingVerificationsForVerifier(task, currentUserId)) {
    return 'todo';
  }
  return category;
}

/** Assignees are auto-accepted unless they explicitly rejected the task. */
export function getEffectiveHasAccepted(input: {
  isCreator: boolean;
  isAssigned: boolean;
  currentUserStatus?: any;
  currentUserAssignee?: any;
}): boolean {
  const { isCreator, isAssigned, currentUserStatus, currentUserAssignee } = input;
  if (isCreator) return true;
  if (!isAssigned) return false;
  const hasRejected = !!(currentUserStatus?.has_rejected || currentUserAssignee?.has_rejected);
  if (hasRejected) return false;
  return true;
}
