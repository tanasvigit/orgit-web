import api from './api';
import type { TaskServiceFrequency } from './masterDataService';

export interface ClientEntity {
  id: string;
  name: string;
  entity_type?: string;
  cost_centre_id?: string;
  cost_centre_name?: string;
  cost_centre_short_name?: string;
  depot_id?: string;
  depot_name?: string;
  depot_short_name?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  warehouse_short_name?: string;
  pan?: string;
  reporting_partner_mobile?: string;
  reporting_partner_name?: string;
  status?: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
  serviceFrequencies?: Record<string, TaskServiceFrequency>;
}

export interface ServiceMatrixResponse {
  services: Array<{
    id: string;
    title: string;
    task_type: 'recurring' | 'one_time' | 'recurring_instance' | 'recurring_template';
    frequency: TaskServiceFrequency;
    rollout_rule: 'end_of_period' | 'one_month_before_period_end';
  }>;
  clients: ClientEntity[];
}

export const entityListService = {
  list: () => api.get('/admin/entities'),
  create: (data: {
    name: string;
    entityType?: string;
    costCentreId?: string;
    depotId?: string;
    warehouseId?: string;
    pan?: string;
    reportingPartnerMobile?: string;
    status?: 'active' | 'inactive';
  }) =>
    api.post('/admin/entities', data),
  update: (
    id: string,
    data: {
      name?: string;
      entityType?: string;
      costCentreId?: string;
      depotId?: string;
      warehouseId?: string;
      pan?: string;
      reportingPartnerMobile?: string;
      status?: 'active' | 'inactive';
    }
  ) =>
    api.put(`/admin/entities/${id}`, data),
  remove: (id: string) => api.delete(`/admin/entities/${id}`),
  // Service matrix for the current user's organization (read-only, used by Admin + Employees)
  matrix: (type?: 'recurring' | 'one_time' | 'recurring_instance' | 'recurring_template') =>
    api.get('/organization/client-matrix', { params: type ? { type } : undefined }),
  upsertClientServices: (clientId: string, items: Array<{ taskServiceId: string; frequency: TaskServiceFrequency }>) =>
    api.put(`/admin/entities/${clientId}/services`, { items }),
};

