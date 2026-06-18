import { extractBaseTaskTitle, formatTaskPeriodFromTask } from './taskPeriod';
import { getTaskStatusCategoryFromTask, normalizeLifecycleStatus, type TaskStatusCategory } from './taskStatus';

export const TASK_ANALYTICS_REPORT_TITLE = 'Task Analytics Report';

export const TASK_ANALYTICS_FILTER_PLACEHOLDER = 'Select';

export type AnalyticsStatusKey = 'todo' | 'inprogress' | 'duesoon' | 'overdue' | 'completed';

export const TASK_ANALYTICS_STATUS_COLUMNS: { key: AnalyticsStatusKey; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'inprogress', label: 'In Progress' },
  { key: 'duesoon', label: 'Due Soon' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'completed', label: 'Completed' },
];

export type AnalyticsDimensionKey = 'employee' | 'client' | 'service' | 'taskPeriod';

export const TASK_ANALYTICS_DIMENSION_OPTIONS: { value: AnalyticsDimensionKey; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'client', label: 'Client' },
  { value: 'service', label: 'Service' },
  { value: 'taskPeriod', label: 'Task Period' },
];

export const TASK_ANALYTICS_FILTER_SLOTS = [
  { key: 'first' as const, label: 'First Filter' },
  { key: 'second' as const, label: 'Second Filter' },
  { key: 'third' as const, label: 'Third Filter' },
  { key: 'fourth' as const, label: 'Fourth Filter' },
];

export type TaskAnalyticsFilters = {
  first: AnalyticsDimensionKey | '';
  second: AnalyticsDimensionKey | '';
  third: AnalyticsDimensionKey | '';
  fourth: AnalyticsDimensionKey | '';
};

export const EMPTY_TASK_ANALYTICS_FILTERS: TaskAnalyticsFilters = {
  first: '',
  second: '',
  third: '',
  fourth: '',
};

export const DEFAULT_TASK_ANALYTICS_FILTERS: TaskAnalyticsFilters = {
  first: '',
  second: '',
  third: '',
  fourth: '',
};

export type FilterOption = { value: string; label: string };

export type TaskAnalyticsReportRow = {
  id: string;
  sNo?: number;
  particulars: string;
  depth: number;
  countsByStatus: Record<AnalyticsStatusKey, number>;
};

export type TaskAnalyticsReportData = {
  rows: TaskAnalyticsReportRow[];
  columnCounts: Record<AnalyticsStatusKey, number>;
};

type PathSegment = {
  key: string;
  label: string;
  employeeId?: string;
};

type AnalyticsTreeNode = {
  label: string;
  children: Map<string, AnalyticsTreeNode>;
  tasks: Array<{ label: string; status: AnalyticsStatusKey }>;
};

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

export function getTaskDisplayLabel(task: any): string {
  const base = extractBaseTaskTitle(String(task?.title || '').trim());
  return base || 'Untitled Task';
}

type EmployeeEntry = { id: string; name: string };

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

function isExcludedUser(userId: string | null | undefined, excludeUserId?: string | null): boolean {
  if (!userId || !excludeUserId) return false;
  return String(userId).trim() === String(excludeUserId).trim();
}

export function getReportEmployees(task: any, excludeUserId?: string | null): EmployeeEntry[] {
  const employees = getTaskEmployees(task);
  if (!excludeUserId) return employees;
  return employees.filter((employee) => !isExcludedUser(employee.id, excludeUserId));
}

export function filterTasksForReport(tasks: any[], excludeUserId?: string | null): any[] {
  return (tasks || []).filter((task) => {
    if (!task?.id) return false;
    if (!excludeUserId) return true;
    return getReportEmployees(task, excludeUserId).length > 0;
  });
}

export function getActiveHierarchyDimensions(filters: TaskAnalyticsFilters): AnalyticsDimensionKey[] {
  const slots = [filters.first, filters.second, filters.third, filters.fourth].filter(
    (slot): slot is AnalyticsDimensionKey => Boolean(slot)
  );
  const seen = new Set<AnalyticsDimensionKey>();
  const ordered: AnalyticsDimensionKey[] = [];
  slots.forEach((slot) => {
    if (seen.has(slot)) return;
    seen.add(slot);
    ordered.push(slot);
  });
  if (ordered.length) return ordered;
  return ['employee', 'client', 'service', 'taskPeriod'];
}

export function getDimensionOptionsForSlot(
  filters: TaskAnalyticsFilters,
  slotKey: keyof TaskAnalyticsFilters
): FilterOption[] {
  const current = filters[slotKey];
  const usedElsewhere = new Set(
    TASK_ANALYTICS_FILTER_SLOTS.map((s) => s.key)
      .filter((key) => key !== slotKey)
      .map((key) => filters[key])
      .filter(Boolean) as AnalyticsDimensionKey[]
  );

  return TASK_ANALYTICS_DIMENSION_OPTIONS.filter(
    (opt) => opt.value === current || !usedElsewhere.has(opt.value)
  ).map((opt) => ({ value: opt.value, label: opt.label }));
}

