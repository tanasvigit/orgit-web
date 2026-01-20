import api from './api';

export interface OrganizationFilters {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const organizationService = {
  getAll: (filters?: OrganizationFilters) =>
    api.get('/super-admin/organizations', { params: filters }),
  getById: (id: string) => api.get(`/super-admin/organizations/${id}`),
  // Admin endpoints for managing their own organization
  getMyOrganization: () => api.get('/admin/organization'),
  updateMyOrganization: (data: any) => api.put('/admin/organization', data),
  // Super admin endpoints
  create: (data: any) => api.post('/super-admin/organizations', data),
  update: (id: string, data: any) => api.put(`/super-admin/organizations/${id}`, data),
  delete: (id: string) => api.delete(`/super-admin/organizations/${id}`),
  suspend: (id: string) => api.post(`/super-admin/organizations/${id}/suspend`),
  activate: (id: string) => api.post(`/super-admin/organizations/${id}/activate`),
  getUsers: (id: string) => api.get(`/super-admin/organizations/${id}/users`),
  getTasks: (id: string, filters?: { status?: string; page?: number; limit?: number }) =>
    api.get(`/super-admin/organizations/${id}/tasks`, { params: filters }),
  getStats: (id: string) => api.get(`/super-admin/organizations/${id}/stats`),
};

