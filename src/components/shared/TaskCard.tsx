import React from 'react';
import type { TaskStatusCategory } from '../../utils/taskStatus';

interface TaskCardProps {
  id: string;
  title: string;
  clientName?: string;
  tags?: string[] | string;
  description?: string;
  /** Per-user lifecycle bucket (matches mobile TaskDashboard getTaskMenuFlags / getDerivedUserTaskStatus). */
  status: TaskStatusCategory;
  dueDate?: string;
  category?: string;
  priority?: string;
  assignees?: Array<{ id: string; name: string; photoUrl?: string }>;
  progress?: number;
  finance?: { amount?: number | null; type?: 'income' | 'expense' | string | null };
  unreadCount?: number;
  taskPeriod?: string;
  frequency?: string;
  taskUnitType?: string;
  taskUnitName?: string;
  /** When true, suppress overdue UI (matches mobile noScheduleCreatorTask / hide_user_status). */
  hideUserStatus?: boolean;
  /** Raw task row status (e.g. completed) for overdue pill edge cases. */
  rawTaskStatus?: string | null;
  onClick?: () => void;
}

function formatTaskPeriod(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function formatTaskDueDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function lifecycleIconName(display: TaskStatusCategory | null): string {
  switch (display) {
    case 'scheduled':
      return 'schedule';
    case 'todo':
      return 'today';
    case 'inprogress':
      return 'pending_actions';
    case 'duesoon':
      return 'hourglass_top';
    case 'overdue':
      return 'priority_high';
    case 'completed':
      return 'check_circle';
    default:
      return 'help_outline';
  }
}

function lifecycleIconColor(display: TaskStatusCategory | null): string {
  switch (display) {
    case 'todo':
      return '#2563EB';
    case 'inprogress':
      return '#7C3AED';
    case 'duesoon':
      return '#F59E0B';
    case 'completed':
      return '#10B981';
    case 'overdue':
      return '#EF4444';
    case 'scheduled':
      return '#6366F1';
    default:
      return '#6B7280';
  }
}

function isDueDatePast(due: string | undefined | null): boolean {
  if (!due) return false;
  const d = new Date(due);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function showOverduePill(
  lifecycle: TaskStatusCategory,
  hideUserStatus: boolean | undefined,
  rawStatus: string | undefined | null,
  dueDate: string | undefined | null
): boolean {
  if (hideUserStatus) return false;
  const raw = String(rawStatus || '').toLowerCase();
  if (raw === 'completed') return false;
  if (lifecycle === 'completed') return false;
  return lifecycle === 'overdue' || isDueDatePast(dueDate);
}

export const TaskCard: React.FC<TaskCardProps> = ({
  title,
  clientName,
  tags,
  dueDate,
  status,
  unreadCount = 0,
  taskPeriod,
  frequency,
  taskUnitName,
  hideUserStatus,
  rawTaskStatus,
  onClick,
}) => {
  const tagOrClient = (() => {
    const tagText = Array.isArray(tags) ? tags.filter(Boolean).join(', ') : typeof tags === 'string' ? tags : '';
    return (tagText || clientName || '').trim();
  })();

  const baseTitle = String(title || '').trim();
  const displayPeriod = (taskPeriod || '').trim();
  const displayTitle = displayPeriod ? `${baseTitle} - ${displayPeriod}` : baseTitle;
  const dueText = formatTaskDueDate(dueDate || null);
  const frequencyText = String(frequency || 'One-Time').replace(/_/g, ' ');
  const unitText = taskUnitName && taskUnitName !== '-' ? String(taskUnitName).trim() : '';

  const iconName = lifecycleIconName(status);
  const iconColor = lifecycleIconColor(status);
  const overduePill = showOverduePill(status, hideUserStatus, rawTaskStatus, dueDate || null);

  return (
    <div
      className={`group relative cursor-pointer rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-slate-800/90 ${
        status === 'completed' ? 'opacity-90' : ''
      }`}
      style={{ minHeight: 126, paddingLeft: 16, paddingRight: 12, paddingTop: 14, paddingBottom: 14 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {unreadCount > 0 ? (
        <span
          className="absolute right-3 top-2.5 z-[4] flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white"
          aria-label={`${unreadCount} unread messages in task chat`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}

      <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
        <div className="col-span-2 min-w-0">
          <h4
            className={`text-[19px] font-bold leading-6 text-gray-900 dark:text-white ${
              status === 'completed' ? 'text-gray-500 dark:text-gray-400' : ''
            }`}
          >
            <span className="line-clamp-1">{displayTitle}</span>
          </h4>
        </div>

        <div className="flex items-start justify-end">
          {hideUserStatus ? null : (
            <span className="material-icons-round text-[20px]" style={{ color: iconColor }} aria-hidden>
              {iconName}
            </span>
          )}
        </div>

        {tagOrClient ? (
          <p className="col-span-2 min-w-0 text-sm leading-[21px] text-gray-500 dark:text-gray-400">
            <span className="line-clamp-1">{tagOrClient}</span>
          </p>
        ) : (
          <div className="col-span-2" />
        )}

        {dueText ? (
          <p className="text-right text-sm leading-[21px] text-gray-500 dark:text-gray-400">
            <span className="line-clamp-1">{dueText}</span>
          </p>
        ) : (
          <div />
        )}

        <p className="min-w-0 text-sm leading-[21px] text-gray-500 dark:text-gray-400">
          <span className="line-clamp-1">{frequencyText}</span>
        </p>

        {unitText ? (
          <p className="col-span-2 min-w-0 text-right text-sm leading-[21px] text-gray-500 dark:text-gray-400">
            <span className="line-clamp-1">{unitText}</span>
          </p>
        ) : (
          <div className="col-span-2" />
        )}
      </div>
      {overduePill ? (
        <div
          className="absolute bottom-3 right-3 z-[2] rounded-lg bg-red-50 px-2 py-1 dark:bg-red-950/40"
          aria-label="Overdue"
        >
          <span className="text-[11px] font-bold text-red-500">Overdue</span>
        </div>
      ) : null}
    </div>
  );
};

export { formatTaskPeriod };
