import api from './api';

/**
 * Employee Service
 * 
 * This service is for Admin users to manage employees in their own organization.
 * It calls /api/admin/employees endpoints which automatically filter by the admin's organization.
 * 
 * For platform-wide user management (all organizations), use userService (Super Admin only).
 * For users in a specific organization (Super Admin view), use organizationService.getUsers(orgId).
 */
export interface Employee {
  id: string;
  mobile: string;
  name: string;
  role: 'employee';
  status: string;
  profilePhotoUrl?: string;
  profile_photo_url?: string;
  reportingTo?: string;
  reporting_to?: string;
  reportingToName?: string;
  reporting_to_name?: string;
  primaryOrgNodeId?: string | null;
  primary_org_node_id?: string | null;
  secondaryOrgNodeIds?: string[];
  secondary_org_node_ids?: string[];
  primaryOrgPath?: string | null;
  primary_org_path?: string | null;
  primaryOrgNodeName?: string | null;
  primary_org_node_name?: string | null;
  primaryOrgLevelLabel?: string | null;
  primary_org_level_label?: string | null;
  secondaryOrgPaths?: string[];
  secondary_org_paths?: string[];
  orgFieldValues?: Record<string, unknown>;
  org_field_values?: Record<string, unknown>;
  createdAt?: string;
  created_at?: string;
}

export interface AddEmployeeRequest {
  mobile: string;
  name: string;
  reportingTo?: string;
  primaryOrgNodeId?: string | null;
  secondaryOrgNodeIds?: string[];
  orgFieldValues?: Record<string, string>;
}

export interface UpdateEmployeeRequest {
  name?: string;
  reportingTo?: string;
  primaryOrgNodeId?: string | null;
  secondaryOrgNodeIds?: string[];
  status?: string;
  orgFieldValues?: Record<string, string>;
}

export const employeeService = {
  /**
   * Get all employees in the admin's organization
   * Returns only employees (role='employee'), not admins
   */
  getEmployees: () => api.get('/admin/employees'),

  /**
   * Search users by mobile number for the Admin Add Employee form.
   * This can return users that are not yet part of the admin's organization.
   */
  searchUsersByMobile: (query: string) =>
    api.get('/admin/employees/search-users', { params: { q: query, limit: 20 } }),

  /**
   * Add a new employee to the admin's organization
   */
  addEmployee: (data: AddEmployeeRequest) => api.post('/admin/employees', data),

  /**
   * Update employee details in the admin's organization
   */
  updateEmployee: (id: string, data: UpdateEmployeeRequest) => 
    api.put(`/admin/employees/${id}`, data),

  /**
   * Remove an employee from the admin's organization
   */
  removeEmployee: (id: string) => api.delete(`/admin/employees/${id}`),

  /**
   * Reset employee password (admin only)
   */
  resetPassword: (id: string, newPassword: string) => 
    api.post(`/admin/employees/${id}/reset-password`, { newPassword }),
};

