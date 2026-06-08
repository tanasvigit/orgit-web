/**
 * Employee List Component
 * 
 * This component is for Admin users to manage employees in their own organization.
 * It displays only employees (role='employee') that belong to the admin's organization.
 * 
 * Scope:
 * - Shows employees in admin's organization only (not all platform users)
 * - Allows adding, updating, and removing employees
 * - Does NOT allow changing user roles (Super Admin only)
 * 
 * API: Uses /api/admin/employees which automatically filters by admin's organization
 */
import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { employeeService, Employee } from '../../../services/employeeService';
import { useToast } from '../../../context/ToastContext';
import { getOrganizationStructureTree } from '../../../services/settingsService';
import { EmployeeMasterFormSections } from './EmployeeMasterFormSections';
import { buildInitialMasterForm, type EmployeeMasterFormState } from './employeeMasterTypes';
import {
  buildEmployeeOrgFieldValuesPayload,
  deriveOrgNodeByLevelFromPrimary,
  extractOrgNodeByLevel,
  formatOrgNodeByLevelSummary,
  getActiveNodesUnderRoot,
  getAssignmentSectionsFromTree,
  getDeepestSelectedNodeId,
  normalizeOrgNodeByLevel,
  type OrgNodeByLevel,
} from '../../../utils/employeeOrgNodeLevels';
import { BulkMasterUploadPanel } from '../../../components/admin/BulkMasterUploadPanel';

