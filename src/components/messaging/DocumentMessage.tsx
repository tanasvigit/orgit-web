import React from 'react';

interface DocumentMessageProps {
  fileName?: string;
  fileSize?: number;
  mediaUrl?: string;
  isMyMessage: boolean;
}

export const DocumentMessage: React.FC<DocumentMessageProps> = ({ fileName, fileSize, mediaUrl, isMyMessage }) => {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 p-3 rounded-2xl ${isMyMessage ? 'rounded-br-none' : 'rounded-bl-none'} border border-gray-200 dark:border-gray-700 max-w-[280px]`}>
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-red-500 text-2xl">picture_as_pdf</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {fileName || 'Document'}
          </p>
          {fileSize && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(fileSize)}
            </p>
          )}
        </div>
        {mediaUrl && (
          <a
            href={mediaUrl}
            download={fileName}
            className="size-8 rounded-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex items-center justify-center text-gray-700 dark:text-gray-200 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-lg">download</span>
          </a>
        )}
      </div>
    </div>
  );
};

