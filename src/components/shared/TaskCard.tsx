import React from 'react';
import { StatusBadge } from './StatusBadge';
import { Avatar } from './Avatar';
import { formatTaskDueLabel } from '../../utils/chatTime';

interface TaskCardProps {
  id: string;
  title: string;
  clientName?: string;
  description?: string;
  status: 'scheduled' | 'overdue' | 'duesoon' | 'inprogress' | 'completed';
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
  clientName,
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
      <div className={`absolute left-0 top-0 bottom-0 w-2 rounded-l-2xl ${statusColorClasses[status]} shadow-sm`} />
      <div className="p-5 pl-6">
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
        {clientName && (
          <p className="text-text-muted dark:text-white/70 text-sm mb-1">
            Client: <span className="font-bold text-text-main dark:text-white">{clientName}</span>
          </p>
        )}
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
          <div className="w-full bg-slate-100 dark:bg-slate-600/30 rounded-full h-2 mb-4">
            <div
              className={`${statusColorClasses[status]} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-600/50 pt-3 mt-1">
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

