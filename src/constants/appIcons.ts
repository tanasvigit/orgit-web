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
