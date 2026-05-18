type Props = {
  selfCount: number;
  assignedCount: number;
};

function CalendarCountColumn({ label, title, count }: { label: string; title?: string; count: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1">
      <span
        title={title}
        className="w-full truncate text-center text-[7px] font-semibold uppercase leading-none tracking-wide text-gray-500 dark:text-gray-400"
      >
        {label}
      </span>
      <span
        className={`flex min-h-[14px] items-center justify-center text-[11px] font-bold tabular-nums leading-none ${
          count > 0 ? 'text-primary dark:text-indigo-300' : 'text-gray-300 dark:text-gray-600'
        }`}
        aria-hidden={count <= 0}
      >
        {count > 0 ? count : '·'}
      </span>
    </div>
  );
}

/** Self / Assigned task counts for a single calendar day cell. */
export function DashboardCalendarDayBadge({ selfCount, assignedCount }: Props) {
  if (selfCount <= 0 && assignedCount <= 0) return null;

  return (
    <div
      className="mt-1 flex overflow-hidden rounded-md border border-primary/30 bg-primary/5 dark:bg-primary/10"
      role="group"
      aria-label={`Self tasks due: ${selfCount}, Assigned tasks due: ${assignedCount}`}
    >
      <CalendarCountColumn label="Self" count={selfCount} />
      <div className="w-px shrink-0 self-stretch bg-primary/25 dark:bg-primary/35" aria-hidden />
      <CalendarCountColumn label="Asgn" title="Assigned" count={assignedCount} />
    </div>
  );
}