function mapStatusToAnalytics(status: TaskStatusCategory | null): AnalyticsStatusKey | null {
  if (!status) return null;
  if (status === 'scheduled') return 'todo';
  return status;
}

function getTaskAnalyticsStatus(
  task: any,
  dueSoonDays: number,
  statusUserId?: string,
  excludeUserId?: string | null
): AnalyticsStatusKey | null {
  const assigneeId =
    statusUserId && !isExcludedUser(statusUserId, excludeUserId)
      ? statusUserId
      : getReportEmployees(task, excludeUserId)[0]?.id;
  if (!assigneeId) {
    return mapStatusToAnalytics(normalizeLifecycleStatus(task?.status) ?? 'todo');
  }
  return mapStatusToAnalytics(getTaskStatusCategoryFromTask(task, dueSoonDays, assigneeId));
}

function computeColumnCounts(
  tasks: any[],
  dueSoonDays: number,
  excludeUserId?: string | null
): Record<AnalyticsStatusKey, number> {
  const counts = emptyCounts();
  tasks.forEach((task) => {
    if (!task?.id) return;
    const status = getTaskAnalyticsStatus(task, dueSoonDays, undefined, excludeUserId);
    if (status) counts[status] += 1;
  });
  return counts;
}

function countTasksByStatus(
  tasks: Array<{ label: string; status: AnalyticsStatusKey }>
): Record<AnalyticsStatusKey, number> {
  const counts = emptyCounts();
  tasks.forEach((task) => {
    counts[task.status] += 1;
  });
  return counts;
}

function getSegmentsForDimension(
  task: any,
  dimension: AnalyticsDimensionKey,
  excludeUserId?: string | null
): PathSegment[] {
  if (dimension === 'employee') {
    const employees = getReportEmployees(task, excludeUserId);
    if (!employees.length) return [];
    return employees.map((emp) => ({
      key: emp.id,
      label: emp.name,
      employeeId: emp.id,
    }));
  }
  if (dimension === 'client') {
    const client = getTaskClientName(task) || '—';
    return [{ key: client, label: client }];
  }
  if (dimension === 'service') {
    const service = getTaskServiceCategory(task);
    return [{ key: service, label: service }];
  }
  const period = getTaskPeriodLabel(task);
  return [{ key: period, label: period }];
}

function buildPathsForTask(
  task: any,
  dimensions: AnalyticsDimensionKey[],
  excludeUserId?: string | null
): PathSegment[][] {
  if (!dimensions.length) return [[]];

  const [first, ...rest] = dimensions;
  const firstSegments = getSegmentsForDimension(task, first, excludeUserId);
  if (!firstSegments.length) return [];
  const restPaths = buildPathsForTask(task, rest, excludeUserId);

  const paths: PathSegment[][] = [];
  firstSegments.forEach((segment) => {
    restPaths.forEach((restPath) => {
      paths.push([segment, ...restPath]);
    });
  });
  return paths;
}

function ensureTreeNode(map: Map<string, AnalyticsTreeNode>, segment: PathSegment): AnalyticsTreeNode {
  if (!map.has(segment.key)) {
    map.set(segment.key, { label: segment.label, children: new Map(), tasks: [] });
  }
  return map.get(segment.key)!;
}

function insertPathIntoTree(
  tree: Map<string, AnalyticsTreeNode>,
  path: PathSegment[],
  task: any,
  dueSoonDays: number,
  excludeUserId?: string | null
) {
  if (!path.length) return;

  const taskLabel = getTaskDisplayLabel(task);
  const statusUserId = [...path].reverse().find((s) => s.employeeId)?.employeeId;
  const status = getTaskAnalyticsStatus(task, dueSoonDays, statusUserId, excludeUserId);
  if (!status) return;

  let currentLevel = tree;
  for (let i = 0; i < path.length; i += 1) {
    const segment = path[i];
    const node = ensureTreeNode(currentLevel, segment);
    if (i === path.length - 1) {
      node.tasks.push({ label: taskLabel, status });
    } else {
      currentLevel = node.children;
    }
  }
}

function buildDynamicAnalyticsTree(
  tasks: any[],
  dimensions: AnalyticsDimensionKey[],
  dueSoonDays: number,
  excludeUserId?: string | null
): Map<string, AnalyticsTreeNode> {
  const tree = new Map<string, AnalyticsTreeNode>();
  tasks.forEach((task) => {
    if (!task?.id) return;
    const paths = buildPathsForTask(task, dimensions, excludeUserId);
    paths.forEach((path) => insertPathIntoTree(tree, path, task, dueSoonDays, excludeUserId));
  });
  return tree;
}

