import type { TaskStatusCategory } from '../utils/taskStatus';

import chatIcon from '../../assets/chat.svg';
import completedIcon from '../../assets/completed.svg';
import dashboardIcon from '../../assets/dashboard.svg';
import documentIcon from '../../assets/document.svg';
import duesoonIcon from '../../assets/duesoon.svg';
import inprogressIcon from '../../assets/inprogress.svg';
import overdueIcon from '../../assets/overdue.svg';
import settingsIcon from '../../assets/settings.svg';
import taskIcon from '../../assets/task.svg';
import todoIcon from '../../assets/todo.svg';

/** Custom SVG icons shipped under `orgit-web/assets/`. */
export type AppIconName =
  | 'dashboard'
  | 'chat'
  | 'task'
  | 'document'
  | 'settings'
  | 'todo'
  | 'inprogress'
  | 'duesoon'
  | 'overdue'
  | 'completed';

export type TaskStatusAppIconName = 'todo' | 'inprogress' | 'duesoon' | 'overdue' | 'completed';

/**
 * Normalize task-status artwork to match duesoon visual weight in list/card slots.
 * Todo SVG uses a wide viewBox (1536×1024) so it reads smaller without a boost.
 */
export const TASK_STATUS_ICON_VISUAL_SCALE: Record<TaskStatusAppIconName, number> = {
  todo: 1.45,
  inprogress: 1.18,
  duesoon: 1.0,
  overdue: 1.12,
  completed: 1.12,
};

export const APP_ICON_SRC: Record<AppIconName, string> = {
  dashboard: dashboardIcon,
  chat: chatIcon,
  task: taskIcon,
  document: documentIcon,
  settings: settingsIcon,
  todo: todoIcon,
  inprogress: inprogressIcon,
  duesoon: duesoonIcon,
  overdue: overdueIcon,
  completed: completedIcon,
};

export function taskStatusToAppIcon(
  status: TaskStatusCategory | null | undefined
): TaskStatusAppIconName | null {
  switch (status) {
    case 'todo':
      return 'todo';
    case 'inprogress':
      return 'inprogress';
    case 'duesoon':
      return 'duesoon';
    case 'overdue':
      return 'overdue';
    case 'completed':
      return 'completed';
    default:
      return null;
  }
}
