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
  onClick,
}) => {
  const statusColorMap = {
    overdue: 'status-overdue',
    duesoon: 'status-duesoon',
    inprogress: 'status-inprogress',
    completed: 'status-completed',
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
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-${statusColorMap[status]}`} />
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
            {priority && `${priority} Priority`}
          </p>
        )}
        {progress !== undefined && status === 'inprogress' && (
          <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 mb-4">
            <div
              className={`bg-${statusColorMap[status]} h-1.5 rounded-full`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-50 dark:border-white/5 pt-3">
          <div className="flex items-center gap-2 text-status-overdue">
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

