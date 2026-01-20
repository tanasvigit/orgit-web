import React from 'react';

interface MessageReactionsProps {
  reactions?: Array<{ reaction: string; count: number; users: string[] }>;
  messageId: string;
  onAddReaction?: (reaction: string) => void;
  onRemoveReaction?: (reaction: string) => void;
}

const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions = [],
  messageId,
  onAddReaction,
  onRemoveReaction,
}) => {
  if (reactions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((reaction, index) => (
        <button
          key={`${reaction.reaction}-${index}`}
          onClick={() => onRemoveReaction?.(reaction.reaction)}
          className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <span>{reaction.reaction}</span>
          <span className="text-gray-600 dark:text-gray-400">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
};

export const ReactionPicker: React.FC<{
  onSelect: (reaction: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex gap-2 border border-gray-200 dark:border-gray-700 z-50">
      {COMMON_REACTIONS.map((reaction) => (
        <button
          key={reaction}
          onClick={() => {
            onSelect(reaction);
            onClose();
          }}
          className="text-2xl hover:scale-125 transition-transform p-1"
        >
          {reaction}
        </button>
      ))}
    </div>
  );
};

