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
import {
  SystemTemplateDesignPreview,
  isSystemInlineTemplate,
  resolveSystemTemplateKey,
} from '../../../components/document-templates/SystemTemplateDesignPreview';

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
        // Super Admin templates default to 'active' so they're immediately visible to all users
        status: state.meta.status || 'active',
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
  const rawSchema = template?.templateSchema;
  const schema =
    typeof rawSchema === 'string'
      ? (() => {
          try {
            return JSON.parse(rawSchema);
          } catch {
            return {};
          }
        })()
      : rawSchema || {};
  const editableFields = Array.isArray(schema?.editableFields) ? schema.editableFields : [];
  const systemKey = resolveSystemTemplateKey(template, schema);
  const showDesignPreview = isSystemInlineTemplate(systemKey);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-6 md:px-8 md:pt-8 pb-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2632]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{template?.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {schema?.lockedStructure ? 'System template (structure locked)' : 'Legacy template'}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/super-admin/document-templates')}>
            <span className="material-symbols-outlined mr-2">arrow_back</span>
            Back
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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
      </div>

      {showDesignPreview ? (
        <div className="min-h-[75vh] overflow-auto bg-gray-200 dark:bg-gray-900 py-6">
          <div className="max-w-[860px] mx-auto px-4 mb-3">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Design preview</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Blank template layout. Users fill this from Documents → Create Document.
            </p>
          </div>
          <SystemTemplateDesignPreview template={template} schema={schema} />
        </div>
      ) : (
        <div className="p-6 md:p-8">
          <div className="bg-white dark:bg-[#1a2632] rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500">
            No visual preview is configured for this template.
          </div>
        </div>
      )}

      <details className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a2632]">
        <summary className="cursor-pointer px-6 md:px-8 py-4 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800">
          Field schema (technical)
        </summary>
        <div className="px-6 md:px-8 pb-6">
          {editableFields.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">No editable fields configured.</div>
          ) : (
            <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-64">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Label</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Required</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {editableFields.map((f: any) => (
                    <tr key={f.name}>
                      <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{f.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{f.label || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{f.type || 'text'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300">{f.required ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
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
