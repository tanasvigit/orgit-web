import React from 'react';

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'size-6',
  md: 'size-10',
  lg: 'size-14',
  xl: 'size-32',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  size = 'md',
  online,
  className = '',
}) => {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`bg-center bg-no-repeat bg-cover rounded-full ${sizeClasses[size]} ${
          src ? '' : 'bg-gray-200 dark:bg-gray-700'
        } shadow-sm border-2 border-white dark:border-surface-dark`}
        style={src ? { backgroundImage: `url(${src})` } : {}}
        role="img"
        aria-label={alt}
      />
      {online !== undefined && (
        <div
          className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-white dark:border-background-dark ${
            online ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      )}
    </div>
  );
};

