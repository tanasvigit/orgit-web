import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../../components/employee/EmployeeLayout';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { documentInstanceService } from '../../../services/documentInstanceService';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { getDocumentById as getLocalDocumentById, getDocumentBlobUrl, downloadDocument as downloadLocalDocument, viewDocument as viewLocalDocument } from '../../../services/localDocumentService';
import { Button } from '../../../components/shared';
import { DocumentBuilderProvider, useDocumentBuilder } from '../../../components/document-builder/DocumentBuilderProvider';
import { DocumentBuilderContent } from '../../../components/document-builder/DocumentBuilderLayout';
import { SchemaDrivenDocumentEditor } from '../../../components/document-templates/SchemaDrivenDocumentEditor';

// NOTE: Editing is disabled, but we keep these components in place
// to avoid large refactors. They are no longer reachable from the UI.
const DocumentEditorIntegration: React.FC<{ instance: any, id: string, onBack: () => void; isAdmin: boolean }> = ({ instance, id, onBack, isAdmin }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch } = useDocumentBuilder();
  const { toast } = useToast();
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
        toast.error('Failed to save changes: ' + (err.response?.data?.error || err.message));
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

const SchemaDocumentEditorIntegration: React.FC<{
  instance: any;
  template: any;
  id: string;
  onBack: () => void;
  isAdmin: boolean;
}> = ({ instance, template, id, onBack, isAdmin }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(instance.title);

  const mutation = useMutation(
    (data: any) => documentInstanceService.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documentInstance', id]);
        queryClient.invalidateQueries('documentInstances');
        navigate(`/admin/documents/${id}`);
      },
      onError: (err: any) => {
        toast.error('Failed to save changes: ' + (err.response?.data?.error || err.message));
      },
    }
  );

  const Layout = isAdmin ? AdminLayout : EmployeeLayout;

  const schema = template?.templateSchema || {};
  const initialValues = {
    ...(instance.filledData || {}),
    item_rows: Array.isArray(instance?.filledData?.item_rows)
      ? instance.filledData.item_rows.map((r: any) => ({
          ...r,
          detailsText: Array.isArray(r?.details) ? r.details.join('\n') : r.detailsText,
        }))
      : instance?.filledData?.item_rows,
  };

  const normalizeForSubmit = (data: Record<string, any>) => {
    const out = { ...(data || {}) };
    if (Array.isArray(out.item_rows)) {
      out.item_rows = out.item_rows.map((row: any) => {
        const r = { ...(row || {}) };
        if (typeof r.detailsText === 'string' && r.detailsText.trim().length > 0) {
          r.details = r.detailsText
            .split(/\r?\n/)
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
        delete r.detailsText;
        return r;
      });
    }
    return out;
  };

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
                className="font-bold text-gray-900 border-none p-0 focus:ring-0 w-72 text-lg"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Data</h2>
              <p className="text-sm text-gray-500">Structure is locked. You can edit fields and rows only.</p>
            </div>

            {/* Wrap editor so the top Save button can submit */}
            <div>
              <SchemaDrivenDocumentEditor
                schema={schema}
                initialValues={initialValues}
                submitLabel={mutation.isLoading ? 'Saving...' : 'Save Changes'}
                disabled={mutation.isLoading}
                onCancel={onBack}
                onSubmit={async (formData) => {
                  const filledData = normalizeForSubmit(formData);
                  mutation.mutate({
                    title,
                    filledData,
                  });
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const DocumentViewer: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const isLocal = searchParams.get('local') === 'true';
  const queryClient = useQueryClient();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [localDocument, setLocalDocument] = useState<any | null>(null);
  const isAdmin = user?.role === 'admin';

  const { data: instance, isLoading } = useQuery(
    ['documentInstance', id],
    () => documentInstanceService.getById(id!),
    { enabled: !!id && !isLocal }
  );

  // Load local document
  React.useEffect(() => {
    if (isLocal && id) {
      const loadLocal = async () => {
        try {
          const doc = await getLocalDocumentById(id);
          setLocalDocument(doc);
          if (doc) {
            const url = await getDocumentBlobUrl(id);
            setBlobUrl(url);
          }
        } catch (error) {
          console.error('Error loading local document:', error);
        }
      };
      loadLocal();
    }
  }, [isLocal, id]);

  const { data: template } = useQuery(
    ['template', instance?.templateId],
    () => documentTemplateService.getById(instance!.templateId).then(res => res.data.data),
    { enabled: !!instance?.templateId }
  );

  // Robust PDF loading via Blob
  useEffect(() => {
    if (id && !isEditMode && !isLocal && instance) {
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
  }, [id, isEditMode, isLocal, instance?.id, instance?.updatedAt]);

  const markCheckedMutation = useMutation(
    () => documentInstanceService.markChecked(id!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documentInstance', id]);
        queryClient.invalidateQueries('documentInstances');
        toast.success('Marked as Checked');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Failed to mark checked');
      },
    }
  );

  const markApprovedMutation = useMutation(
    () => documentInstanceService.markApproved(id!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documentInstance', id]);
        queryClient.invalidateQueries('documentInstances');
        toast.success('Marked as Approved');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Failed to mark approved');
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
    try {
      if (isLocal) {
        await downloadLocalDocument(id!);
      } else {
        let url = blobUrl;
        let shouldRevoke = false;

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
      }
    } catch (error) {
      toast.error('Failed to download document');
    }
  };

  const handleDelete = () => {
    toast.confirm('Are you sure you want to delete this document?', {
      onConfirm: async () => {
        if (isLocal) {
          try {
            const { deleteDocument } = await import('../../../services/localDocumentService');
            await deleteDocument(id!);
            navigate(isAdmin ? '/admin/documents' : '/documents');
          } catch (error) {
            toast.error('Failed to delete local document');
          }
        } else {
          deleteMutation.mutate();
        }
      },
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const Layout = isAdmin ? AdminLayout : EmployeeLayout;

  const currentInstance = isLocal ? localDocument : instance;
  const flow = !isLocal ? (currentInstance as any)?.filledData?.approval_flow : null;
  const flowEnabled = !!flow?.enabled;
  const flowStage = flow?.stage as string | undefined;
  const isCheckedByMe = !!user?.id && flow?.checkedByUserId === user.id;
  const isApprovedByMe = !!user?.id && flow?.approvedByUserId === user.id;

  if ((isLoading && !isLocal) || (isLocal && !localDocument && !isEditMode)) {
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

  if (!currentInstance) {
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

  // Editing is disabled: documents are generated at creation time.

  return (
    <Layout>
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(isAdmin ? '/admin/documents' : '/documents')} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{currentInstance.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                {!isLocal && (
                  <>
                    <p className="text-slate-600 font-medium">{template?.name || 'Loading template...'}</p>
                    <span className="text-slate-400">•</span>
                  </>
                )}
                {isLocal && (
                  <>
                    <p className="text-slate-600 font-medium text-sm">{currentInstance.originalName}</p>
                    <span className="text-slate-400">•</span>
                  </>
                )}
                <span
                  className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${currentInstance.status === 'final'
                    ? 'bg-green-100 text-green-800'
                    : currentInstance.status === 'draft'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-800'
                    }`}
                >
                  {currentInstance.status || 'draft'}
                </span>
                {!isLocal && flowEnabled && (
                  <span className="px-3 py-1 text-[10px] font-bold uppercase rounded-full bg-blue-100 text-blue-800">
                    {flowStage || 'prepared'}
                  </span>
                )}
                {isLocal && (
                  <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-blue-100 text-blue-800">
                    Local
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {!isLocal && currentInstance.status === 'draft' && (
              <>
                {flowEnabled && flowStage === 'prepared' && isCheckedByMe && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      toast.confirm('Mark this document as Checked? This will send it to Approved By.', {
                        onConfirm: () => markCheckedMutation.mutate(),
                        confirmLabel: 'Mark Checked',
                        cancelLabel: 'Cancel',
                      });
                    }}
                    disabled={markCheckedMutation.isLoading}
                  >
                    <span className="material-symbols-outlined mr-2">fact_check</span>
                    {markCheckedMutation.isLoading ? 'Updating...' : 'Mark Checked'}
                  </Button>
                )}

                {flowEnabled && flowStage === 'checked' && isApprovedByMe && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      toast.confirm('Mark this document as Approved? This will finalize the PDF.', {
                        onConfirm: () => markApprovedMutation.mutate(),
                        confirmLabel: 'Mark Approved',
                        cancelLabel: 'Cancel',
                      });
                    }}
                    disabled={markApprovedMutation.isLoading}
                  >
                    <span className="material-symbols-outlined mr-2">verified</span>
                    {markApprovedMutation.isLoading ? 'Updating...' : 'Mark Approved'}
                  </Button>
                )}
              </>
            )}
            {isLocal && (
              <Button
                variant="outline"
                onClick={() => viewLocalDocument(id!)}
              >
                <span className="material-symbols-outlined mr-2">open_in_new</span>
                Open in New Tab
              </Button>
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