function flattenTreeLevelWithRemainingDimensions(
  nodes: Map<string, AnalyticsTreeNode>,
  depth: number,
  dimensions: AnalyticsDimensionKey[],
  dimIndex: number,
  rows: TaskAnalyticsReportRow[],
  idPrefix: string,
  sNoRef: { value: number }
) {
  const isLeafLevel = dimIndex === dimensions.length - 1;

  Array.from(nodes.entries())
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .forEach(([key, node]) => {
      const rowId = `${idPrefix}|${key}`;
      const row: TaskAnalyticsReportRow = {
        id: rowId,
        particulars: node.label,
        depth,
        countsByStatus: isLeafLevel ? countTasksByStatus(node.tasks) : emptyCounts(),
      };
      if (depth === 0) {
        sNoRef.value += 1;
        row.sNo = sNoRef.value;
      }
      rows.push(row);

      if (!isLeafLevel) {
        flattenTreeLevelWithRemainingDimensions(
          node.children,
          depth + 1,
          dimensions,
          dimIndex + 1,
          rows,
          rowId,
          sNoRef
        );
      }
    });
}

function flattenAnalyticsTree(
  tree: Map<string, AnalyticsTreeNode>,
  dimensions: AnalyticsDimensionKey[]
): TaskAnalyticsReportRow[] {
  const rows: TaskAnalyticsReportRow[] = [];
  const sNoRef = { value: 0 };
  if (!dimensions.length) return rows;
  flattenTreeLevelWithRemainingDimensions(tree, 0, dimensions, 0, rows, 'root', sNoRef);
  return rows;
}

/** @deprecated Use buildTaskAnalyticsReport instead */
export function buildTaskAnalyticsTableRows(
  tasks: any[],
  filters: TaskAnalyticsFilters,
  dueSoonDays = 3
): {
  rows: Array<{ id: string; label: string; counts: Record<AnalyticsStatusKey, number>; total: number }>;
  groupLabel: string;
} {
  const { rows } = buildTaskAnalyticsReport(tasks, filters, dueSoonDays);
  const legacyRows = rows
    .filter((row) => TASK_ANALYTICS_STATUS_COLUMNS.some((col) => row.countsByStatus[col.key] > 0))
    .map((row) => {
      const counts = { ...row.countsByStatus };
      let total = 0;
      (Object.keys(counts) as AnalyticsStatusKey[]).forEach((key) => {
        total += counts[key];
      });
      return { id: row.id, label: row.particulars, counts, total };
    });
  const dimensions = getActiveHierarchyDimensions(filters);
  const groupLabel = dimensions[0]
    ? TASK_ANALYTICS_DIMENSION_OPTIONS.find((d) => d.value === dimensions[0])?.label || 'Particulars'
    : 'Particulars';
  return { rows: legacyRows, groupLabel };
}

export function buildTaskAnalyticsReport(
  tasks: any[],
  filters: TaskAnalyticsFilters,
  dueSoonDays = 3,
  excludeUserId?: string | null
): TaskAnalyticsReportData {
  const allTasks = filterTasksForReport(tasks, excludeUserId);
  const dimensions = getActiveHierarchyDimensions(filters);
  const columnCounts = computeColumnCounts(allTasks, dueSoonDays, excludeUserId);
  const tree = buildDynamicAnalyticsTree(allTasks, dimensions, dueSoonDays, excludeUserId);
  const rows = flattenAnalyticsTree(tree, dimensions);
  return { rows, columnCounts };
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function dimensionLabel(value: AnalyticsDimensionKey | ''): string {
  if (!value) return TASK_ANALYTICS_FILTER_PLACEHOLDER;
  return TASK_ANALYTICS_DIMENSION_OPTIONS.find((d) => d.value === value)?.label || value;
}

export function formatAnalyticsFilterSummary(filters: TaskAnalyticsFilters): string {
  return TASK_ANALYTICS_FILTER_SLOTS.map(
    (slot) => `${slot.label}: ${dimensionLabel(filters[slot.key])}`
  ).join(' | ');
}

export function taskAnalyticsReportToCsv(
  data: TaskAnalyticsReportData,
  filters: TaskAnalyticsFilters
): string {
  const { rows } = data;
  const header = [
    'S No',
    'Particulars',
    ...TASK_ANALYTICS_STATUS_COLUMNS.map((c) => c.label),
  ];
  const body = rows.map((row) => [
    row.sNo != null ? String(row.sNo) : '',
    row.particulars,
    ...TASK_ANALYTICS_STATUS_COLUMNS.map((c) => String(row.countsByStatus[c.key] || '')),
  ]);
  const filterLine = formatAnalyticsFilterSummary(filters);

  return [TASK_ANALYTICS_REPORT_TITLE, filterLine, header, ...body]
    .map((line) =>
      Array.isArray(line)
        ? line.map((cell) => escapeCsvCell(String(cell))).join(',')
        : escapeCsvCell(String(line))
    )
    .join('\r\n');
}

export function downloadTaskAnalyticsReportCsv(
  data: TaskAnalyticsReportData,
  filters: TaskAnalyticsFilters,
  _options?: unknown,
  filename?: string
): void {
  const csv = taskAnalyticsReportToCsv(data, filters);
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

export function hasTaskAnalyticsData(tasks: any[], excludeUserId?: string | null): boolean {
  return filterTasksForReport(tasks, excludeUserId).length > 0;
}
