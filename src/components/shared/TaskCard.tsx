import React from 'react';
import { StatusBadge } from './StatusBadge';
import { Avatar } from './Avatar';
import { format } from 'date-fns';

interface TaskCardProps {
  id: string;
  title: string;
  description?: string;
  status: 'overdue' | 'duesoon' | 'inprogress' | 'completed';
  dueDate?: string;
  category?: string;
  priority?: string;
  assignees?: Array<{ id: string; name: string; photoUrl?: string }>;
  progress?: number;
  /** Optional finance info (amount + type) to show a small row; mirrors mobile semantics. */
  finance?: { amount?: number | null; type?: 'income' | 'expense' | string | null };
  onClick?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  title,
  description,
  status,
  dueDate,
  category,
  priority,
  assignees = [],
  progress,
  finance,
  onClick,
}) => {
  // Status color mapping with full Tailwind classes (required for build-time class detection)
  const statusColorClasses = {
    overdue: 'bg-status-overdue',
    duesoon: 'bg-status-duesoon',
    inprogress: 'bg-status-inprogress',
    completed: 'bg-status-completed',
  };

  const statusTextColorClasses = {
    overdue: 'text-status-overdue',
    duesoon: 'text-status-duesoon',
    inprogress: 'text-status-inprogress',
    completed: 'text-status-completed',
  };

  const formatDueDate = (date?: string) => {
    if (!date) return null;
    const due = new Date(date);
    const today = new Date();
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return format(due, 'MMM d');
  };

  return (
    <div
      className={`group relative bg-white dark:bg-background-dark-subtle rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow overflow-hidden border border-gray-100 dark:border-white/5 ${
        status === 'completed' ? 'opacity-70 hover:opacity-100' : ''
      } cursor-pointer`}
      onClick={onClick}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusColorClasses[status]}`} />
      <div className="p-4 pl-5">
        <div className="flex justify-between items-start mb-2">
          <StatusBadge status={status} />
          <button
            className="text-gray-400 hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              // Handle menu
            }}
          >
            <span className="material-symbols-outlined text-[20px]">more_horiz</span>
          </button>
        </div>
        <h4
          className={`text-text-main dark:text-white font-bold text-base mb-1 ${
            status === 'completed' ? 'line-through decoration-gray-400 text-gray-500' : ''
          }`}
        >
          {title}
        </h4>
        {description && (
          <p className="text-text-muted dark:text-white/60 text-sm mb-3">
            {category && `${category} • `}
            {description}
          </p>
        )}
        {finance && (finance.amount != null || finance.type) && (
          <div className="flex items-center justify-between gap-2 text-sm mb-3">
            {finance.type && (
              <span className="text-text-muted dark:text-white/60 uppercase tracking-wide text-xs">
                {finance.type === 'income' ? 'Income' : finance.type === 'expense' ? 'Expense' : finance.type}
              </span>
            )}
            {finance.amount != null && (
              <span
                className={`font-bold text-sm ${
                  finance.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : finance.type === 'expense'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-text-main dark:text-white'
                }`}
              >
                {finance.type === 'expense' ? '-' : '+'}
                {Number(finance.amount).toFixed(2)}
              </span>
            )}
          </div>
        )}
        {progress !== undefined && status === 'inprogress' && (
          <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 mb-4">
            <div
              className={`${statusColorClasses[status]} h-1.5 rounded-full`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-50 dark:border-white/5 pt-3">
          <div className={`flex items-center gap-2 ${statusTextColorClasses[status]}`}>
            {dueDate && (
              <>
                <span className="material-symbols-outlined text-[16px]">
                  {status === 'overdue' ? 'event_busy' : status === 'duesoon' ? 'schedule' : 'calendar_today'}
                </span>
                <span className="text-xs font-semibold">{formatDueDate(dueDate)}</span>
              </>
            )}
          </div>
          {assignees.length > 0 && (
            <div className="flex -space-x-2">
              {assignees.slice(0, 3).map((assignee) => (
                <Avatar
                  key={assignee.id}
                  src={assignee.photoUrl}
                  alt={assignee.name}
                  size="sm"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

