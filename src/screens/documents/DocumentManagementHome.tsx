import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { documentInstanceService } from '../../services/documentInstanceService';
import { documentTemplateService } from '../../services/documentTemplateService';
import { getDocuments as getLocalDocuments, deleteDocument as deleteLocalDocument } from '../../services/localDocumentService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/shared';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';

export const DocumentManagementHome: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
  const [localDocuments, setLocalDocuments] = useState<any[]>([]);
  const [showLocalOnly, setShowLocalOnly] = useState(false);

  const { data, isLoading } = useQuery(
    ['documentInstances', filters],
    () => documentInstanceService.list(filters),
    { keepPreviousData: true, enabled: !showLocalOnly }
  );

  // Load local documents
  useEffect(() => {
    const loadLocalDocs = async () => {
      try {
        const localDocs = await getLocalDocuments({
          status: filters.status || undefined,
          search: filters.search || undefined,
        });
        setLocalDocuments(localDocs);
      } catch (error) {
        console.error('Error loading local documents:', error);
        setLocalDocuments([]);
      }
    };
    loadLocalDocs();
  }, [filters.status, filters.search, showLocalOnly]);

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

  const handleDelete = (id: string, isLocal: boolean = false) => {
    toast.confirm('Are you sure you want to delete this document?', {
      onConfirm: async () => {
        if (isLocal) {
          try {
            await deleteLocalDocument(id);
            setLocalDocuments(prev => prev.filter(doc => doc.id !== id));
            toast.success('Document deleted successfully!');
          } catch (error) {
            toast.error('Failed to delete local document');
          }
        } else {
          deleteMutation.mutate(id);
        }
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const handleDownload = async (id: string, isLocal: boolean = false) => {
    try {
      if (isLocal) {
        const { downloadDocument } = await import('../../services/localDocumentService');
        await downloadDocument(id);
      } else {
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
      }
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  // Create Document button
  const createDocumentButton = (
    <button
      onClick={() => navigate('/documents/create')}
      className="font-bold rounded-lg transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 active:scale-[0.98] flex items-center justify-center bg-primary text-white shadow-md hover:bg-primary/90 px-5 py-2.5 gap-2"
    >
      <span className="material-symbols-outlined">add</span>
      Create Document
    </button>
  );

  const content = (
    <div className="p-6 md:p-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            Document Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Manage your documents and track progress
          </p>
        </div>
        {createDocumentButton}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 shadow-sm">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowLocalOnly(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !showLocalOnly
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            All Documents
          </button>
          <button
            onClick={() => setShowLocalOnly(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showLocalOnly
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Local Documents
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search documents..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              className="w-full rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any, page: 1 })}
              className="w-full rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
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
              className="w-full rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:border-primary focus:ring-primary py-2 px-3"
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
      {showLocalOnly ? (
        localDocuments.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">description</span>
            <p className="text-gray-600 dark:text-gray-400 mb-4">No local documents found</p>
            <Button onClick={() => navigate('/documents/create')}>
              Upload Your First Document
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    File Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {localDocuments.map((instance: any) => (
                  <tr key={instance.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">{instance.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600 dark:text-gray-400">{instance.originalName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-3 py-1 text-[10px] font-bold uppercase rounded-full bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300">
                        {instance.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(instance.uploadedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/documents/${instance.id}?local=true`)}
                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                          title="View Document"
                        >
                          <span className="material-symbols-outlined">visibility</span>
                        </button>
                        <button
                          onClick={() => handleDownload(instance.id, true)}
                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                          title="Download"
                        >
                          <span className="material-symbols-outlined">download</span>
                        </button>
                        <button
                          onClick={() => handleDelete(instance.id, true)}
                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
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
          </div>
        )
      ) : isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading documents...</p>
        </div>
      ) : data?.instances.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">description</span>
          <p className="text-gray-600 dark:text-gray-400 mb-4">No documents found</p>
          <Button onClick={() => navigate('/documents/create')}>
            Create Your First Document
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Template
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
                <tr key={instance.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{instance.title}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400 mr-2">
                        {templatesData?.find((t: any) => t.id === instance.templateId)?.type || 'DOC'}
                      </span>
                      {templatesData?.find((t: any) => t.id === instance.templateId)?.name || 'Unknown Template'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${instance.status === 'final'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          : instance.status === 'draft'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-300'
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
                          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 p-1 rounded-full transition-colors disabled:opacity-50"
                          title="Mark as Final"
                        >
                          <span className="material-symbols-outlined text-lg">check_circle</span>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {new Date(instance.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/documents/${instance.id}`)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="View Document"
                      >
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      {instance.status === 'draft' && (
                        <button
                          onClick={() => navigate(`/documents/${instance.id}?edit=true`)}
                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                          title="Edit Data"
                        >
                          <span className="material-symbols-outlined">edit_square</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(instance.id, false)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                        title="Download PDF"
                      >
                        <span className="material-symbols-outlined">download</span>
                      </button>
                      <button
                        onClick={() => openAssignTaskModal(instance)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                        title="Assign as Task"
                      >
                        <span className="material-symbols-outlined">assignment</span>
                      </button>
                      <button
                        onClick={() => handleDelete(instance.id, false)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
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
          documentAttachment={selectedDocument.pdfUrl ? {
            mediaUrl: selectedDocument.pdfUrl,
            fileName: `${(selectedDocument.title || 'document').replace(/[^a-zA-Z0-9-_.]/g, '_')}.pdf`,
            mimeType: 'application/pdf',
          } : undefined}
        />
      )}
    </div>
  );

  // Wrap in EmployeeLayout (keeping employee sidebar)
  return (
    <EmployeeLayout>
      {content}
    </EmployeeLayout>
  );
};

