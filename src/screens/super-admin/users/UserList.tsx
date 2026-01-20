import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { userService } from '../../../services/userService';
import { useAuth } from '../../../context/AuthContext';

export const UserList: React.FC = () => {
  const [filters, setFilters] = useState({ role: '', status: '', search: '', page: 1, limit: 20 });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [roleUpdate, setRoleUpdate] = useState<{ id: string; name: string; currentRole: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data, isLoading, error } = useQuery(
    ['users', filters],
    () => userService.getAll(filters).then((res) => res.data.data),
    {
      keepPreviousData: true,
    }
  );

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 0;

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    // Prevent deleting yourself
    if (deleteConfirm.id === currentUser?.id) {
      alert('You cannot delete your own account');
      setDeleteConfirm(null);
      return;
    }

    setIsDeleting(true);
    try {
      await userService.delete(deleteConfirm.id);
      queryClient.invalidateQueries(['users']);
      setDeleteConfirm(null);
    } catch (error: any) {
      alert(`Error deleting user: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateRole = async (newRole: string) => {
    if (!roleUpdate) return;

    // Prevent changing your own role
    if (roleUpdate.id === currentUser?.id) {
      alert('You cannot change your own role');
      setRoleUpdate(null);
      return;
    }

    setIsUpdatingRole(true);
    try {
      await userService.updateRole(roleUpdate.id, newRole);
      queryClient.invalidateQueries(['users']);
      setRoleUpdate(null);
      alert('Role updated successfully');
    } catch (error: any) {
      alert(`Error updating role: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
    <SuperAdminLayout
      breadcrumbs={[{ label: 'Users' }]}
      showSearch
      searchPlaceholder="Search users..."
    >
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Users</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
              Manage all users on the platform{total > 0 && ` (${total} total)`}
            </p>
          </div>
        </div>

        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search by name, mobile..."
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />
            <select
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })}
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="employee">Employee</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <select
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-12">
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-red-200 dark:border-red-800 p-6">
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400 text-4xl mb-4">error</span>
              <p className="text-red-600 dark:text-red-400 font-semibold">Error loading users</p>
              <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                {(error as any)?.response?.data?.error || (error as any)?.message || 'An unexpected error occurred'}
              </p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-12">
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-5xl mb-4">people</span>
              <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg">No users found</p>
              <p className="text-gray-500 dark:text-gray-500 mt-2 text-sm">
                {filters.search || filters.role || filters.status
                  ? 'Try adjusting your filters to see more results'
                  : 'No users are registered on the platform yet'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Mobile</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-super-admin-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {user.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.mobile}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                          {user.role.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {user.id !== currentUser?.id && (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setRoleUpdate({ id: user.id, name: user.name, currentRole: user.role })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Change Role"
                          >
                            <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                            <span>Change Role</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ id: user.id, name: user.name })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete user"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                      {user.id === currentUser?.id && (
                        <span className="text-gray-400 text-xs italic">Current User</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((filters.page - 1) * filters.limit) + 1} to{' '}
                  {Math.min(filters.page * filters.limit, total)} of {total} users
                  {totalPages > 1 && ` (Page ${filters.page} of ${totalPages})`}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page >= totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-super-admin-surface-dark rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Delete User</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone and will delete all associated data including messages, tasks, and notifications.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Role Update Dialog */}
        {roleUpdate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => !isUpdatingRole && setRoleUpdate(null)}>
            <div className="bg-white dark:bg-super-admin-surface-dark rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-2xl">admin_panel_settings</span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Change User Role</h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Select a new role for <strong className="text-gray-900 dark:text-white">{roleUpdate.name}</strong>.
              </p>

              <div className="space-y-3 mb-6">
                {['employee', 'admin', 'super_admin'].map((role) => (
                  <button
                    key={role}
                    onClick={() => handleUpdateRole(role)}
                    disabled={isUpdatingRole || role === roleUpdate.currentRole}
                    className={`w-full py-3 px-4 rounded-lg border-2 text-left flex justify-between items-center transition-all ${
                      role === roleUpdate.currentRole
                        ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300 shadow-sm'
                        : isUpdatingRole
                        ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">
                        {role === 'super_admin' ? 'shield_person' : role === 'admin' ? 'admin_panel_settings' : 'person'}
                      </span>
                      <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
                    </div>
                    {role === roleUpdate.currentRole && (
                      <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">check_circle</span>
                    )}
                    {isUpdatingRole && role !== roleUpdate.currentRole && (
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRoleUpdate(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  disabled={isUpdatingRole}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
};

