import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../../components/employee/EmployeeLayout';
import { useAuth } from '../../../context/AuthContext';
import { documentInstanceService } from '../../../services/documentInstanceService';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { Button } from '../../../components/shared';
import { DocumentBuilderProvider, useDocumentBuilder } from '../../../components/document-builder/DocumentBuilderProvider';
import { DocumentBuilderContent } from '../../../components/document-builder/DocumentBuilderLayout';

const DocumentEditorIntegration: React.FC<{ instance: any, id: string, onBack: () => void; isAdmin: boolean }> = ({ instance, id, onBack, isAdmin }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch } = useDocumentBuilder();
  const [title, setTitle] = useState(instance.title);

  // Load existing data into builder
  useEffect(() => {
    if (instance.filledData) {
      dispatch({
        type: 'LOAD_TEMPLATE',
        payload: { ...instance.filledData, mode: 'fill' }
      });
    }
  }, [instance.filledData, dispatch]);

  const mutation = useMutation(
    (data: any) => documentInstanceService.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documentInstance', id]);
        queryClient.invalidateQueries('documentInstances');
        navigate(`/admin/documents/${id}`);
      },
      onError: (err: any) => {
        alert('Failed to save changes: ' + (err.response?.data?.error || err.message));
      }
    }
  );

  const handleSave = () => {
    mutation.mutate({
      title,
      filledData: state
    });
  };

  const Layout = isAdmin ? AdminLayout : EmployeeLayout;

  return (
    <Layout hideHeader={isAdmin}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase block">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-bold text-gray-900 border-none p-0 focus:ring-0 w-64 text-lg"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>Cancel</Button>
            <Button onClick={handleSave} disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <DocumentBuilderContent />
        </div>
      </div>
    </Layout>
  );
};

export const DocumentViewer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const queryClient = useQueryClient();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const isAdmin = user?.role === 'admin';

  const { data: instance, isLoading } = useQuery(
    ['documentInstance', id],
    () => documentInstanceService.getById(id!),
    { enabled: !!id }
  );

  const { data: template } = useQuery(
    ['template', instance?.templateId],
    () => documentTemplateService.getById(instance!.templateId).then(res => res.data.data),
    { enabled: !!instance?.templateId }
  );

  // Robust PDF loading via Blob
  useEffect(() => {
    if (id && !isEditMode && instance) {
      setIsPdfLoading(true);
      documentInstanceService.download(id)
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          setBlobUrl(url);
          setIsPdfLoading(false);
        })
        .catch(err => {
          console.error('Failed to load PDF preview:', err);
          setIsPdfLoading(false);
        });
    }
    return () => {
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl);
      }
    };
  }, [id, isEditMode, instance?.id, instance?.updatedAt]);

  const updateStatusMutation = useMutation(
    (newStatus: 'draft' | 'final') => {
      return documentInstanceService.update(id!, {
        status: newStatus,
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documentInstance', id]);
        queryClient.invalidateQueries('documentInstances');
        alert('Document status updated successfully!');
      },
      onError: (error: any) => {
        alert(`Failed to update status: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const deleteMutation = useMutation(
    () => documentInstanceService.delete(id!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documentInstances');
        navigate(isAdmin ? '/admin/documents' : '/documents');
      },
    }
  );

  const handleDownload = async () => {
    let url = blobUrl;
    let shouldRevoke = false;

    try {
      if (!url) {
        const blob = await documentInstanceService.download(id!);
        url = window.URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = `${instance?.title || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        if (shouldRevoke && url) window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 150);
    } catch (error) {
      alert('Failed to download document');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate();
    }
  };

  const Layout = isAdmin ? AdminLayout : EmployeeLayout;

  if (isLoading) {
    return (
      <Layout>
        <div className="p-6 md:p-8">
          <div className="text-center py-12">
            <p className="text-slate-500">Loading document details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!instance) {
    return (
      <Layout>
        <div className="p-6 md:p-8">
          <div className="text-center py-12">
            <p className="text-slate-500">Document not found</p>
            <Button onClick={() => navigate(isAdmin ? '/admin/documents' : '/documents')} className="mt-4">
              Back to Library
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (isEditMode && instance.status === 'draft') {
    return (
      <DocumentBuilderProvider>
        <DocumentEditorIntegration
          instance={instance}
          id={id!}
          isAdmin={isAdmin}
          onBack={() => navigate(isAdmin ? `/admin/documents/${id}` : `/documents/${id}`)}
        />
      </DocumentBuilderProvider>
    );
  }

  return (
    <Layout>
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(isAdmin ? '/admin/documents' : '/documents')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{instance.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-600 font-medium">{template?.name || 'Loading template...'}</p>
                <span className="text-slate-400">•</span>
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
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {instance.status === 'draft' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => navigate(isAdmin ? `/admin/documents/${id}?edit=true` : `/documents/${id}?edit=true`)}
                >
                  <span className="material-symbols-outlined mr-2">edit</span>
                  Edit Data
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to mark this document as Final? This action cannot be undone.')) {
                      updateStatusMutation.mutate('final');
                    }
                  }}
                  disabled={updateStatusMutation.isLoading}
                >
                  <span className="material-symbols-outlined mr-2">check_circle</span>
                  {updateStatusMutation.isLoading ? 'Updating...' : 'Mark as Final'}
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleDownload}>
              <span className="material-symbols-outlined mr-2">download</span>
              Download PDF
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <span className="material-symbols-outlined mr-2">delete</span>
              Delete
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">description</span>
              Document Preview
            </h2>
            <div className="flex items-center gap-4">
              {isPdfLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] text-primary font-bold uppercase">Loading Preview...</span>
                </div>
              )}
              <p className="text-xs text-slate-500 italic">This is a live generated PDF</p>
            </div>
          </div>
          <div className="relative bg-slate-100 min-h-[500px] flex items-center justify-center">
            {blobUrl ? (
              <iframe
                src={`${blobUrl}#toolbar=0&navpanes=0`}
                className="w-full h-[75vh] border-none"
                title="PDF Preview"
              />
            ) : (
              <div className="text-center py-24 flex flex-col items-center">
                <span className="material-symbols-outlined text-5xl text-slate-300 animate-pulse mb-4">description</span>
                <p className="text-slate-400 text-sm font-medium">
                  {isPdfLoading ? 'Fetching secure PDF data...' : 'Failed to display preview'}
                </p>
                {!isPdfLoading && (
                  <Button variant="outline" size="sm" className="mt-6" onClick={() => window.location.reload()}>
                    <span className="material-symbols-outlined mr-2">refresh</span>
                    Retry Preview
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};
