import api from './api';

export const superAdminService = {
  // Dashboard
  getDashboardStats: () => api.get('/super-admin/dashboard'),
  getOrganizationMetrics: () => api.get('/super-admin/dashboard/organizations'),
  getUserMetrics: () => api.get('/super-admin/dashboard/users'),
  getTaskMetrics: () => api.get('/super-admin/dashboard/tasks'),
};

