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
import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { employeeService, Employee } from '../../../services/employeeService';
import { useAuth } from '../../../context/AuthContext';

export const EmployeeList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

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
      alert('Employee removed successfully');
    } catch (error: any) {
      alert(`Error removing employee: ${error.response?.data?.error || error.message}`);
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
          alert('Please enter a valid 10-digit mobile number');
          setIsSaving(false);
          return;
        }
        
        const digitsOnly = formattedMobile.replace(/\D/g, '');
        if (digitsOnly.length !== 12 || !formattedMobile.startsWith('+91')) {
          alert('Please enter a valid 10-digit mobile number');
          setIsSaving(false);
          return;
        }
        
        submitData.mobile = formattedMobile;
      }
      
      if (editEmployee) {
        await employeeService.updateEmployee(editEmployee.id, submitData);
        alert('Employee updated successfully');
      } else {
        await employeeService.addEmployee(submitData);
        alert('Employee added successfully');
      }
      queryClient.invalidateQueries('employees');
      setEditEmployee(null);
      setShowAddForm(false);
    } catch (error: any) {
      alert(`Error saving employee: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout
      headerActions={
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-primary hover:bg-primary-dark text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-all shadow-md shadow-primary/20 active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Add Employee</span>
        </button>
      }
    >
      <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-text-main tracking-tight">Employees</h2>
            <p className="text-text-muted mt-2 text-sm md:text-base">
              Manage employees in your organization{filteredEmployees.length > 0 && ` (${filteredEmployees.length} total)`}
            </p>
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
                onSave={handleSaveEmployee}
                onCancel={() => {
                  setEditEmployee(null);
                  setShowAddForm(false);
                }}
                isSaving={isSaving}
              />
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
  onSave: (data: any) => void;
  onCancel: () => void;
  isSaving: boolean;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee, onSave, onCancel, isSaving }) => {
  const [formData, setFormData] = useState({
    mobile: employee?.mobile || '',
    name: employee?.name || '',
    department: employee?.department || '',
    designation: employee?.designation || '',
    status: employee?.status || 'active',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = { ...formData };
    if (employee) {
      // For updates, don't send password if not changed
      if (!submitData.password) {
        delete submitData.password;
      }
      delete submitData.mobile; // Can't change mobile
    } else {
      // For new employees, password is required
      if (!submitData.password) {
        alert('Password is required for new employees');
        return;
      }
    }
    onSave(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!employee && (
        <div>
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
              setFormData({ ...formData, mobile: value });
            }}
            maxLength={15}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Enter any 10-digit mobile number (will be formatted automatically)
          </p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Name *</label>
        <input
          type="text"
          required
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Department *</label>
        <input
          type="text"
          required
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
          value={formData.department}
          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Designation</label>
        <input
          type="text"
          className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
          value={formData.designation}
          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
        />
      </div>
      {/* Note: Reporting To can be set later via edit, requires employee ID selection */}
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
      {!employee && (
        <div>
          <label className="block text-sm font-medium text-text-main mb-1">Password *</label>
          <input
            type="password"
            required
            minLength={6}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main"
            placeholder="Minimum 6 characters"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />
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

