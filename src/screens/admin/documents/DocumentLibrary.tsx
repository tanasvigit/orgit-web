import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { documentInstanceService } from '../../../services/documentInstanceService';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { Button } from '../../../components/shared';
import { TaskCreateModal } from '../../../components/tasks/TaskCreateModal';
import { useToast } from '../../../context/ToastContext';

export const DocumentLibrary: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    status: '' as '' | 'draft' | 'final' | 'archived',
    templateId: '',
    search: '',
    page: 1,
    limit: 20,
  });
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);

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

  const openAssignTaskModal = (document: any) => {
    setSelectedDocument(document);
    setShowAssignTaskModal(true);
  };

  const handleTaskCreated = () => {
    setShowAssignTaskModal(false);
    setSelectedDocument(null);
    queryClient.invalidateQueries('tasks');
  };

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
        toast.success('Document status updated successfully!');
      },
      onError: (error: any) => {
        toast.error(`Failed to update status: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleDelete = async (id: string) => {
    toast.confirm('Are you sure you want to delete this document?', {
      onConfirm: () => deleteMutation.mutate(id),
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
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
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 relative">
        {/* Create Document Button - Top Right Corner */}
        <button
          onClick={() => navigate('/admin/documents/create')}
          className="fixed top-24 right-8 z-40 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/40 active:scale-95 hover:scale-105"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Create Document</span>
        </button>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">
              Document Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Create, manage, and organize your documents
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search documents..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                className="w-full rounded-lg border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value as any, page: 1 })}
                className="w-full rounded-lg border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="final">Final</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1">Template</label>
              <select
                value={filters.templateId}
                onChange={(e) => setFilters({ ...filters, templateId: e.target.value, page: 1 })}
                className="w-full rounded-lg border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
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
            <p className="text-slate-500 dark:text-gray-400">Loading documents...</p>
          </div>
        ) : data?.instances.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-gray-600 mb-4">description</span>
            <p className="text-slate-600 dark:text-gray-400 mb-4">No documents found</p>
            <Button onClick={() => navigate('/admin/documents/create')}>
              Create Your First Document
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {data?.instances.map((instance: any) => (
                  <tr key={instance.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{instance.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600 dark:text-gray-300">
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-slate-500 dark:text-gray-400 mr-2">
                          {templatesData?.find((t: any) => t.id === instance.templateId)?.type || 'DOC'}
                        </span>
                        {templatesData?.find((t: any) => t.id === instance.templateId)?.name || 'Unknown Template'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${instance.status === 'final'
                            ? 'bg-green-100 text-green-800'
                            : instance.status === 'draft'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                            }`}
                        >
                          {instance.status}
                        </span>
                        {instance.status === 'draft' && (
                          <button
                            onClick={() => {
                              toast.confirm('Mark this document as Final? This action cannot be undone.', {
                                onConfirm: () => updateStatusMutation.mutate({ id: instance.id, status: 'final' }),
                                confirmLabel: 'Mark Final',
                                cancelLabel: 'Cancel',
                              });
                            }}
                            disabled={updateStatusMutation.isLoading}
                            className="text-green-600 hover:text-green-800 hover:bg-green-50 p-1 rounded-full transition-colors disabled:opacity-50"
                            title="Mark as Final"
                          >
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-gray-400 font-medium">
                      {new Date(instance.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/admin/documents/${instance.id}`)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-all"
                          title="View Document"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        {instance.status === 'draft' && (
                          <button
                            onClick={() => navigate(`/admin/documents/${instance.id}?edit=true`)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                            title="Edit Data"
                          >
                            <span className="material-symbols-outlined">edit_square</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDownload(instance.id)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Download PDF"
                        >
                          <span className="material-symbols-outlined">download</span>
                        </button>
                        <button
                          onClick={() => openAssignTaskModal(instance)}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Assign as Task"
                        >
                          <span className="material-symbols-outlined">assignment</span>
                        </button>
                        <button
                          onClick={() => handleDelete(instance.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
              <div className="px-6 py-4 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-gray-400">
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

        {/* Assign as Task Modal */}
        {showAssignTaskModal && selectedDocument && (
          <TaskCreateModal
            visible={showAssignTaskModal}
            onClose={() => {
              setShowAssignTaskModal(false);
              setSelectedDocument(null);
            }}
            onSuccess={handleTaskCreated}
            initialTitle={selectedDocument.title || `Document: ${selectedDocument.id}`}
            initialDescription={`Document: ${selectedDocument.title}\n\nTemplate: ${templatesData?.find((t: any) => t.id === selectedDocument.templateId)?.name || 'Unknown'}\nStatus: ${selectedDocument.status || 'N/A'}`}
            documentId={selectedDocument.id}
          />
        )}
      </div>
    </AdminLayout>
  );
};

