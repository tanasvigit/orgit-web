import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { documentInstanceService } from '../../../services/documentInstanceService';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { Button } from '../../../components/shared';

export const DocumentInstanceList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    status: '' as '' | 'draft' | 'final' | 'archived',
    templateId: '',
    search: '',
    page: 1,
    limit: 20,
  });

  const { data, isLoading } = useQuery(
    ['documentInstances', filters],
    () => documentInstanceService.list(filters),
    { keepPreviousData: true }
  );

  const { data: templatesData } = useQuery(
    'activeTemplates',
    async () => {
      const res = await documentTemplateService.getActiveTemplates();
      return res.data.data;
    }
  );

  const deleteMutation = useMutation(
    (id: string) => documentInstanceService.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documentInstances');
      },
    }
  );

  const updateStatusMutation = useMutation(
    ({ id, status }: { id: string; status: 'draft' | 'final' }) => {
      return documentInstanceService.update(id, {
        status: status,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documentInstances');
        alert('Document status updated successfully!');
      },
      onError: (error: any) => {
        alert(`Failed to update status: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const blob = await documentInstanceService.download(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download document');
    }
  };

  return (
    <SuperAdminLayout
      breadcrumbs={[{ label: 'Document Management' }, { label: 'Document Instances' }]}
      showSearch
      searchPlaceholder="Search documents..."
    >
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Document Instances</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">View and manage all documents created from templates across all organizations</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search documents..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-super-admin-primary focus:ring-super-admin-primary py-2 px-3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as any, page: 1 })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-super-admin-primary focus:ring-super-admin-primary py-2 px-3"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="final">Final</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Template</label>
              <select
                value={filters.templateId}
                onChange={(e) => setFilters({ ...filters, templateId: e.target.value, page: 1 })}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-super-admin-primary focus:ring-super-admin-primary py-2 px-3"
              >
                <option value="">All Templates</option>
                {templatesData?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({ status: '', templateId: '', search: '', page: 1, limit: 20 })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Documents Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading documents...</p>
          </div>
        ) : data?.instances.length === 0 ? (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">description</span>
            <p className="text-gray-600 dark:text-gray-400 mb-4">No documents found</p>
          </div>
        ) : (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {data?.instances.map((instance: any) => (
                  <tr key={instance.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{instance.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {templatesData?.find((t: any) => t.id === instance.templateId)?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {instance.organizationId ? instance.organizationId.substring(0, 8) + '...' : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            instance.status === 'final'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : instance.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {instance.status}
                        </span>
                        {instance.status === 'draft' && (
                          <button
                            onClick={() => {
                              if (window.confirm('Mark this document as Final? This action cannot be undone.')) {
                                updateStatusMutation.mutate({ id: instance.id, status: 'final' });
                              }
                            }}
                            disabled={updateStatusMutation.isLoading}
                            className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium disabled:opacity-50"
                            title="Mark as Final"
                          >
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(instance.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/super-admin/document-instances/${instance.id}`)}
                          className="text-super-admin-primary hover:text-super-admin-primary-hover"
                          title="View"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        {instance.status === 'draft' && (
                          <button
                            onClick={() => navigate(`/super-admin/document-instances/${instance.id}?edit=true`)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(instance.id)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                          title="Download"
                        >
                          <span className="material-symbols-outlined">download</span>
                        </button>
                        <button
                          onClick={() => handleDelete(instance.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {((filters.page - 1) * filters.limit) + 1} to{' '}
                  {Math.min(filters.page * filters.limit, data.total)} of {data.total} documents
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                    disabled={filters.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                    disabled={filters.page >= data.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
};

