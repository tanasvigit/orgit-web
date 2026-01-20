import React, { useState } from 'react';

interface VoiceMessageProps {
  mediaUrl?: string;
  duration?: number;
  isMyMessage: boolean;
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({ mediaUrl, duration, isMyMessage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className={`bg-primary text-white p-3 rounded-2xl ${isMyMessage ? 'rounded-br-none' : 'rounded-bl-none'} w-64`}>
      <div className="flex items-center gap-3">
        <button
          onClick={handlePlay}
          className="flex items-center justify-center size-8 bg-white text-primary rounded-full shrink-0 shadow-sm hover:scale-105 transition-transform"
        >
          <span className={`material-symbols-outlined ${isPlaying ? 'fill' : ''}`}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>
        <div className="flex-1 flex items-center gap-1 h-6 overflow-hidden opacity-90">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-white rounded-full ${
                i < 8 ? 'opacity-100' : 'opacity-50'
              }`}
              style={{
                height: `${Math.floor(Math.random() * 4) + 2}px`,
              }}
            />
          ))}
        </div>
        <span className="text-xs font-medium tabular-nums text-white/90 shrink-0">
          {formatDuration(duration)}
        </span>
      </div>
      {mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
};

