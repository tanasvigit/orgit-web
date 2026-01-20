import React from 'react';

const COMMON_EMOJIS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  visible: boolean;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose, visible }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-t-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add reaction</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="grid grid-cols-6 gap-4">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="text-4xl hover:scale-125 transition-transform p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

