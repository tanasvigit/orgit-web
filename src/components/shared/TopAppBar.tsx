import React from 'react';

interface TopAppBarProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  className?: string;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  title,
  onBack,
  rightAction,
  className = '',
}) => {
  return (
    <div className={`flex items-center bg-background-light dark:bg-background-dark p-4 pb-2 justify-between sticky top-0 z-10 ${className}`}>
      {onBack ? (
        <button
          onClick={onBack}
          className="text-slate-900 dark:text-white flex size-12 shrink-0 items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
      ) : (
        <div className="w-12" />
      )}
      <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-12">
        {title}
      </h2>
      {rightAction ? (
        <div className="w-12 flex justify-end">{rightAction}</div>
      ) : (
        <div className="w-12" />
      )}
    </div>
  );
};

