import React from 'react';

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
    <div className="w-full rounded-2xl border border-[#E7D9FF] bg-[#F8F5FF] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-semibold text-primary">
            Replying to {replyTo.senderName || 'Unknown'}
          </p>
          <p className="truncate text-sm text-[#1F2937]">
            {replyTo.content}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="shrink-0 rounded-md border border-[#E7D9FF] bg-white px-2 py-1 text-xs font-semibold text-primary"
        >
          Close
        </button>
      </div>
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
    <div className="mb-1 ml-2 w-full max-w-[85%] rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3 py-2">
      <p className="text-xs font-semibold text-[#1F2937]">
        {replyTo.senderName || 'Unknown'}
      </p>
      <p className="truncate text-xs text-[#6B7280]">
        {replyTo.content}
      </p>
    </div>
  );
};

