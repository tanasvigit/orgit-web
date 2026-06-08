import {
  APP_ICON_SRC,
  TASK_STATUS_ICON_VISUAL_SCALE,
  taskStatusToAppIcon,
  type TaskStatusAppIconName,
} from '../../constants/appIcons';
import type { TaskStatusCategory } from '../../utils/taskStatus';

/** Task statuses shown on dashboard stat cards (excludes scheduled). */
export type DashboardTaskStatStatus = Exclude<TaskStatusCategory, 'scheduled'>;

const CARD_ICON_PX = 22;

const TINT_CLASS: Record<TaskStatusAppIconName, string> = {
  todo: 'bg-blue-600 dark:bg-blue-400',
  inprogress: 'bg-purple-600 dark:bg-purple-400',
  duesoon: 'bg-amber-600 dark:bg-amber-400',
  overdue: 'bg-red-600 dark:bg-red-400',
  completed: 'bg-emerald-600 dark:bg-emerald-400',
};

const CIRCLE_CLASS: Record<TaskStatusAppIconName, string> = {
  todo: 'bg-blue-100 ring-1 ring-blue-200/70 dark:bg-blue-900/30 dark:ring-blue-800/50',
  inprogress:
    'bg-purple-100 ring-1 ring-purple-200/70 dark:bg-purple-900/30 dark:ring-purple-800/50',
  duesoon:
    'bg-amber-100 ring-1 ring-amber-200/70 dark:bg-amber-900/30 dark:ring-amber-800/50',
  overdue: 'bg-red-100 ring-1 ring-red-200/70 dark:bg-red-900/30 dark:ring-red-800/50',
  completed:
    'bg-emerald-100 ring-1 ring-emerald-200/70 dark:bg-emerald-900/30 dark:ring-emerald-800/50',
};

/** Duesoon opacity softens the hourglass fill on tinted dashboard circles. */
const ICON_VISUAL_CLASS: Partial<Record<TaskStatusAppIconName, string>> = {
  duesoon: 'opacity-[0.58]',
};

export function getTaskStatusCardCircleClass(status: DashboardTaskStatStatus): string {
  const name = taskStatusToAppIcon(status);
  return name ? CIRCLE_CLASS[name] : '';
}

export interface TaskStatusCardIconProps {
  status: DashboardTaskStatStatus;
  /** Pixel size inside the circle; defaults to card size. */
  size?: number;
}

export function TaskStatusCardIcon({ status, size = CARD_ICON_PX }: TaskStatusCardIconProps) {
  const name = taskStatusToAppIcon(status);
  if (!name) return null;

  const src = APP_ICON_SRC[name];
  const soften = ICON_VISUAL_CLASS[name] ?? '';
  const visualScale = TASK_STATUS_ICON_VISUAL_SCALE[name];
  const maskSize = `${Math.round(visualScale * 100)}%`;

  return (
    <span
      role="img"
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center overflow-visible ${soften}`}
      style={{ width: size, height: size }}
    >
      <span
        className={`inline-block bg-center bg-no-repeat ${TINT_CLASS[name]}`}
        style={{
          width: size,
          height: size,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskSize: maskSize,
          maskSize,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
        }}
      />
    </span>
  );
}
