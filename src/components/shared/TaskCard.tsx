import React from 'react';
import { StatusBadge } from './StatusBadge';
import { Avatar } from './Avatar';
import { formatTaskDueLabel } from '../../utils/chatTime';

interface TaskCardProps {
  id: string;
  title: string;
  clientName?: string;
  tags?: string[] | string;
  description?: string;
  status: 'scheduled' | 'overdue' | 'duesoon' | 'inprogress' | 'completed';
  dueDate?: string;
  category?: string;
  priority?: string;
  assignees?: Array<{ id: string; name: string; photoUrl?: string }>;
  progress?: number;
  /** Optional finance info (amount + type) to show a small row; mirrors mobile semantics. */
  finance?: { amount?: number | null; type?: 'income' | 'expense' | string | null };
  unreadCount?: number;
  taskPeriod?: string;
  frequency?: string;
  taskUnitType?: string;
  taskUnitName?: string;
  onClick?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  title,
  clientName,
  tags,
  description,
  status,
  dueDate,
  category,
  priority,
  assignees = [],
  progress,
  finance,
  unreadCount = 0,
  taskPeriod,
  frequency,
  taskUnitType,
  taskUnitName,
  onClick,
}) => {
  // Status color mapping with full Tailwind classes (required for build-time class detection)
  const statusColorClasses = {
    scheduled: 'bg-indigo-500',
    overdue: 'bg-status-overdue',
    duesoon: 'bg-status-duesoon',
    inprogress: 'bg-status-inprogress',
    completed: 'bg-status-completed',
  };

  const statusTextColorClasses = {
    scheduled: 'text-indigo-600 dark:text-indigo-300',
    overdue: 'text-status-overdue',
    duesoon: 'text-status-duesoon',
    inprogress: 'text-status-inprogress',
    completed: 'text-status-completed',
  };

  const formatDueDate = (date?: string) => {
    if (!date) return null;
    return formatTaskDueLabel(date);
  };

  const periodLabel = (taskPeriod || '').toLowerCase();
  const statusIcon =
    status === 'overdue'
      ? 'priority_high'
      : status === 'duesoon'
      ? 'schedule'
      : status === 'completed'
      ? 'task_alt'
      : status === 'scheduled'
      ? 'event_upcoming'
      : 'pending_actions';
  const tagOrClient = (() => {
    const tagText = Array.isArray(tags) ? tags.filter(Boolean).join(', ') : typeof tags === 'string' ? tags : '';
    return (tagText || clientName || '').trim() || '';
  })();
  const dueText = formatDueDate(dueDate || '') || 'No due date';
  const frequencyLabel = (frequency || 'One-time').replace(/_/g, ' ');
  const unitTypeLabel = taskUnitType || 'Task unit';
  const unitNameLabel = taskUnitName || '';
  const normalizedTitle = String(title || '').trim();
  const monthSuffixRegex = /\s(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/i;
  const titleAlreadyHasMonth = monthSuffixRegex.test(normalizedTitle);
  const displayTitle =
    periodLabel && !titleAlreadyHasMonth ? `${normalizedTitle}-${periodLabel}` : normalizedTitle;

  return (
    <div
      className={`group relative bg-white dark:bg-slate-800/80 rounded-2xl overflow-hidden cursor-pointer
        border-2 border-slate-200/90 dark:border-slate-600/80
        shadow-lg shadow-slate-200/20 dark:shadow-slate-900/40
        transition-all duration-300 ease-out
        hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/40
        ${status === 'completed' ? 'opacity-75 hover:opacity-100' : ''}`}
      onClick={onClick}
    >
      <div className="p-5 pl-6">
        <div className="flex justify-between items-start mb-2 gap-2">
          <h4
            className={`text-text-main dark:text-white font-bold text-base ${
              status === 'completed' ? 'line-through decoration-gray-400 text-gray-500' : ''
            }`}
          >
            {displayTitle}
          </h4>
        </div>
        <div className="flex justify-between items-center mb-3">
          <div className="inline-flex items-center gap-2">
            <StatusBadge status={status} />
            <span className={`material-symbols-outlined text-[18px] ${statusTextColorClasses[status]}`}>{statusIcon}</span>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
          <p>{`${tagOrClient} | ${dueText}`}</p>
          <p>{`${frequencyLabel} | ${unitTypeLabel} | ${unitNameLabel}`}</p>
        </div>
      </div>
    </div>
  );
};

