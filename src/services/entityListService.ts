import api from './api';
import type { TaskServiceFrequency } from './masterDataService';

export interface ClientEntity {
  id: string;
  name: string;
  entity_type?: string;
  cost_centre_id?: string;
  cost_centre_name?: string;
  cost_centre_short_name?: string;
  created_at?: string;
  updated_at?: string;
  serviceFrequencies?: Record<string, TaskServiceFrequency>;
}

export interface ServiceMatrixResponse {
  services: Array<{
    id: string;
    title: string;
    task_type: 'recurring' | 'one_time';
    frequency: TaskServiceFrequency;
    rollout_rule: 'end_of_period' | 'one_month_before_period_end';
  }>;
  clients: ClientEntity[];
}

export const entityListService = {
  list: () => api.get('/admin/entities'),
  create: (data: { name: string; entityType?: string; costCentreId?: string }) =>
    api.post('/admin/entities', data),
  update: (id: string, data: { name?: string; entityType?: string; costCentreId?: string }) =>
    api.put(`/admin/entities/${id}`, data),
  remove: (id: string) => api.delete(`/admin/entities/${id}`),
  matrix: (type?: 'recurring' | 'one_time') =>
    api.get('/admin/entities/matrix', { params: type ? { type } : undefined }),
  upsertClientServices: (clientId: string, items: Array<{ taskServiceId: string; frequency: TaskServiceFrequency }>) =>
    api.put(`/admin/entities/${clientId}/services`, { items }),
};

