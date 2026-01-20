import React from 'react';

interface MessageOptionsProps {
  messageId: string;
  isMyMessage: boolean;
  isGroup: boolean;
  onEdit?: () => void;
  onDelete?: (deleteForEveryone: boolean) => void;
  onForward?: () => void;
  onReply?: () => void;
  onStar?: (isStarred: boolean) => void;
  onPin?: (isPinned: boolean) => void;
  onAddReaction?: () => void;
  isStarred?: boolean;
  isPinned?: boolean;
  onClose: () => void;
}

export const MessageOptions: React.FC<MessageOptionsProps> = ({
  messageId,
  isMyMessage,
  isGroup,
  onEdit,
  onDelete,
  onForward,
  onReply,
  onStar,
  onPin,
  onAddReaction,
  isStarred = false,
  isPinned = false,
  onClose,
}) => {
  return (
    <div className="absolute right-0 top-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-[180px]">
      {onReply && (
        <button
          onClick={() => {
            onReply();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="material-symbols-outlined text-lg">reply</span>
          <span>Reply</span>
        </button>
      )}
      
      {onForward && (
        <button
          onClick={() => {
            onForward();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="material-symbols-outlined text-lg">forward</span>
          <span>Forward</span>
        </button>
      )}

      {onAddReaction && (
        <button
          onClick={() => {
            onAddReaction();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="material-symbols-outlined text-lg">add_reaction</span>
          <span>Add Reaction</span>
        </button>
      )}

      {onStar && (
        <button
          onClick={() => {
            onStar(!isStarred);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="material-symbols-outlined text-lg">{isStarred ? 'star' : 'star_border'}</span>
          <span>{isStarred ? 'Unstar' : 'Star'}</span>
        </button>
      )}

      {isGroup && onPin && (
        <button
          onClick={() => {
            onPin(!isPinned);
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="material-symbols-outlined text-lg">{isPinned ? 'push_pin' : 'push_pin'}</span>
          <span>{isPinned ? 'Unpin' : 'Pin'}</span>
        </button>
      )}

      {isMyMessage && onEdit && (
        <button
          onClick={() => {
            onEdit();
            onClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-gray-700 dark:text-gray-300"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          <span>Edit</span>
        </button>
      )}

      {isMyMessage && onDelete && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          <button
            onClick={() => {
              onDelete(false);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-red-600 dark:text-red-400"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            <span>Delete for me</span>
          </button>
          <button
            onClick={() => {
              onDelete(true);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-sm text-red-600 dark:text-red-400"
          >
            <span className="material-symbols-outlined text-lg">delete_forever</span>
            <span>Delete for everyone</span>
          </button>
        </>
      )}

      {!isMyMessage && onDelete && (
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
      )}
    </div>
  );
};

