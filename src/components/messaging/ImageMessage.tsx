import React from 'react';

interface ImageMessageProps {
  mediaUrl: string;
  mediaThumbnail?: string;
  isMyMessage: boolean;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({ mediaUrl, mediaThumbnail, isMyMessage }) => {
  return (
    <div className={`rounded-2xl overflow-hidden ${isMyMessage ? 'rounded-br-none' : 'rounded-bl-none'} max-w-[280px]`}>
      <img
        src={mediaUrl || mediaThumbnail}
        alt="Shared image"
        className="w-full h-auto object-cover"
        onError={(e) => {
          e.currentTarget.src = '/placeholder-image.png';
        }}
      />
    </div>
  );
};

