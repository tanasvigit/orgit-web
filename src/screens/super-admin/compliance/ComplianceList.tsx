import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { complianceService, getScopeBadge } from '../../../services/complianceService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { ComplianceMaster } from '../../../../shared/src/types';
import { ComplianceExcelGrid } from './ComplianceExcelGrid';

export const ComplianceList: React.FC = () => {
  const [filters, setFilters] = useState({ category: '', status: '', scope: '', search: '', page: 1, limit: 20 });
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === 'super_admin';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery(
    ['compliance', filters],
    () => complianceService.getAll(filters).then((res) => res.data.data)
  );

  const items: ComplianceMaster[] = data?.items || [];

  const handleDelete = async (id: string, scope: 'GLOBAL' | 'ORG') => {
    if (!isSuperAdmin && scope === 'GLOBAL') {
      toast.error('You cannot delete Global compliances');
      return;
    }

    toast.confirm('Are you sure you want to delete this compliance?', {
      onConfirm: async () => {
        try {
          await complianceService.delete(id);
          queryClient.invalidateQueries('compliance');
          toast.success('Compliance deleted successfully');
        } catch (error: any) {
          toast.error(`Error: ${error.response?.data?.error || error.message}`);
        }
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const canEdit = (item: ComplianceMaster): boolean => {
    if (isSuperAdmin) {
      return item.scope === 'GLOBAL';
    }
    return item.scope === 'ORG';
  };

  return (
    <SuperAdminLayout
      breadcrumbs={[{ label: 'Compliance Management' }]}
      showSearch
      searchPlaceholder="Search compliance items..."
    >
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Compliance Management</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
              {isSuperAdmin
                ? 'Manage platform-level compliance requirements (Global and Organisation)'
                : 'Manage compliance requirements for your organisation'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Excel View is the only view for Super Admin */}
          </div>
        </div>

        {/* Excel Grid View for Super Admin */}
        {isSuperAdmin ? (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark overflow-hidden h-[calc(100vh-250px)]">
            <ComplianceExcelGrid />
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Search by title, description..."
                  className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                />
                <select
                  className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
                >
                  <option value="">All Categories</option>
                  {/* Categories will be populated from API */}
                </select>
                <select
                  className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                {isSuperAdmin && (
                  <select
                    className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-sm"
                    value={filters.scope}
                    onChange={(e) => setFilters({ ...filters, scope: e.target.value, page: 1 })}
                  >
                    <option value="">All Scopes</option>
                    <option value="GLOBAL">Global</option>
                    <option value="ORG">Organisation</option>
                  </select>
                )}
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12">Loading...</div>
            ) : (
              <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Title</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Category</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Scope</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-super-admin-surface-dark divide-y divide-gray-200 dark:divide-gray-700">
                    {items.map((item) => {
                      const scopeBadge = getScopeBadge(item.scope);
                      const editable = canEdit(item);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              to={`/super-admin/compliance/${item.id}`}
                              className="text-sm font-bold text-gray-900 dark:text-white hover:text-super-admin-primary"
                            >
                              {item.title}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">{item.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              item.scope === 'GLOBAL'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                              {scopeBadge.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {item.complianceType === 'RECURRING' ? `${item.complianceType} (${item.frequency})` : item.complianceType}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              item.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                to={`/super-admin/compliance/${item.id}`}
                                className="text-super-admin-primary hover:text-super-admin-primary-hover"
                              >
                                View
                              </Link>
                              {editable && (
                                <>
                                  <Link
                                    to={`/super-admin/compliance/${item.id}/edit`}
                                    className="text-gray-400 hover:text-super-admin-primary"
                                    title="Edit"
                                  >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                  </Link>
                                  <button
                                    onClick={() => handleDelete(item.id, item.scope)}
                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                                    title="Delete"
                                  >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                  </button>
                                </>
                              )}
                              {!editable && (
                                <span className="text-gray-400 text-xs" title="Read-only">
                                  <span className="material-symbols-outlined text-lg">lock</span>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </SuperAdminLayout>
  );
};
