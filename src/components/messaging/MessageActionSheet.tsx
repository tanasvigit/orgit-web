import React from 'react';

interface MessageActionSheetProps {
  visible: boolean;
  isMyMessage: boolean;
  isGroup: boolean;
  isStarred?: boolean;
  onReply?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: (deleteForEveryone: boolean) => void;
  onStar?: () => void;
  onReact?: () => void;
  onForward?: () => void;
  onClose: () => void;
}

export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({
  visible,
  isMyMessage,
  isGroup,
  isStarred = false,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onStar,
  onReact,
  onForward,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="py-2">
          {onReply && (
            <button
              onClick={() => {
                onReply();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-gray-900 dark:text-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">reply</span>
              <span>Reply</span>
            </button>
          )}

          {onCopy && (
            <button
              onClick={() => {
                onCopy();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-gray-900 dark:text-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">content_copy</span>
              <span>Copy</span>
            </button>
          )}

          {onForward && (
            <button
              onClick={() => {
                onForward();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-gray-900 dark:text-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">forward</span>
              <span>Forward</span>
            </button>
          )}

          {onReact && (
            <button
              onClick={() => {
                onReact();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-gray-900 dark:text-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">add_reaction</span>
              <span>React</span>
            </button>
          )}

          {onStar && (
            <button
              onClick={() => {
                onStar();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-gray-900 dark:text-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">{isStarred ? 'star' : 'star_border'}</span>
              <span>{isStarred ? 'Unstar' : 'Star'}</span>
            </button>
          )}

          {isMyMessage && onEdit && (
            <button
              onClick={() => {
                onEdit();
                onClose();
              }}
              className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-gray-900 dark:text-gray-100"
            >
              <span className="material-symbols-outlined text-2xl">edit</span>
              <span>Edit</span>
            </button>
          )}

          {isMyMessage && onDelete && (
            <>
              <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
              <button
                onClick={() => {
                  onDelete(false);
                  onClose();
                }}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-red-600 dark:text-red-400"
              >
                <span className="material-symbols-outlined text-2xl">delete</span>
                <span>Delete for me</span>
              </button>
              <button
                onClick={() => {
                  onDelete(true);
                  onClose();
                }}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-base text-red-600 dark:text-red-400"
              >
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
                <span>Delete for everyone</span>
              </button>
            </>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-700 text-base font-semibold text-gray-900 dark:text-gray-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

