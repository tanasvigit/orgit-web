import { extractBaseTaskTitle, formatTaskPeriodFromTask } from './taskPeriod';
import { getTaskStatusCategoryFromTask, type TaskStatusCategory } from './taskStatus';

export const TASK_ANALYTICS_REPORT_TITLE = 'Task Analytics Report';

export type AnalyticsStatusKey = 'todo' | 'inprogress' | 'duesoon' | 'overdue' | 'completed';

export const TASK_ANALYTICS_STATUS_COLUMNS: { key: AnalyticsStatusKey; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'duesoon', label: 'Due Soon' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
];

export type TaskAnalyticsFilters = {
  employeeId: string;
  client: string;
  serviceCategory: string;
  taskPeriod: string;
};

export const EMPTY_TASK_ANALYTICS_FILTERS: TaskAnalyticsFilters = {
  employeeId: '',
  client: '',
  serviceCategory: '',
  taskPeriod: '',
};

export type FilterOption = { value: string; label: string };

export type TaskAnalyticsTableRow = {
  id: string;
  label: string;
  counts: Record<AnalyticsStatusKey, number>;
  total: number;
};

type EmployeeEntry = { id: string; name: string };

function emptyCounts(): Record<AnalyticsStatusKey, number> {
  return { todo: 0, inprogress: 0, duesoon: 0, overdue: 0, completed: 0 };
}

