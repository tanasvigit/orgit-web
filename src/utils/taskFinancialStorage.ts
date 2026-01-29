/**
 * Store task financial_value / finance_type in localStorage (API does not persist these).
 * Used so "Financial Report (Created by Me)" can show tasks created with financial data.
 */
const STORAGE_KEY = 'orgit_task_financial';

export interface TaskFinancialData {
  financial_value?: number | null;
  finance_type?: string | null;
  source?: 'web' | 'mobile';
}

function getMap(): Record<string, TaskFinancialData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setMap(map: Record<string, TaskFinancialData>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getTaskFinancial(taskId: string): TaskFinancialData | undefined {
  return getMap()[taskId];
}

export function getAllTaskFinancial(): Record<string, TaskFinancialData> {
  return getMap();
}

export function setTaskFinancial(taskId: string, data: TaskFinancialData) {
  const map = getMap();
  map[taskId] = data;
  setMap(map);
}

/**
 * Merge task with financial data from API and/or localStorage.
 * Use before rendering or filtering on finance fields.
 */
export function mergeTaskWithFinancial(task: any): any {
  if (!task || !task.id) return task;
  const stored = getTaskFinancial(task.id) || {};
  return {
    ...task,
    financial_value: stored.financial_value ?? task.financial_value ?? null,
    finance_type: stored.finance_type ?? task.finance_type ?? null,
  };
}
