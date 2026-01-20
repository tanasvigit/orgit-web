import React from 'react';

type StatusType = 'overdue' | 'duesoon' | 'inprogress' | 'completed';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { bg: string; text: string; label: string }> = {
  overdue: {
    bg: 'bg-status-overdue/10',
    text: 'text-status-overdue',
    label: 'Over Due',
  },
  duesoon: {
    bg: 'bg-status-duesoon/10',
    text: 'text-status-duesoon',
    label: 'Due Soon',
  },
  inprogress: {
    bg: 'bg-status-inprogress/10',
    text: 'text-status-inprogress',
    label: 'In Progress',
  },
  completed: {
    bg: 'bg-status-completed/10',
    text: 'text-status-completed',
    label: 'Completed',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${config.bg} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  );
};

