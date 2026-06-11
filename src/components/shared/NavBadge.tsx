import React from 'react';

type Props = {
  count: number;
  className?: string;
};

export const NavBadge: React.FC<Props> = ({ count, className = '' }) => {
  if (!count || count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      className={`absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ${className}`}
      aria-hidden
    >
      {label}
    </span>
  );
};
