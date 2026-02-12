import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { DocumentBuilderContent } from '../../../components/document-builder/DocumentBuilderLayout';
import { DocumentBuilderProvider, useDocumentBuilder } from '../../../components/document-builder/DocumentBuilderProvider';
import { serializeDocumentState } from '../../../components/document-builder/serializer';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../../components/shared';

// Wrapper to bridge the Router/Service with the Builder Context
const BuilderIntegration: React.FC<{ templateId?: string }> = ({ templateId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { state, dispatch } = useDocumentBuilder();

  // Fetch existing data
  const { data: existingData } = useQuery(
    ['documentTemplate', templateId],
    () => documentTemplateService.getById(templateId!).then((res) => res.data.data),
    {
      enabled: !!templateId,
      onSuccess: (data) => {
        let config = data.builderConfig;

        // Robust parsing for builderConfig
        if (typeof config === 'string') {
          try {
            config = JSON.parse(config);
          } catch (e) {
            console.error('Failed to parse builderConfig string', e);
            config = null;
          }
        }

        // Fallback to templateSchema._builderConfig if needed
        if (!config && data.templateSchema) {
          try {
            const schema = typeof data.templateSchema === 'string'
              ? JSON.parse(data.templateSchema)
              : data.templateSchema;
            config = schema._builderConfig;

            // Re-parse if it's still a string (nested stringification)
            if (typeof config === 'string') {
              config = JSON.parse(config);
            }
          } catch (e) {
            console.error('Failed to parse templateSchema', e);
          }
        }

        if (config && typeof config === 'object') {
          dispatch({ type: 'LOAD_TEMPLATE', payload: config });
        } else {
          // Fallback - try to infer from data if possible, or just set meta
          dispatch({ type: 'SET_META', payload: { name: data.name, type: data.type, status: data.status } });
        }
      }
    }
  );

  const mutation = useMutation(
    (data: any) => templateId
      ? documentTemplateService.update(templateId, data)
      : documentTemplateService.create(data),
    {
      onSuccess: () => {
        console.log('DEBUG: Template saved successfully');
        queryClient.invalidateQueries('documentTemplates');
        navigate('/super-admin/document-templates');
      },
      onError: (err: any) => {
        console.error('DEBUG: Failed to save template:', err);
        toast.error('Failed to save template: ' + (err.response?.data?.error || err.message));
      }
    }
  );

  const deleteMutation = useMutation(
    (id: string) => documentTemplateService.delete(id),
    {
      onSuccess: () => {
        console.log('DEBUG: Template deleted successfully');
        queryClient.invalidateQueries('documentTemplates');
        navigate('/super-admin/document-templates');
      },
      onError: (err: any) => {
        console.error('DEBUG: Failed to delete template:', err);
        toast.error('Failed to delete template: ' + (err.response?.data?.error || err.message));
      }
    }
  );

  const handleSave = () => {
    console.log('DEBUG: handleSave called. Current state:', state);
    try {
      const serialized = serializeDocumentState(state);
      console.log('DEBUG: Serialized state:', serialized);

      const payload = {
        name: state.meta.name || 'Untitled Template',
        type: state.meta.type || 'invoice',
        status: state.meta.status || 'draft',
        ...serialized
      };

      console.log('DEBUG: Sending payload to mutation:', payload);
      mutation.mutate(payload);
    } catch (e) {
      console.error('DEBUG: Error in handleSave serialization:', e);
      toast.error('Error preparing template data: ' + (e as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Action Bar (Top of Builder) */}
      <div className="bg-white dark:bg-[#1a2632] border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/super-admin/document-templates')} className="text-gray-500 hover:text-gray-700">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">
            {templateId ? 'Edit Template' : 'Create New Template'}
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={mutation.isLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 rounded-lg shadow-sm transition-all"
          >
            {mutation.isLoading ? 'Saving...' : 'Save Template'}
          </button>

          {templateId && (
            <button
              onClick={() => {
                toast.confirm('Are you sure you want to delete this template? This action cannot be undone.', {
                  onConfirm: () => deleteMutation.mutate(templateId!),
                  confirmLabel: 'Delete',
                  cancelLabel: 'Cancel',
                });
              }}
              disabled={deleteMutation.isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-transparent rounded-lg transition-all"
            >
              {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DocumentBuilderContent />
      </div>
    </div>
  );
};

const LegacyTemplateViewer: React.FC<{ template: any }> = ({ template }) => {
  const navigate = useNavigate();
  const schema = template?.templateSchema || {};
  const editableFields = Array.isArray(schema?.editableFields) ? schema.editableFields : [];

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{template?.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {schema?.lockedStructure ? 'System template (structure locked)' : 'Legacy template'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/super-admin/document-templates')}>
            <span className="material-symbols-outlined mr-2">arrow_back</span>
            Back
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Type</div>
            <div className="font-semibold text-gray-900 dark:text-white">{template?.type}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
            <div className="font-semibold text-gray-900 dark:text-white">{template?.status}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Version</div>
            <div className="font-semibold text-gray-900 dark:text-white">{template?.version}</div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Editable fields</h2>
          {editableFields.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No editable fields configured.</div>
          ) : (
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Label
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Required
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {editableFields.map((f: any) => (
                    <tr key={f.name}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{f.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{f.label || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{f.type || 'text'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">
                        {f.required ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Structure editing is disabled for this template in the web UI.
        </div>
      </div>
    </div>
  );
};

// Refactored Top Level Component
export const DocumentTemplateForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: template, isLoading } = useQuery(
    ['documentTemplate:maybeLegacy', id],
    async () => {
      if (!id) return null;
      const res = await documentTemplateService.getById(id);
      return res.data.data;
    },
    { enabled: !!id }
  );

  // Create mode: builder only
  if (!id) {
    return (
      <DocumentBuilderProvider>
        <BuilderIntegration templateId={undefined} />
      </DocumentBuilderProvider>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading template...</p>
        </div>
      </div>
    );
  }

  const hasBuilderConfig = !!(template as any)?.builderConfig || !!(template as any)?.templateSchema?._builderConfig;

  if (hasBuilderConfig) {
    return (
      <DocumentBuilderProvider>
        <BuilderIntegration templateId={id} />
      </DocumentBuilderProvider>
    );
  }

  return (
    <SuperAdminLayout breadcrumbs={[{ label: 'Document Management' }, { label: 'Templates' }]}>
      <LegacyTemplateViewer template={template} />
    </SuperAdminLayout>
  );
};
