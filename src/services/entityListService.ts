import api from './api';
import type { TaskServiceFrequency } from './masterDataService';

export interface ClientEntity {
  id: string;
  name: string;
  entity_type?: string;
  org_structure_node_id?: string | null;
  org_structure_node_name?: string | null;
  org_structure_level_label?: string | null;
  org_structure_path?: Array<{ id: string; name: string; levelLabel?: string; levelKey?: string }>;
  org_field_values?: Record<string, unknown>;
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
    orgStructureNodeId?: string;
    pan?: string;
    reportingPartnerMobile?: string;
    status?: 'active' | 'inactive';
    orgFieldValues?: Record<string, string>;
  }) =>
    api.post('/admin/entities', data),
  update: (
    id: string,
    data: {
      name?: string;
      entityType?: string;
      orgStructureNodeId?: string;
      pan?: string;
      reportingPartnerMobile?: string;
      status?: 'active' | 'inactive';
      orgFieldValues?: Record<string, string>;
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

