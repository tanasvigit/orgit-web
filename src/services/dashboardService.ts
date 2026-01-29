import api from './api';
import { setTaskFinancial } from '../utils/taskFinancialStorage';

function flattenTasks(tasks: any): any[] {
  if (!tasks) return [];
  if (Array.isArray(tasks)) return tasks;
  const out: any[] = [];
  Object.values(tasks).forEach((v: any) => {
    if (Array.isArray(v)) out.push(...v);
    else if (v && typeof v === 'object')
      Object.values(v).forEach((w: any) => {
        if (Array.isArray(w)) out.push(...w);
        else if (w && typeof w === 'object')
          Object.values(w).forEach((x: any) => {
            if (Array.isArray(x)) out.push(...x);
          });
      });
  });
  return out;
}

function ingestTaskFinancial(task: any) {
  if (!task?.id) return;
  const hasValue = task.financial_value != null;
  const hasType = !!task.finance_type;
  if (hasValue || hasType) {
    setTaskFinancial(task.id, {
      financial_value: task.financial_value ?? null,
      finance_type: task.finance_type ?? null,
      source: 'mobile',
    });
  }
}

export const dashboardService = {
  getDashboard: async (dueSoonDays = 3) => {
    const response = await api.get(`/dashboard?dueSoonDays=${dueSoonDays}`);
    const data = response.data;
    const self = data?.data?.selfTasks ?? data?.selfTasks;
    const assigned = data?.data?.assignedTasks ?? data?.assignedTasks;
    [...flattenTasks(self), ...flattenTasks(assigned)].forEach(ingestTaskFinancial);
    return response.data;
  },

  getStatistics: async () => {
    const response = await api.get('/dashboard/statistics');
    return response.data;
  },
};

