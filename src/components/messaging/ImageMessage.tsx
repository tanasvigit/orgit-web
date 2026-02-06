import React, { useState } from 'react';

interface ImageMessageProps {
  mediaUrl: string;
  mediaThumbnail?: string;
  isMyMessage: boolean;
}

export const ImageMessage: React.FC<ImageMessageProps> = ({ mediaUrl, mediaThumbnail, isMyMessage }) => {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const src = mediaUrl || mediaThumbnail;

  return (
    <>
      {/* Thumbnail in message bubble */}
      <button
        type="button"
        onClick={() => src && setIsViewerOpen(true)}
        className={`rounded-2xl overflow-hidden ${isMyMessage ? 'rounded-br-none' : 'rounded-bl-none'} max-w-[280px] focus:outline-none focus:ring-2 focus:ring-primary/60`}
      >
        <img
          src={src}
          alt="Shared image"
          className="w-full h-auto object-cover"
          onError={(e) => {
            e.currentTarget.src = '/placeholder-image.png';
          }}
        />
      </button>

      {/* Full-screen viewer (WhatsApp-style) */}
      {isViewerOpen && src && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center"
          onClick={() => setIsViewerOpen(false)}
        >
          <div
            className="absolute inset-0"
            aria-hidden="true"
          />

          <div
            className="relative z-10 max-w-5xl max-h-[85vh] flex flex-col items-center px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt="Shared image"
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl object-contain"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-image.png';
              }}
            />

            <div className="mt-4 flex items-center gap-3">
              {/* Download button */}
              <a
                href={src}
                download
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 text-gray-900 text-sm font-medium shadow hover:bg-white transition-colors"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>Download</span>
              </a>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setIsViewerOpen(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/80 text-gray-100 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

