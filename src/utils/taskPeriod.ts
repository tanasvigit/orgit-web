export type TaskPeriodTaskLike = {
  title?: string | null;
  task_type?: string | null;
  taskType?: string | null;
  recurrence_type?: string | null;
  frequency?: string | null;
  task_frequency?: string | null;
  start_date?: string | Date | null;
  startDate?: string | Date | null;
  due_date?: string | Date | null;
  dueDate?: string | Date | null;
};

export type RecurrencePeriodKind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one_time';

const MONTH_ABBREVS = new Set([
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]);

const MONTH_SHORT = (date: Date) =>
  date.toLocaleString('en-US', { month: 'short' });

/** Strip cycle suffix embedded in stored recurring task titles (e.g. "daily jun" → "daily"). */
export const extractBaseTaskTitle = (title: string): string => {
  const t = (title || '').trim();
  if (!t) return t;
  const dashMonth = t.match(/^(.*)\s+[-–—]\s+([a-z]{3})\s*$/i);
  if (dashMonth) {
    const maybeMon = dashMonth[2].toLowerCase();
    if (MONTH_ABBREVS.has(maybeMon)) {
      return dashMonth[1].trim() || t;
    }
  }
  const dailySuffix = t.match(/^(.*)\s+(\d{1,2})\s+([a-z]{3})\s*$/i);
  if (dailySuffix) {
    const maybeMon = dailySuffix[3].toLowerCase();
    if (MONTH_ABBREVS.has(maybeMon)) {
      return dailySuffix[1].trim() || t;
    }
  }
  const parts = t.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase().replace(/\.$/, '');
    if (last.length === 3 && MONTH_ABBREVS.has(last)) {
      return parts.slice(0, -1).join(' ').trim() || t;
    }
  }
  return t;
};

const parseAnchorDate = (task: TaskPeriodTaskLike): Date | null => {
  const raw =
    task.start_date ||
    task.startDate ||
    task.due_date ||
    task.dueDate ||
    null;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const resolveRecurrencePeriodKind = (task: TaskPeriodTaskLike): RecurrencePeriodKind => {
  const taskType = String(task.task_type || task.taskType || '').toLowerCase();
  if (taskType === 'one_time') return 'one_time';

  const raw = String(
    task.recurrence_type || task.frequency || task.task_frequency || ''
  )
    .toLowerCase()
    .trim();

  if (raw === 'daily') return 'daily';
  if (raw === 'weekly' || raw === 'specific_weekday') return 'weekly';
  if (raw === 'monthly' || raw === 'quarterly') return 'monthly';
  if (raw === 'yearly' || raw === 'annually') return 'yearly';

  if (taskType === 'recurring' || taskType === 'recurring_instance') {
    return 'monthly';
  }

  return 'one_time';
};

const getISOWeekNumber = (date: Date): number => {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

/** Previous calendar month (e.g. June cycle → May bill period). Display only. */
export const shiftToPreviousCalendarMonth = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth() - 1, 1);

const resolveRecurrenceRaw = (task: TaskPeriodTaskLike): string =>
  String(task.recurrence_type || task.frequency || task.task_frequency || '')
    .toLowerCase()
    .trim();

/**
 * Monthly recurring tasks show the prior month's bill period (e.g. created in June → May).
 * Applies to manual and auto-generated recurring instances. Not stored in DB.
 */
export const shouldDisplayPreviousMonthPeriod = (task: TaskPeriodTaskLike): boolean => {
  const raw = resolveRecurrenceRaw(task);
  if (raw === 'quarterly') return false;
  if (raw === 'monthly') return true;
  const taskType = String(task.task_type || task.taskType || '').toLowerCase();
  if (taskType === 'recurring' || taskType === 'recurring_instance') {
    return resolveRecurrencePeriodKind(task) === 'monthly';
  }
  return false;
};

/** Format task period label from recurrence kind and cycle anchor date. */
export const formatTaskPeriod = (
  kind: RecurrencePeriodKind,
  anchorDate: Date,
  options?: { previousMonthForMonthly?: boolean }
): string => {
  switch (kind) {
    case 'daily':
      return `${anchorDate.getDate()} ${MONTH_SHORT(anchorDate).toLowerCase()} ${anchorDate.getFullYear()}`;
    case 'weekly': {
      const week = getISOWeekNumber(anchorDate);
      return `Week ${week}, ${MONTH_SHORT(anchorDate)} ${anchorDate.getFullYear()}`;
    }
    case 'monthly': {
      const periodDate =
        options?.previousMonthForMonthly === true
          ? shiftToPreviousCalendarMonth(anchorDate)
          : anchorDate;
      return `${MONTH_SHORT(periodDate)} ${periodDate.getFullYear()}`;
    }
    case 'yearly':
      return String(anchorDate.getFullYear());
    default:
      return '';
  }
};

/** Returns empty string for one-time tasks. */
export const formatTaskPeriodFromTask = (task: TaskPeriodTaskLike | null | undefined): string => {
  if (!task) return '';
  const kind = resolveRecurrencePeriodKind(task);
  if (kind === 'one_time') return '';
  const anchor = parseAnchorDate(task);
  if (!anchor) return '';
  return formatTaskPeriod(kind, anchor, {
    previousMonthForMonthly: shouldDisplayPreviousMonthPeriod(task),
  });
};

const FREQUENCY_DISPLAY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  quarterly: 'Quarterly',
  annually: 'Yearly',
  'one-time': 'One-Time',
  one_time: 'One-Time',
  recurring: 'Recurring',
  custom: 'Custom',
  specific_weekday: 'Weekly',
  'specific-weekday': 'Weekly',
};

/** Display label for task card frequency (Daily, Weekly, Monthly, Yearly, One-Time, …). */
export const formatFrequencyLabel = (frequency: string | null | undefined): string => {
  const raw = String(frequency ?? '').trim();
  if (!raw) return 'One-Time';

  const key = raw.toLowerCase().replace(/_/g, '-');
  if (FREQUENCY_DISPLAY_LABELS[key]) return FREQUENCY_DISPLAY_LABELS[key];

  const spaced = raw.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

export const resolveTaskTitleWithPeriod = (
  task: TaskPeriodTaskLike | null | undefined,
  fallbackTitle = 'Untitled Task'
): string => {
  const rawTitle = String(task?.title || fallbackTitle).trim() || 'Untitled Task';
  const baseTitle = extractBaseTaskTitle(rawTitle);
  const period = formatTaskPeriodFromTask(task);
  if (!period) return baseTitle;
  return `${baseTitle} - ${period}`;
};
