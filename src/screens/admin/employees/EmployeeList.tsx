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
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { getDepartments, getDesignations } from '../../../services/settingsService';
import { chatUserService } from '../../../services/chatUserService';
import { entityMasterBulkService } from '../../../services/entityMasterBulkService';

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
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const handleDownloadEmployeeTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate('employees');
      toast.success('Employee template downloaded. Fill it and upload to bulk update.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: async (res) => {
        const data = res.data?.data;
        if (!data?.uploadId) {
          if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
          return;
        }
        try {
          const status = await entityMasterBulkService.pollUntilDone(data.uploadId);
          if (status.status === 'completed') {
            toast.success('Employee bulk upload completed.');
          } else {
            toast.warning('Bulk upload finished with errors.');
          }
          if (status.errors?.length) {
            status.errors.slice(0, 5).forEach((e: any) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (status.errors.length > 5) toast.error(`… and ${status.errors.length - 5} more errors`);
          }
        } catch (err: any) {
          toast.error(err?.message || 'Failed to get upload status');
        }
        queryClient.invalidateQueries('employees');
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Upload failed');
      },
      onSettled: () => {
        setIsBulkUploading(false);
      },
    }
  );

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      e.target.value = '';
      return;
    }
    setIsBulkUploading(true);
    bulkUploadMutation.mutate(file);
  };

  const { data, isLoading, error } = useQuery(
    'employees',
    () => employeeService.getEmployees().then((res) => res.data.data || res.data),
    {
      refetchInterval: 30000,
    }
  );

  const employees: Employee[] = Array.isArray(data) ? data : [];

  // Filter employees
  const filteredEmployees = employees.filter((emp: Employee) => {
    const matchesSearch = !searchQuery || 
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.mobile?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(searchQuery.toLowerCase());
    
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
            <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight">Employees</h2>
            <p className="text-text-muted mt-2 text-sm md:text-base">
              Manage employees in your organization{filteredEmployees.length > 0 && ` (${filteredEmployees.length} total)`}
            </p>
          </div>
        </div>

        {/* Bulk update from Excel (same process as Entity Master Data) */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-bold text-text-main mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">upload_file</span>
            Bulk update from Excel
          </h2>
          <p className="text-text-muted text-sm mb-4">
            
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadEmployeeTemplate}
              disabled={isDownloadingTemplate}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-text-main rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {isDownloadingTemplate ? 'Downloading...' : 'Download Employee template'}
            </button>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleBulkFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={isBulkUploading}
              className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">upload</span>
              {isBulkUploading ? 'Uploading...' : 'Upload file'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Search by name, mobile, department, designation..."
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
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Designation</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Reporting To</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Level</th>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main">{employee.department || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main">{employee.designation || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                        {employee.reportingToName || employee.reporting_to_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text-main">
                        {employee.level || '-'}
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
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
  const [formData, setFormData] = useState({
    mobile: employee?.mobile || '',
    name: employee?.name || '',
    department: employee?.department || '',
    designation: employee?.designation || '',
    reportingTo: (employee as any)?.reportingTo || (employee as any)?.reporting_to || '',
    level: (employee as any)?.level || '',
    status: employee?.status || 'active',
    password: '',
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedExistingUser, setSelectedExistingUser] = useState<any | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Reset form when employee changes (switching between add/edit)
  React.useEffect(() => {
    setFormData({
      mobile: employee?.mobile || '',
      name: employee?.name || '',
      department: employee?.department || '',
      designation: employee?.designation || '',
      reportingTo: (employee as any)?.reportingTo || (employee as any)?.reporting_to || '',
      level: (employee as any)?.level || '',
      status: employee?.status || 'active',
      password: '',
    });
    setSearchResults([]);
    setSelectedExistingUser(null);
  }, [employee]);

  // Fetch departments and designations
  const { data: departmentsData } = useQuery('departments', async () => {
    const response = await getDepartments();
    return response.data || response;
  });

  const { data: designationsData } = useQuery('designations', async () => {
    const response = await getDesignations();
    return response.data || response;
  });

  const departments = Array.isArray(departmentsData) ? departmentsData : (departmentsData?.items || []);
  const designations = Array.isArray(designationsData) ? designationsData : (designationsData?.items || []);

  // Search for existing users by mobile number (EXACT mobile logic)
  const handleMobileChange = async (text: string) => {
    setFormData({ ...formData, mobile: text });
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
    setFormData({
      ...formData,
      name: user.name || '',
      mobile: user.mobile || user.phone || formData.mobile,
    });
    setSearchResults([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData: any = { ...formData };
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
          <label className="block text-sm font-medium text-text-main mb-1">Mobile Number *</label>
          <input
            type="tel"
            required
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
            placeholder="Enter 10-digit mobile number (e.g., 9876543210)"
            value={formData.mobile}
            onChange={(e) => {
              // Allow only digits, +, and spaces for easier input
              const value = e.target.value.replace(/[^\d+]/g, '');
              handleMobileChange(value);
            }}
            maxLength={15}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Enter any 10-digit mobile number (will be formatted automatically)
          </p>
          
          {/* Search Results Dropdown - EXACT mobile logic */}
          {searchLoading && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg p-2">
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-gray-500">Searching...</span>
              </div>
            </div>
          )}
          
          {!searchLoading && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {searchResults.map((user: any) => {
                const isSelected = selectedExistingUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleSelectExistingUser(user)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ${
                      isSelected ? 'bg-primary/10 border-l-4 border-primary' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      {user.profilePhotoUrl || user.profile_photo_url ? (
                        <img
                          src={user.profilePhotoUrl || user.profile_photo_url}
                          alt={user.name || 'User'}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-primary text-sm font-semibold">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {user.name || 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.mobile || user.phone}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          
          {selectedExistingUser && (
            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
              <p className="text-xs text-green-700 dark:text-green-300">
                <span className="material-symbols-outlined text-sm align-middle mr-1">check_circle</span>
                User found: {selectedExistingUser.name} - Password field hidden
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedExistingUser(null);
                  setFormData({ ...formData, name: '', password: '' });
                }}
                className="text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100"
                title="Clear selection"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">
          Name *
          {selectedExistingUser && (
            <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-normal">
              (Auto-filled from existing user)
            </span>
          )}
        </label>
        <input
          type="text"
          required
          className={`w-full px-4 py-2 rounded-lg border ${
            selectedExistingUser
              ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
          } text-text-main`}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        {selectedExistingUser && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Name auto-filled from existing user. You can edit if needed.
          </p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Department</label>
        <select
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
          value={formData.department}
          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
        >
          <option value="">Select Department</option>
          {departments.map((dept: any) => (
            <option key={dept.id} value={dept.name}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Designation</label>
        <select
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
          value={formData.designation}
          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
        >
          <option value="">Select Designation</option>
          {designations.map((desg: any) => (
            <option key={desg.id} value={desg.name}>
              {desg.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Reporting To</label>
        <select
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
          value={formData.reportingTo}
          onChange={(e) => setFormData({ ...formData, reportingTo: e.target.value })}
        >
          <option value="">Self / None</option>
          {employees
            .filter((e) => !employee || e.id !== employee.id)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.mobile})
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Level</label>
        <input
          type="text"
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
          placeholder="e.g. L1, L2"
          value={formData.level}
          onChange={(e) => setFormData({ ...formData, level: e.target.value.toUpperCase() })}
        />
      </div>
      {employee && (
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Status</label>
          <select
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      )}
      {!employee && !selectedExistingUser && (
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Password *</label>
          <input
            type="password"
            required
            minLength={4}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
            placeholder="Minimum 4 characters"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Required for new users. If user exists in OrgIT, password field will disappear automatically.
          </p>
        </div>
      )}
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

