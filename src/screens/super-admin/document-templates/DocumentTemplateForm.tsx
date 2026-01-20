import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { DocumentBuilderContent } from '../../../components/document-builder/DocumentBuilderLayout';
import { DocumentBuilderProvider, useDocumentBuilder } from '../../../components/document-builder/DocumentBuilderProvider';
import { serializeDocumentState } from '../../../components/document-builder/serializer';

// Wrapper to bridge the Router/Service with the Builder Context
const BuilderIntegration: React.FC<{ templateId?: string }> = ({ templateId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
        alert('Failed to save template: ' + (err.response?.data?.error || err.message));
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
        alert('Failed to delete template: ' + (err.response?.data?.error || err.message));
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
      alert('Error preparing template data: ' + (e as Error).message);
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
                if (window.confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
                  deleteMutation.mutate(templateId);
                }
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

// Refactored Top Level Component
export const DocumentTemplateForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <DocumentBuilderProvider>
      <BuilderIntegration templateId={id} />
    </DocumentBuilderProvider>
  );
};
