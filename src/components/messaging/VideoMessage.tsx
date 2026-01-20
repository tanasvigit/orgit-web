import React from 'react';

interface VideoMessageProps {
  mediaUrl: string;
  mediaThumbnail?: string;
  isMyMessage: boolean;
}

export const VideoMessage: React.FC<VideoMessageProps> = ({ mediaUrl, mediaThumbnail, isMyMessage }) => {
  return (
    <div className={`relative rounded-2xl overflow-hidden ${isMyMessage ? 'rounded-br-none' : 'rounded-bl-none'} max-w-[280px]`}>
      {mediaThumbnail ? (
        <>
          <img
            src={mediaThumbnail}
            alt="Video thumbnail"
            className="w-full h-auto object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="bg-white/90 rounded-full p-3">
              <span className="material-symbols-outlined text-primary text-2xl">play_arrow</span>
            </div>
          </div>
        </>
      ) : (
        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-gray-400">play_circle</span>
        </div>
      )}
    </div>
  );
};