export const EmployeeList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery(
    'employees',
    () => employeeService.getEmployees().then((res) => res.data.data || res.data),
    {
      refetchInterval: 30000,
    }
  );

  const employees: Employee[] = Array.isArray(data) ? data : [];
  const { data: orgStructureData } = useQuery(
    ['employees-org-structure-status'],
    () =>
      getOrganizationStructureTree({
        includeArchived: true,
        includeInactive: true,
      }).then((response) => response.data || response),
    {
      refetchOnWindowFocus: false,
    }
  );

  const getEmployeeOrgAssignmentLabel = (emp: Employee): string => {
    const rawFv = (emp.org_field_values || emp.orgFieldValues) as Record<string, unknown> | undefined;
    let byLevel = extractOrgNodeByLevel(rawFv);
    if (Object.keys(byLevel).length === 0) {
      const primaryId = emp.primaryOrgNodeId || emp.primary_org_node_id;
      if (primaryId && orgStructureData) {
        byLevel = deriveOrgNodeByLevelFromPrimary(orgStructureData, primaryId);
      }
    }
    if (orgStructureData?.levels) {
      byLevel = normalizeOrgNodeByLevel(byLevel, orgStructureData.levels);
    }
    const summary = formatOrgNodeByLevelSummary(orgStructureData, byLevel);
    if (summary) return summary;
    return emp.primaryOrgNodeName || emp.primary_org_node_name || '-';
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp: Employee) => {
    const orgLabel = getEmployeeOrgAssignmentLabel(emp).toLowerCase();
    const matchesSearch = !searchQuery || 
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.mobile?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      orgLabel.includes(searchQuery.toLowerCase()) ||
      (emp.reportingToName || emp.reporting_to_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || emp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await employeeService.removeEmployee(deleteConfirm.id);
      queryClient.invalidateQueries('employees');
      setDeleteConfirm(null);
      toast.success('Employee removed successfully');
    } catch (error: any) {
      toast.error(`Error removing employee: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper function to format phone number - accepts any 10-digit number
  const formatPhoneNumber = (phone: string): string => {
    if (!phone || !phone.trim()) return '';
    
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If it's already in international format (+91...), validate and return
    if (cleaned.startsWith('+')) {
      const digitsOnly = cleaned.replace(/\D/g, '');
      // If it's +91 followed by 10 digits, return as is
      if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
        return cleaned;
      }
      // If it's + followed by 10 digits, assume it needs country code
      if (digitsOnly.length === 10) {
        return `+91${digitsOnly}`;
      }
      // Remove + and process normally
      cleaned = digitsOnly;
    }
    
    // Extract only digits
    const digitsOnly = cleaned.replace(/\D/g, '');
    
    // If it starts with 91 and has 12 digits, add + prefix
    if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
      return `+${digitsOnly}`;
    }
    
    // If it's exactly 10 digits, add +91 prefix
    if (digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    
    // If it's 11-13 digits (might have 0 prefix or country code), take last 10 and add +91
    if (digitsOnly.length >= 10) {
      const last10 = digitsOnly.slice(-10);
      return `+91${last10}`;
    }
    
    // Return empty string if less than 10 digits (will be caught by validation)
    return '';
  };

  const handleSaveEmployee = async (formData: any) => {
    setIsSaving(true);
    try {
      // Format mobile number if it's a new employee
      const submitData = { ...formData };
      if (!editEmployee && submitData.mobile) {
        const formattedMobile = formatPhoneNumber(submitData.mobile);
        
        // Validate that formatting was successful (should have 12 digits: 91 + 10 digit number)
        if (!formattedMobile || formattedMobile === '') {
          toast.error('Please enter a valid 10-digit mobile number');
          setIsSaving(false);
          return;
        }
        
        const digitsOnly = formattedMobile.replace(/\D/g, '');
        if (digitsOnly.length !== 12 || !formattedMobile.startsWith('+91')) {
          toast.error('Please enter a valid 10-digit mobile number');
          setIsSaving(false);
          return;
        }
        
        submitData.mobile = formattedMobile;
      }
      
      if (editEmployee) {
        await employeeService.updateEmployee(editEmployee.id, submitData);
        toast.success('Employee updated successfully');
      } else {
        // Remove password from submitData if user_id is present (existing user)
        if (submitData.user_id && !submitData.password) {
          delete submitData.password;
        }
        await employeeService.addEmployee(submitData);
        toast.success('Employee added successfully');
      }
      queryClient.invalidateQueries('employees');
      setEditEmployee(null);
      setShowAddForm(false);
    } catch (error: any) {
      toast.error(`Error saving employee: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-6 relative">
        {/* Add Employee Button - Top Right Corner */}
        <button
          onClick={() => setShowAddForm(true)}
          className="fixed top-24 right-8 z-40 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/40 active:scale-95 hover:scale-105"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Add Employee</span>
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-text-main tracking-tight">Employees</h2>
            <p className="text-text-muted mt-2 text-sm md:text-base">
              Manage employees in your organization{filteredEmployees.length > 0 && ` (${filteredEmployees.length} total)`}
            </p>
          </div>
        </div>

        {!orgStructureData?.rootNode ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Org definition has not been completed yet. Set up the hierarchy first in
            {' '}
            <span className="font-semibold">Settings &gt; Org Definition</span>
            {' '}
            on web so employee mappings can follow the defined organization structure across web and mobile.
          </div>
        ) : null}

        <BulkMasterUploadPanel variant="compact" className="mb-4" />

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Search by name, mobile, org path, reporting manager..."
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-text-main"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-text-main"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-text-muted">Loading employees...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-6">
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-4xl mb-4">error</span>
              <p className="text-red-600 dark:text-red-400 font-semibold">Error loading employees</p>
              <p className="text-text-muted mt-2 text-sm">
                {(error as any)?.response?.data?.error || (error as any)?.message || 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12">
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-5xl mb-4">people</span>
              <p className="text-text-main font-semibold text-lg">No employees found</p>
              <p className="text-text-muted mt-2 text-sm">
                {searchQuery || statusFilter
                  ? 'Try adjusting your filters to see more results'
                  : 'No employees are registered in your organization yet'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mobile</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Organisation</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reporting To</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredEmployees.map((employee: Employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {employee.profilePhotoUrl || employee.profile_photo_url ? (
                            <img
                              src={employee.profilePhotoUrl || employee.profile_photo_url}
                              alt={employee.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                              {employee.name?.charAt(0).toUpperCase() || 'E'}
                            </div>
                          )}
                          <div className="text-sm font-bold text-text-main">
                            {employee.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">{employee.mobile}</td>
                      <td className="px-6 py-4 text-sm text-text-main">
                        <div className="max-w-xs truncate" title={getEmployeeOrgAssignmentLabel(employee)}>
                          {getEmployeeOrgAssignmentLabel(employee)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        {employee.reportingToName || employee.reporting_to_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.status === 'active'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {employee.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setEditEmployee(employee)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit Employee"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => setResetPasswordEmployee({ id: employee.id, name: employee.name || 'Employee' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                            title="Reset Password"
                          >
                            <span className="material-symbols-outlined text-base">lock_reset</span>
                            <span>Reset Password</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ id: employee.id, name: employee.name || 'Employee' })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove Employee"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            <span>Remove</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add/Edit Employee Form Modal */}
        {(showAddForm || editEmployee) && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
              if (!isSaving) {
                setEditEmployee(null);
                setShowAddForm(false);
              }
            }}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-text-main mb-4">
                {editEmployee ? 'Edit Employee' : 'Add New Employee'}
              </h3>
              <EmployeeForm
                employee={editEmployee}
                employees={employees}
                onSave={handleSaveEmployee}
                onCancel={() => {
                  setEditEmployee(null);
                  setShowAddForm(false);
                }}
                isSaving={isSaving}
                key={editEmployee?.id || 'new'} // Force re-render when switching between add/edit
              />
            </div>
          </div>
        )}

        {/* Reset Password Dialog */}
        {resetPasswordEmployee && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
              if (!isResettingPassword) {
                setResetPasswordEmployee(null);
                setNewPassword('');
                setConfirmPassword('');
              }
            }}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-text-main mb-4">Reset Password</h3>
              <p className="text-text-muted mb-4">
                Set a new password for <strong className="text-text-main">{resetPasswordEmployee.name}</strong>.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-main mb-2">New Password *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 4 characters)"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-main mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
                  />
                </div>
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-500 text-sm">Passwords do not match</p>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setResetPasswordEmployee(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 text-text-muted bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  disabled={isResettingPassword}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newPassword || newPassword.length < 4) {
                      toast.error('Password must be at least 4 characters');
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      toast.error('Passwords do not match');
                      return;
                    }
                    setIsResettingPassword(true);
                    try {
                      await employeeService.resetPassword(resetPasswordEmployee.id, newPassword);
                      toast.success('Password reset successfully');
                      setResetPasswordEmployee(null);
                      setNewPassword('');
                      setConfirmPassword('');
                    } catch (error: any) {
                      toast.error(error.response?.data?.error || 'Failed to reset password');
                    } finally {
                      setIsResettingPassword(false);
                    }
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  disabled={isResettingPassword || !newPassword || newPassword.length < 4 || newPassword !== confirmPassword}
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => !isDeleting && setDeleteConfirm(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-text-main mb-4">Remove Employee</h3>
              <p className="text-text-muted mb-6">
                Are you sure you want to remove <strong className="text-text-main">{deleteConfirm.name}</strong> from your organization? 
                The employee will be deactivated but their account will remain in the system.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-text-muted bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

// Employee Form Component
interface EmployeeFormProps {
  employee?: Employee | null;
  employees: Employee[];
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee, employees, onSave, onCancel, isSaving }) => {
  const { toast } = useToast();
  const rawEmployeeFv = ((employee as any)?.org_field_values ||
    (employee as any)?.orgFieldValues) as Record<string, unknown> | undefined;

  const [masterForm, setMasterForm] = useState<EmployeeMasterFormState>(() =>
    buildInitialMasterForm(employee as Record<string, unknown> | null)
  );
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedExistingUser, setSelectedExistingUser] = useState<any | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const { data: orgStructureTreeData } = useQuery(['employee-form-org-tree'], async () => {
    const response = await getOrganizationStructureTree({
      includeArchived: false,
      includeInactive: false,
    });
    return response.data || response;
  });

  const levelsFromL2 = React.useMemo(
    () => getAssignmentSectionsFromTree(orgStructureTreeData, masterForm.orgNodeByLevel),
    [orgStructureTreeData, masterForm.orgNodeByLevel]
  );

  React.useEffect(() => {
    const primaryId = (employee as any)?.primaryOrgNodeId || (employee as any)?.primary_org_node_id || '';
    const rawFv = ((employee as any)?.org_field_values || (employee as any)?.orgFieldValues) as
      | Record<string, unknown>
      | undefined;
    let orgNodeByLevel = extractOrgNodeByLevel(rawFv);
    if (Object.keys(orgNodeByLevel).length === 0 && primaryId && orgStructureTreeData) {
      orgNodeByLevel = deriveOrgNodeByLevelFromPrimary(orgStructureTreeData, primaryId);
    }
    if (orgStructureTreeData?.levels) {
      orgNodeByLevel = normalizeOrgNodeByLevel(orgNodeByLevel, orgStructureTreeData.levels);
    }
    setMasterForm({
      ...buildInitialMasterForm(employee as Record<string, unknown> | null),
      orgNodeByLevel,
      mobile: employee?.mobile || '',
      name: employee?.name || '',
      reportingTo: (employee as any)?.reportingTo || (employee as any)?.reporting_to || '',
    });
    setSearchResults([]);
    setSelectedExistingUser(null);
  }, [employee, orgStructureTreeData]);

  // Search for existing users by mobile number (EXACT mobile logic)
  const handleMobileChange = async (text: string) => {
    setMasterForm((prev) => ({ ...prev, mobile: text }));
    setSelectedExistingUser(null);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Extract digits only
    const digits = text.replace(/\D/g, '');
    
    // Only search if we have exactly 10 digits (full phone number)
    if (digits.length === 10) {
      setSearchLoading(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          // Search users by phone number specifically for Admin Add Employee
          const response = await employeeService.searchUsersByMobile(digits);
          const users = response.data?.data || response.data || response || [];
          
          // Filter to only show users whose mobile number matches exactly (last 10 digits)
          const normalizedSearch = digits.slice(-10);
          
          const matchingUsers = users.filter((user: any) => {
            if (!user.mobile && !user.phone) return false;
            const userPhone = user.mobile || user.phone || '';
            const normalizedDbPhone = userPhone.replace(/\D/g, '').slice(-10);
            return normalizedDbPhone === normalizedSearch;
          });

          setSearchResults(matchingUsers);
          
          // If exactly one match found, auto-select it
          if (matchingUsers.length === 1) {
            handleSelectExistingUser(matchingUsers[0]);
          }
        } catch (error) {
          console.error('Search users error:', error);
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 500); // Debounce search by 500ms
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  const handleSelectExistingUser = (user: any) => {
    setSelectedExistingUser(user);
    setMasterForm((prev) => ({
      ...prev,
      name: user.name || '',
      mobile: user.mobile || user.phone || prev.mobile,
    }));
    setSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const orgNodeByLevel = orgStructureTreeData?.levels
      ? normalizeOrgNodeByLevel(masterForm.orgNodeByLevel, orgStructureTreeData.levels)
      : masterForm.orgNodeByLevel;

    const primaryOrgNodeId = getDeepestSelectedNodeId(orgNodeByLevel, levelsFromL2);
    const assignableNodes = getActiveNodesUnderRoot(orgStructureTreeData).filter(
      (n) => n.status === 'active'
    );
    if (assignableNodes.length > 0 && !primaryOrgNodeId) {
      toast.error('Please select at least one org unit in Org unit mapping');
      return;
    }
    const submitData: any = {
      mobile: masterForm.mobile,
      name: masterForm.name,
      reportingTo: masterForm.reportingTo || undefined,
      status: masterForm.status,
      password: masterForm.password,
      employeeCode: masterForm.employeeCode,
      email: masterForm.email,
      dateOfBirth: masterForm.dateOfBirth || undefined,
      gender: masterForm.gender,
      address: masterForm.address,
      panNumber: masterForm.panNumber,
      dateOfJoining: masterForm.dateOfJoining || undefined,
      employmentType: masterForm.employmentType,
      designation: masterForm.designation,
      workLocationNodeId: masterForm.workLocationNodeId || null,
      userRole: 'employee',
      employeePermissions: masterForm.permissions,
      notificationSettings: masterForm.notifications,
      primaryOrgNodeId: primaryOrgNodeId || null,
      secondaryOrgNodeIds: masterForm.secondaryOrgNodeIds.filter((id) => id !== primaryOrgNodeId),
      orgFieldValues: buildEmployeeOrgFieldValuesPayload(orgNodeByLevel, {}),
    };

    if (employee) {
      // For updates, don't send password if not changed
      if (!submitData.password) {
        delete submitData.password;
      }
      delete submitData.mobile; // Can't change mobile
    } else {
      // For new employees, password is only required if user doesn't exist
      if (!selectedExistingUser && !submitData.password) {
        toast.error('Password is required for new users');
        return;
      }
      // If existing user selected, don't send password
      if (selectedExistingUser) {
        delete submitData.password;
        submitData.user_id = selectedExistingUser.id;
      }
    }
    onSave(submitData);
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!employee && (
        <div className="relative">
          <label className="block text-sm font-medium text-text-main mb-1">Mobile number (search) *</label>
          <input
            type="tel"
            required
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
            placeholder="10-digit mobile"
            value={masterForm.mobile}
            onChange={(e) => handleMobileChange(e.target.value.replace(/[^\d+]/g, ''))}
            maxLength={15}
          />
          {searchLoading && (
            <div className="absolute z-10 w-full mt-1 rounded-lg border bg-white p-2 shadow-lg dark:bg-slate-800">
              <span className="text-sm text-gray-500">Searching…</span>
            </div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg dark:bg-slate-800">
              {searchResults.map((user: any) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectExistingUser(user)}
                  className="w-full p-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {user.name} — {user.mobile || user.phone}
                </button>
              ))}
            </div>
          )}
          {selectedExistingUser && (
            <p className="mt-1 text-xs text-green-600">Existing user linked — password not required.</p>
          )}
        </div>
      )}

      <EmployeeMasterFormSections
        form={masterForm}
        onChange={(patch) => setMasterForm((prev) => ({ ...prev, ...patch }))}
        tree={orgStructureTreeData}
        employees={employees.filter((e) => !employee || e.id !== employee.id).map((e) => ({
          id: e.id,
          name: e.name,
          mobile: e.mobile,
        }))}
        isEdit={Boolean(employee)}
        showPassword={!employee && !selectedExistingUser}
      />

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-text-muted bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : employee ? 'Update' : 'Add Employee'}
        </button>
      </div>
    </form>
  );
};

