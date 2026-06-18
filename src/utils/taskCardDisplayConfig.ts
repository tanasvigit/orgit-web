export const TASK_CARD_DISPLAY_FIELD_KEYS = [
  'title',
  'statusIcon',
  'tagOrClient',
  'dueDate',
  'frequency',
  'taskUnit',
  'assigneeProfiles',
  'unreadBadge',
  'overdueBadge',
] as const;

export type TaskCardDisplayFieldKey = (typeof TASK_CARD_DISPLAY_FIELD_KEYS)[number];

export type TaskCardDisplayConfig = Record<TaskCardDisplayFieldKey, boolean>;

export const DEFAULT_TASK_CARD_DISPLAY: TaskCardDisplayConfig = {
  title: true,
  statusIcon: true,
  tagOrClient: true,
  dueDate: true,
  frequency: true,
  taskUnit: true,
  assigneeProfiles: true,
  unreadBadge: true,
  overdueBadge: true,
};

export const TASK_CARD_DISPLAY_FIELD_LABELS: Record<TaskCardDisplayFieldKey, string> = {
  title: 'Task title',
  statusIcon: 'Status icon',
  tagOrClient: 'Tags / client',
  dueDate: 'Due date',
  frequency: 'Frequency',
  taskUnit: 'Organization unit',
  assigneeProfiles: 'Assignee profiles',
  unreadBadge: 'Unread messages badge',
  overdueBadge: 'Overdue badge',
};

export function mergeTaskCardDisplayConfig(stored: unknown): TaskCardDisplayConfig {
  const base = { ...DEFAULT_TASK_CARD_DISPLAY };
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return base;
  }
  const raw = stored as Record<string, unknown>;
  for (const key of TASK_CARD_DISPLAY_FIELD_KEYS) {
    if (typeof raw[key] === 'boolean') {
      base[key] = raw[key];
    }
  }
  return base;
}
