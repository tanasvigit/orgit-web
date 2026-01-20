import api from './api';

/**
 * User Service
 * 
 * This service is for Super Admin users to manage ALL users across the entire platform.
 * It calls /api/super-admin/users endpoints which return users from all organizations.
 * 
 * For managing employees in a specific organization:
 * - Admin users should use employeeService (for their own organization)
 * - Super Admin viewing an organization should use organizationService.getUsers(orgId)
 */
export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const userService = {
  /**
   * Get all users on the platform (Super Admin only)
   * Returns users from all organizations
   */
  getAll: (filters?: UserFilters) =>
    api.get('/super-admin/users', { params: filters }),
  getById: (id: string) => api.get(`/super-admin/users/${id}`),
  delete: (id: string) => api.delete(`/super-admin/users/${id}`),
  updateRole: (userId: string, role: string) => api.put(`/super-admin/users/${userId}/role`, { role }),
};

