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

/** Mirrors orgit-mobile TaskDashboardScreen.formatDate for the "Due …" line. */
function formatDueLabelMobileStyle(dateString: string | undefined | null): string {
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
  taskUnitType,
  taskUnitName,
  hideUserStatus,
  rawTaskStatus,
  onClick,
}) => {
  const tagOrClient = (() => {
    const tagText = Array.isArray(tags) ? tags.filter(Boolean).join(', ') : typeof tags === 'string' ? tags : '';
    return (tagText || clientName || '').trim() || '';
  })();

  const dueFormatted = formatDueLabelMobileStyle(dueDate || '');
  const dueText = dueFormatted ? `Due ${dueFormatted}` : '';

  const line1 = [tagOrClient, dueText].filter(Boolean).join(' | ');

  const frequencyText = String(frequency || 'One-Time').replace(/_/g, ' ');
  const unitType = taskUnitType || 'Task unit';
  const unitName = taskUnitName && taskUnitName !== '-' ? taskUnitName : '';
  const line2 = [frequencyText, unitType, unitName].filter(Boolean).join(' | ');

  const normalizedTitle = String(title || '').trim();
  const periodLabel = (taskPeriod || '').toLowerCase().trim();
  const monthSuffixRegex = /\s(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i;
  const titleAlreadyHasMonth = monthSuffixRegex.test(normalizedTitle);
  const displayTitle =
    periodLabel && !titleAlreadyHasMonth ? `${normalizedTitle}-${periodLabel}` : normalizedTitle;

  const iconName = lifecycleIconName(status);
  const iconColor = lifecycleIconColor(status);
  const overduePill = showOverduePill(status, hideUserStatus, rawTaskStatus, dueDate || null);

  return (
    <div
      className={`group relative cursor-pointer rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-slate-800/90 ${
        status === 'completed' ? 'opacity-90' : ''
      }`}
      style={{ minHeight: 126, paddingLeft: 16, paddingRight: 10, paddingTop: 14, paddingBottom: 14 }}
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

      <div className="mt-2.5 flex flex-col gap-2 pr-10">
        <div className="flex w-full items-center justify-between gap-2">
          <h4
            className={`min-w-0 flex-1 text-[19px] font-bold leading-6 text-gray-900 dark:text-white ${
              status === 'completed' ? 'text-gray-500 dark:text-gray-400' : ''
            }`}
            style={{ marginRight: 8 }}
          >
            <span className="line-clamp-1">{displayTitle}</span>
          </h4>
        </div>
        {line1 ? (
          <p className="w-full text-sm leading-[21px] text-gray-500 dark:text-gray-400">
            <span className="line-clamp-1">{line1}</span>
          </p>
        ) : null}
        {line2 ? (
          <p className="w-full text-sm leading-[21px] text-gray-500 dark:text-gray-400">
            <span className="line-clamp-1">{line2}</span>
          </p>
        ) : null}
      </div>

      <div
        className="pointer-events-none absolute right-3 top-1/2 z-[3] -translate-y-1/2"
        aria-hidden
      >
        <span className="material-icons-round text-[20px]" style={{ color: iconColor }}>
          {iconName}
        </span>
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
