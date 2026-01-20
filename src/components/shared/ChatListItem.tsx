import React from 'react';
import { Avatar } from './Avatar';
import { format } from 'date-fns';

interface ChatListItemProps {
  id: string;
  name: string;
  lastMessage?: string;
  timestamp?: string;
  avatarUrl?: string;
  isGroup?: boolean;
  isTaskGroup?: boolean;
  unreadCount?: number;
  isOnline?: boolean;
  isPinned?: boolean;
  priority?: string;
  onClick?: () => void;
}

export const ChatListItem: React.FC<ChatListItemProps> = ({
  name,
  lastMessage,
  timestamp,
  avatarUrl,
  isGroup = false,
  isTaskGroup = false,
  unreadCount = 0,
  isOnline,
  isPinned = false,
  priority,
  onClick,
}) => {
  const formatTimestamp = (date?: string) => {
    if (!date) return '';
    const msgDate = new Date(date);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return format(msgDate, 'h:mm a');
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return format(msgDate, 'EEE');
    return format(msgDate, 'MMM d');
  };

  return (
    <div
      className={`group relative flex items-center gap-4 px-4 py-3 transition-colors cursor-pointer ${
        isPinned
          ? 'bg-surface-light dark:bg-surface-dark border-l-4 border-primary'
          : 'bg-background-light dark:bg-background-dark hover:bg-primary/5'
      }`}
      onClick={onClick}
    >
      <div className="relative shrink-0">
        {isTaskGroup ? (
          <div className="relative">
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-xl size-14 shadow-sm"
              style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : {}}
            />
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-dark rounded-full p-0.5">
              <div className="bg-primary text-white rounded-full p-1 flex items-center justify-center size-5">
                <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                  assignment
                </span>
              </div>
            </div>
          </div>
        ) : (
          <Avatar src={avatarUrl} alt={name} size="lg" online={isOnline} />
        )}
      </div>
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-0.5">
          <p className="text-text-main-light dark:text-text-main-dark text-base font-bold leading-normal truncate">
            {name}
          </p>
          {timestamp && (
            <p className="text-primary text-xs font-semibold shrink-0 ml-2">
              {formatTimestamp(timestamp)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {priority && (
            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
              {priority}
            </span>
          )}
          {lastMessage && (
            <p className="text-text-main-light dark:text-text-main-dark text-sm font-medium leading-normal truncate">
              {lastMessage}
            </p>
          )}
        </div>
      </div>
      {unreadCount > 0 && (
        <div className="shrink-0 flex flex-col items-end justify-center gap-1">
          <div className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
            {unreadCount}
          </div>
        </div>
      )}
    </div>
  );
};

