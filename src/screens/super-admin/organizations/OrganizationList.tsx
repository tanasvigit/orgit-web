import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { useToast } from '../../../context/ToastContext';
import { organizationService } from '../../../services/organizationService';

export const OrganizationList: React.FC = () => {
  const { toast } = useToast();
  const [filters, setFilters] = useState({ status: '', search: '', page: 1, limit: 20 });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery(
    ['organizations', filters],
    () => organizationService.getAll(filters).then((res) => {
      // Handle both possible response structures
      if (res.data?.data) {
        return res.data.data;
      }
      // Fallback if data is directly in res.data
      return res.data;
    }),
    {
      onError: (error: any) => {
        console.error('Error fetching organizations:', error);
      }
    }
  );

  const organizations = data?.organizations || [];
  const total = data?.total || 0;

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    setIsDeleting(true);
    try {
      await organizationService.delete(deleteConfirm.id);
      queryClient.invalidateQueries(['organizations']);
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(`Error deleting organization: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SuperAdminLayout
      breadcrumbs={[{ label: 'Organisations' }]}
      showSearch
      searchPlaceholder="Search organisations..."
    >
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Organisations</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
              Manage all organizations on the platform
            </p>
          </div>
          <Link
            to="/super-admin/organizations/create"
            className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium"
          >
            <span className="material-symbols-outlined text-xl">add</span>
            Create Organisation
          </Link>
        </div>

        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search by name, email, mobile..."
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />
            <select
              className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-super-admin-primary"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading organizations...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <span className="material-symbols-outlined text-red-500 text-4xl mb-2">error</span>
            <p className="text-red-600 dark:text-red-400 font-semibold mb-1">Error loading organizations</p>
            <p className="text-red-500 dark:text-red-500 text-sm">
              {error instanceof Error ? error.message : 'Failed to fetch organizations'}
            </p>
          </div>
        ) : organizations.length === 0 ? (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-12 text-center">
            <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-6xl mb-4">business</span>
            <p className="text-gray-600 dark:text-gray-400 font-semibold text-lg mb-2">No organizations found</p>
            <p className="text-gray-500 dark:text-gray-500 text-sm mb-6">
              {filters.search || filters.status ? 'Try adjusting your filters' : 'Get started by creating your first organization'}
            </p>
            {(!filters.search && !filters.status) && (
              <Link
                to="/super-admin/organizations/create"
                className="inline-flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium"
              >
                <span className="material-symbols-outlined text-xl">add</span>
                Create Organisation
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Mobile</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-super-admin-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                {organizations.map((org: any) => (
                  <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link to={`/super-admin/organizations/${org.id}`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-super-admin-primary">
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{org.email || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{org.mobile || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        {org.status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to={`/super-admin/organizations/${org.id}`}
                          className="text-super-admin-primary hover:text-super-admin-primary-hover"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm({ id: org.id, name: org.name })}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete organization"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-super-admin-surface-dark rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Delete Organization</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone and will delete all associated users, tasks, and data.
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
      </div>
    </SuperAdminLayout>
  );
};

