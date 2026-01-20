import React from 'react';
import { format } from 'date-fns';

interface ReplyMessageProps {
  replyTo?: {
    id: string;
    content: string;
    senderName?: string;
    senderId?: string;
    messageType?: string;
    createdAt?: string;
  };
  onCancel?: () => void;
}

export const ReplyMessage: React.FC<ReplyMessageProps> = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-l-4 border-primary rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary mb-0.5">
          Replying to {replyTo.senderName || 'Unknown'}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {replyTo.content}
        </p>
      </div>
      <button
        onClick={onCancel}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
};

export const ReplyPreview: React.FC<{
  replyTo?: {
    id: string;
    content: string;
    senderName?: string;
    messageType?: string;
  };
}> = ({ replyTo }) => {
  if (!replyTo) return null;

  return (
    <div className="border-l-4 border-primary/50 pl-2 ml-2 mb-1">
      <p className="text-xs font-semibold text-primary">
        {replyTo.senderName || 'Unknown'}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
        {replyTo.content}
      </p>
    </div>
  );
};