function normalizeTags(task: any): string[] {
  const raw = task?.tags;
  if (Array.isArray(raw)) return raw.map((t) => String(t || '').trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function humanizeCategory(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getTaskClientName(task: any): string {
  const client = String(task?.client_name || task?.clientName || '').trim();
  if (client) return client;
  const tags = normalizeTags(task);
  return tags[0] || '';
}

export function getTaskServiceCategory(task: any): string {
  const tags = normalizeTags(task);
  if (tags.length > 1) return tags[1];
  const base = extractBaseTaskTitle(String(task?.title || '').trim());
  if (base) return base;
  const category = String(task?.category || '').trim();
  if (category && category !== 'general') return humanizeCategory(category);
  return 'Uncategorized';
}

export function getTaskPeriodLabel(task: any): string {
  const period = formatTaskPeriodFromTask(task);
  return period || 'One-Time';
}

export function getTaskEmployees(task: any): EmployeeEntry[] {
  const map = new Map<string, string>();
  const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
  assignees.forEach((a: any) => {
    const id = String(a?.id || a?.user_id || a?.userId || '').trim();
    if (!id) return;
    const name = String(a?.name || a?.user_name || a?.username || a?.mobile || 'Employee').trim();
    map.set(id, name || 'Employee');
  });
  const creatorId = String(task?.created_by || task?.creator_id || '').trim();
  if (creatorId && !map.has(creatorId)) {
    const creatorName = String(task?.creator_name || task?.creatorName || 'Creator').trim();
    map.set(creatorId, creatorName || 'Creator');
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterTasksForAnalytics(tasks: any[], filters: TaskAnalyticsFilters): any[] {
  return (tasks || []).filter((task) => {
    if (!task?.id) return false;
    if (filters.employeeId) {
      const employees = getTaskEmployees(task);
      if (!employees.some((e) => e.id === filters.employeeId)) return false;
    }
    if (filters.client && getTaskClientName(task) !== filters.client) return false;
    if (filters.serviceCategory && getTaskServiceCategory(task) !== filters.serviceCategory) {
      return false;
    }
    if (filters.taskPeriod && getTaskPeriodLabel(task) !== filters.taskPeriod) return false;
    return true;
  });
}

function uniqueSortedOptions(values: string[]): FilterOption[] {
  const set = new Set<string>();
  values.forEach((v) => {
    const trimmed = String(v || '').trim();
    if (trimmed) set.add(trimmed);
  });
  return Array.from(set)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
}

export function getCascadingFilterOptions(tasks: any[], filters: TaskAnalyticsFilters) {
  const allTasks = tasks || [];

  const employeeTasks = allTasks;
  const employees = getTaskEmployeesFromTasks(employeeTasks);

  const clientPool = filterTasksForAnalytics(allTasks, {
    ...filters,
    client: '',
    serviceCategory: '',
    taskPeriod: '',
  });
  const clients = uniqueSortedOptions(clientPool.map(getTaskClientName).filter(Boolean));

  const servicePool = filterTasksForAnalytics(allTasks, {
    ...filters,
    serviceCategory: '',
    taskPeriod: '',
  });
  const serviceCategories = uniqueSortedOptions(servicePool.map(getTaskServiceCategory));

  const periodPool = filterTasksForAnalytics(allTasks, {
    ...filters,
    taskPeriod: '',
  });
  const taskPeriods = uniqueSortedOptions(periodPool.map(getTaskPeriodLabel));

  return { employees, clients, serviceCategories, taskPeriods };
}

function getTaskEmployeesFromTasks(tasks: any[]): FilterOption[] {
  const map = new Map<string, string>();
  (tasks || []).forEach((task) => {
    getTaskEmployees(task).forEach((e) => {
      if (!map.has(e.id)) map.set(e.id, e.name);
    });
  });
  return Array.from(map.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

function mapStatusToAnalytics(status: TaskStatusCategory | null): AnalyticsStatusKey | null {
  if (!status) return null;
  if (status === 'scheduled') return 'todo';
  return status;
}

function resolveStatusUserId(task: any, employeeFilterId: string): string | undefined {
  if (employeeFilterId) return employeeFilterId;
  return getTaskEmployees(task)[0]?.id;
}

export function buildTaskAnalyticsTableRows(
  tasks: any[],
  filters: TaskAnalyticsFilters,
  dueSoonDays = 3
): { rows: TaskAnalyticsTableRow[]; groupLabel: string } {
  const filtered = filterTasksForAnalytics(tasks, filters);
  const groupField = !filters.employeeId
    ? 'employee'
    : !filters.client
      ? 'client'
      : !filters.serviceCategory
        ? 'serviceCategory'
        : !filters.taskPeriod
          ? 'taskPeriod'
          : 'summary';

  const groupLabelMap = {
    employee: 'Employee',
    client: 'Client',
    serviceCategory: 'Service Category',
    taskPeriod: 'Task Period',
    task: 'Task',
  };

  if (groupField === 'summary') {
    const taskRowMap = new Map<string, TaskAnalyticsTableRow>();
    filtered.forEach((task) => {
      const statusUserId = resolveStatusUserId(task, filters.employeeId);
      const analyticsStatus = mapStatusToAnalytics(
        getTaskStatusCategoryFromTask(task, dueSoonDays, statusUserId)
      );
      if (!analyticsStatus) return;
      const rowKey = String(task.id);
      const rowLabel = extractBaseTaskTitle(String(task?.title || '')).trim() || 'Untitled Task';
      if (!taskRowMap.has(rowKey)) {
        taskRowMap.set(rowKey, { id: rowKey, label: rowLabel, counts: emptyCounts(), total: 0 });
      }
      const row = taskRowMap.get(rowKey)!;
      row.counts[analyticsStatus] += 1;
      row.total += 1;
    });
    const rows = Array.from(taskRowMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    return { rows, groupLabel: groupLabelMap.task };
  }

  const rowMap = new Map<string, TaskAnalyticsTableRow>();

  filtered.forEach((task) => {
    if (groupField === 'employee') {
      const employees = filters.employeeId
        ? getTaskEmployees(task).filter((e) => e.id === filters.employeeId)
        : getTaskEmployees(task);
      const list = employees.length ? employees : [{ id: '_unassigned', name: 'Unassigned' }];
      list.forEach((emp) => {
        const analyticsStatus = mapStatusToAnalytics(
          getTaskStatusCategoryFromTask(task, dueSoonDays, emp.id === '_unassigned' ? undefined : emp.id)
        );
        if (!analyticsStatus) return;
        if (!rowMap.has(emp.id)) {
          rowMap.set(emp.id, { id: emp.id, label: emp.name, counts: emptyCounts(), total: 0 });
        }
        const row = rowMap.get(emp.id)!;
        row.counts[analyticsStatus] += 1;
        row.total += 1;
      });
      return;
    }

    const statusUserId = resolveStatusUserId(task, filters.employeeId);
    const analyticsStatus = mapStatusToAnalytics(
      getTaskStatusCategoryFromTask(task, dueSoonDays, statusUserId)
    );
    if (!analyticsStatus) return;

    let rowKey = '';
    let rowLabel = '';
    switch (groupField) {
      case 'client':
        rowKey = getTaskClientName(task) || '—';
        rowLabel = rowKey;
        break;
      case 'serviceCategory':
        rowKey = getTaskServiceCategory(task);
        rowLabel = rowKey;
        break;
      case 'taskPeriod':
        rowKey = getTaskPeriodLabel(task);
        rowLabel = rowKey;
        break;
      default:
        return;
    }

    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, { id: rowKey, label: rowLabel, counts: emptyCounts(), total: 0 });
    }
    const row = rowMap.get(rowKey)!;
    row.counts[analyticsStatus] += 1;
    row.total += 1;
  });

  const rows = Array.from(rowMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  return { rows, groupLabel: groupLabelMap[groupField] };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatAnalyticsFilterSummary(
  filters: TaskAnalyticsFilters,
  options: ReturnType<typeof getCascadingFilterOptions>
): string {
  const employeeLabel = filters.employeeId
    ? options.employees.find((e) => e.value === filters.employeeId)?.label || filters.employeeId
    : 'All';

  return [
    `Employee: ${employeeLabel}`,
    `Client: ${filters.client || 'All'}`,
    `Service Category: ${filters.serviceCategory || 'All'}`,
    `Task Period: ${filters.taskPeriod || 'All'}`,
  ].join(' | ');
}

export function taskAnalyticsReportToCsv(
  rows: TaskAnalyticsTableRow[],
  groupLabel: string,
  filters: TaskAnalyticsFilters,
  options?: ReturnType<typeof getCascadingFilterOptions>
): string {
  const header = [
    groupLabel,
    ...TASK_ANALYTICS_STATUS_COLUMNS.map((c) => c.label),
    'Total',
  ];
  const body = rows.map((row) => [
    row.label,
    ...TASK_ANALYTICS_STATUS_COLUMNS.map((c) => String(row.counts[c.key])),
    String(row.total),
  ]);
  const filterLine = options
    ? formatAnalyticsFilterSummary(filters, options)
    : [
        `Employee: ${filters.employeeId || 'All'}`,
        `Client: ${filters.client || 'All'}`,
        `Service Category: ${filters.serviceCategory || 'All'}`,
        `Task Period: ${filters.taskPeriod || 'All'}`,
      ].join(' | ');

  return [TASK_ANALYTICS_REPORT_TITLE, filterLine, header, ...body]
    .map((line) =>
      Array.isArray(line)
        ? line.map((cell) => escapeCsvCell(String(cell))).join(',')
        : escapeCsvCell(String(line))
    )
    .join('\r\n');
}

export function downloadTaskAnalyticsReportCsv(
  rows: TaskAnalyticsTableRow[],
  groupLabel: string,
  filters: TaskAnalyticsFilters,
  options?: ReturnType<typeof getCascadingFilterOptions>,
  filename?: string
): void {
  const csv = taskAnalyticsReportToCsv(rows, groupLabel, filters, options);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = filename || `task-analytics-report-${dateStamp}.csv`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function hasTaskAnalyticsData(tasks: any[]): boolean {
  return (tasks || []).some((task) => task?.id);
}
