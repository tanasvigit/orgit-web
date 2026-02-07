import api from './api';

export interface MasterOption {
  id: string;
  name: string;
  code?: string;
}

export interface OrgConstitutionOption {
  value: string;
  label: string;
}

export type TaskServiceType = 'recurring' | 'one_time';
export type TaskServiceFrequency =
  | 'Daily'
  | 'Weekly'
  | 'Fortnightly'
  | 'Monthly'
  | 'Quarterly'
  | 'Half Yearly'
  | 'Yearly'
  | 'NA'
  | 'Custom';

export interface TaskServiceItem {
  id: string;
  title: string;
  task_type: TaskServiceType;
  frequency: TaskServiceFrequency;
  rollout_rule: 'end_of_period' | 'one_month_before_period_end';
  is_active: boolean;
}

export const masterDataService = {
  getCountries: () => api.get('/master/countries'),
  getStates: (countryId: string) => api.get('/master/states', { params: { country_id: countryId } }),
  getCities: (stateId: string) => api.get('/master/cities', { params: { state_id: stateId } }),
  getOrgConstitutions: () => api.get('/master/org-constitutions'),
  getTaskFrequencies: () => api.get('/master/task-frequencies'),
  getTaskServices: (type?: TaskServiceType) =>
    api.get('/master/task-services', { params: type ? { type } : undefined }),
  createTaskService: (body: {
    title: string;
    task_type: TaskServiceType;
    frequency?: TaskServiceFrequency;
    rollout_rule?: 'end_of_period' | 'one_month_before_period_end';
  }) => api.post<{ success: boolean; data: TaskServiceItem }>('/admin/task-services', body),
};

