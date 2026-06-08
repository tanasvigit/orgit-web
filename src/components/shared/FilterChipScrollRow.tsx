import React, { useCallback, useEffect, useRef, useState } from 'react';

type FilterChipScrollRowProps = {
  children: React.ReactNode;
  className?: string;
  scrollAmount?: number;
};

export function FilterChipScrollRow({
  children,
  className = '',
  scrollAmount = 160,
}: FilterChipScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, children]);

  const scrollBy = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
  };

  const arrowButtonClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-opacity hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-0 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        disabled={!canScrollLeft}
        className={arrowButtonClass}
        aria-label="Scroll filters left"
      >
        <span className="material-icons-outlined text-base leading-none">chevron_left</span>
      </button>

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
        <div className="flex w-max min-w-full flex-nowrap gap-1">{children}</div>
      </div>

      <button
        type="button"
        onClick={() => scrollBy(1)}
        disabled={!canScrollRight}
        className={arrowButtonClass}
        aria-label="Scroll filters right"
      >
        <span className="material-icons-outlined text-base leading-none">chevron_right</span>
      </button>
    </div>
  );
}
