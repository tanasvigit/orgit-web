import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../../components/employee/EmployeeLayout';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { documentInstanceService } from '../../../services/documentInstanceService';
import { Button } from '../../../components/shared';
import { DocumentBuilderProvider, useDocumentBuilder } from '../../../components/document-builder/DocumentBuilderProvider';
import { DocumentBuilderContent } from '../../../components/document-builder/DocumentBuilderLayout';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { organizationService } from '../../../services/organizationService';
import { getBackendBaseUrlWithSlash } from '../../../config/env';
import { SchemaDrivenDocumentEditor } from '../../../components/document-templates/SchemaDrivenDocumentEditor';
import { InlineDocumentEditor } from '../../../components/document-templates/InlineDocumentEditor';

const DocumentFillerIntegration: React.FC<{ templateId: string | null; onBack: () => void; isAdmin: boolean }> = ({ templateId, onBack, isAdmin }) => {

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, dispatch } = useDocumentBuilder();
  const { user } = useAuth();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [templateLoaded, setTemplateLoaded] = useState(false);

  // Fetch organization data for auto-fill
  const { data: orgData } = useQuery(
    ['admin-organization'],
    async () => {
      if (!user?.organizationId) return null;
      // Use admin endpoint if user is admin, otherwise use super-admin endpoint
      const response = user?.role === 'admin' 
        ? await organizationService.getMyOrganization()
        : await organizationService.getById(user.organizationId);
      return response.data.data;
    },
    { enabled: !!user?.organizationId }
  );

  const { isLoading } = useQuery(
    ['documentTemplate', templateId],
    () => documentTemplateService.getById(templateId!).then(res => res.data.data),
    {
      enabled: !!templateId,
      onSuccess: (data) => {
        console.log('DEBUG: Received template data from API:', JSON.stringify(data, null, 2));
        let config = data.builderConfig;

        // Robust parsing for builderConfig
        if (typeof config === 'string') {
          try {
            console.log('DEBUG: builderConfig is a string, parsing...');
            config = JSON.parse(config);
          } catch (e) {
            console.error('DEBUG: Failed to parse builderConfig string', e);
            config = null;
          }
        }

        // Fallback to templateSchema._builderConfig if needed
        if (!config && data.templateSchema) {
          try {
            console.log('DEBUG: builderConfig missing, checking templateSchema...');
            const schema = typeof data.templateSchema === 'string'
              ? JSON.parse(data.templateSchema)
              : data.templateSchema;

            console.log('DEBUG: Parsed templateSchema:', JSON.stringify(schema, null, 2));
            config = schema._builderConfig;

            // Re-parse if it's still a string (nested stringification)
            if (typeof config === 'string') {
              console.log('DEBUG: _builderConfig is a string, parsing...');
              config = JSON.parse(config);
            }
          } catch (e) {
            console.error('DEBUG: Failed to parse templateSchema', e);
          }
        }

        console.log('DEBUG: Final resolved config:', JSON.stringify(config, null, 2));

        if (config && typeof config === 'object') {
          // Load template and FORCE mode to 'fill'
          dispatch({
            type: 'LOAD_TEMPLATE',
            payload: { ...config, mode: 'fill' }
          });
          setTemplateLoaded(true);
        } else {
          console.error('DEBUG: No valid config found for template');
          toast.error('This template is not supported by the new document builder.');
          onBack();
        }
        setTitle(`${data.name} - ${new Date().toLocaleDateString()}`);
      },
      onError: (err: any) => {
        console.error('DEBUG: Failed to fetch template:', err);
        toast.error('Failed to load template structure: ' + (err.response?.data?.error || err.message));
        onBack();
      }
    }
  );

  // Ensure we are in fill mode
  useEffect(() => {
    if (state.mode !== 'fill') {
      dispatch({ type: 'SET_MODE', payload: 'fill' });
    }
  }, [state.mode, dispatch]);

  // Auto-fill header from Entity Master Data when template loads and org data is available
  useEffect(() => {
    if (templateLoaded && orgData && state.header && templateId) {
      const formatOrgAddress = () => {
        // Prefer structured address if available
        const parts = [
          orgData.addressLine1,
          orgData.addressLine2,
          orgData.city?.name,
          orgData.state?.name,
          orgData.country?.name,
          orgData.pinCode,
        ].filter(Boolean);
        if (parts.length) return parts.join(', ');
        return orgData.address || '';
      };

      // Only auto-fill if fields are empty (don't overwrite template defaults)
      const updates: any = {};
      
      if (!state.header.orgName && orgData.name) {
        updates.orgName = orgData.name;
      }
      if (!state.header.orgAddress) {
        const addr = formatOrgAddress();
        if (addr) updates.orgAddress = addr;
      }
      if (!state.header.orgGstin && orgData.gst) {
        updates.orgGstin = orgData.gst;
      }
      if (!state.header.orgEmail && orgData.email) {
        updates.orgEmail = orgData.email;
      }
      if (!state.header.orgMobile && orgData.mobile) {
        updates.orgMobile = orgData.mobile;
      }
      
      // Handle logo URL - construct full URL if relative
      if (orgData.logoUrl && state.header.showLogo && !state.header.orgLogoUrl) {
        let logoUrl = orgData.logoUrl;
        if (logoUrl.startsWith('/')) {
          logoUrl = `${getBackendBaseUrlWithSlash()}${logoUrl.replace(/^\//, '')}`;
        }
        updates.orgLogoUrl = logoUrl;
      }
      
      // Only dispatch if there are updates to make
      if (Object.keys(updates).length > 0) {
        dispatch({ type: 'UPDATE_HEADER', payload: updates });
      }
    }
  }, [templateLoaded, orgData, templateId, state.header, dispatch]);

  const mutation = useMutation(
    (data: any) => documentInstanceService.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documentInstances');
        navigate('/admin/documents');
      },
      onError: (err: any) => {
        console.error('DEBUG: Save failed with error:', err);
        if (err.response) {
          console.error('DEBUG: Error response data:', JSON.stringify(err.response.data, null, 2));
        }
        toast.error('Failed to save document: ' + (err.response?.data?.error || err.response?.data?.message || err.message));
      }
    }
  );

  const handleSave = () => {
    // We send the current builder state as 'filledData' 
    // This includes all sections, rows, and documentData
    mutation.mutate({
      templateId,
      title,
      filledData: state
    });
  };

  const Layout = isAdmin ? AdminLayout : EmployeeLayout;

  if (isLoading) {
    return (
      <Layout hideHeader={isAdmin}>
        <div className="p-8">
          <p>Loading template...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideHeader={isAdmin}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-gray-500 hover:text-gray-700">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <label className="text-xs text-gray-500 block">Document Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-bold text-gray-900 border-none p-0 focus:ring-0 w-64"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={mutation.isLoading}>
              {mutation.isLoading ? 'Creating...' : 'Create Document'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <DocumentBuilderContent />
        </div>
      </div>
    </Layout>
  );
}

export const CreateDocument: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { templateId } = useParams<{ templateId?: string }>();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templateId || null);
  const isAdmin = user?.role === 'admin';

  const { data: templatesData, isLoading } = useQuery(
    'activeTemplates',
    async () => {
      const res = await documentTemplateService.getActiveTemplates();
      return res.data.data;
    }
  );

  const TemplateFillRouter: React.FC<{ templateId: string; onBack: () => void; isAdmin: boolean }> = ({ templateId, onBack, isAdmin }) => {
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: orgData } = useQuery(
      ['schema-org'],
      async () => {
        if (!user?.organizationId) return null;
        const response =
          user?.role === 'admin'
            ? await organizationService.getMyOrganization()
            : await organizationService.getById(user.organizationId);
        return response.data.data;
      },
      { enabled: !!user?.organizationId }
    );

    const { data: template, isLoading, error } = useQuery(
      ['template-fill-router', templateId],
      async () => {
        const res = await documentTemplateService.getById(templateId);
        return res.data.data;
      },
      { enabled: !!templateId }
    );

    const createMutation = useMutation(
      (payload: any) => documentInstanceService.create(payload),
      {
        onSuccess: () => {
          queryClient.invalidateQueries('documentInstances');
          navigate(isAdmin ? '/admin/documents' : '/documents');
        },
        onError: (err: any) => {
          toast.error('Failed to create document: ' + (err.response?.data?.error || err.message));
        },
      }
    );

    if (isLoading) {
      const Layout = isAdmin ? AdminLayout : EmployeeLayout;
      return (
        <Layout hideHeader={isAdmin}>
          <div className="p-8">
            <p>Loading template...</p>
          </div>
        </Layout>
      );
    }

    if (error || !template) {
      const Layout = isAdmin ? AdminLayout : EmployeeLayout;
      return (
        <Layout hideHeader={isAdmin}>
          <div className="p-8">
            <p className="text-red-600">Failed to load template.</p>
            <div className="mt-4">
              <Button onClick={onBack} variant="outline">
                Back
              </Button>
            </div>
          </div>
        </Layout>
      );
    }

    // If builder config exists, use existing Document Builder filler.
    const configFromApi = (template as any).builderConfig || (template as any).templateSchema?._builderConfig;
    if (configFromApi) {
      return (
        <DocumentBuilderProvider>
          <DocumentFillerIntegration templateId={templateId} isAdmin={isAdmin} onBack={onBack} />
        </DocumentBuilderProvider>
      );
    }

    // Legacy (schema-driven) filler: locked system templates.
    let schema = (template as any).templateSchema;
    if (typeof schema === 'string') {
      try {
        schema = JSON.parse(schema);
      } catch {
        schema = {};
      }
    }
    const editableFields = schema?.editableFields;
    const locked = !!schema?.lockedStructure;

    if (!editableFields || !Array.isArray(editableFields)) {
      const Layout = isAdmin ? AdminLayout : EmployeeLayout;
      return (
        <Layout hideHeader={isAdmin}>
          <div className="p-8">
            <p>This template is not fillable in the web app.</p>
            <div className="mt-4">
              <Button onClick={onBack} variant="outline">
                Back
              </Button>
            </div>
          </div>
        </Layout>
      );
    }

    const Layout = isAdmin ? AdminLayout : EmployeeLayout;

    const initialValues: Record<string, any> = {
      invoice_copy_label: 'ORIGINAL FOR RECIPIENT',
      ...((template as any).autoFillFields || {}),
      ...(schema?.defaultValues || {}),
    };

    const systemTemplateKey = (schema?.systemTemplateKey || (template as any).type || '') as string;
    const isPaymentVoucher = /payment-voucher|payment_voucher/i.test(systemTemplateKey);

    // Best-effort org autofill from Entity Master Data
    if (orgData) {
      initialValues.company_name = initialValues.company_name || orgData.name || '';
      initialValues.company_legal_name = initialValues.company_legal_name || orgData.name || '';
      initialValues.company_gstin = initialValues.company_gstin || orgData.gst || '';
      initialValues.company_email = initialValues.company_email || orgData.email || '';
      initialValues.company_phone = initialValues.company_phone || orgData.phoneNumber || orgData.mobile || '';
      initialValues.company_address = initialValues.company_address || orgData.address || '';
      if (isPaymentVoucher) {
        initialValues.address_line1 = initialValues.address_line1 || orgData.addressLine1 || '';
        initialValues.address_line2 = initialValues.address_line2 || orgData.addressLine2 || '';
        initialValues.city = initialValues.city || (typeof orgData.city === 'string' ? orgData.city : orgData.city?.name) || '';
        initialValues.pincode = initialValues.pincode || orgData.pinCode || '';
        initialValues.company_logo_url = initialValues.company_logo_url || orgData.logoUrl || orgData.logo_url || '';
      }
    }

    const computedTitle = `${template.name} - ${new Date().toLocaleDateString()}`;
    const useInlineEditor = /tax-invoice|payment-voucher|tax_invoice|payment_voucher/i.test(systemTemplateKey);

    if (useInlineEditor) {
      return (
        <Layout hideHeader={isAdmin}>
          <div className="flex flex-col h-full">
            <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <button type="button" onClick={onBack} className="text-gray-500 hover:text-gray-700">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">{template.name}</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Edit fields directly on the document</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <InlineDocumentEditor
                schema={schema}
                initialValues={initialValues}
                submitLabel={createMutation.isLoading ? 'Creating...' : 'Create Document'}
                disabled={createMutation.isLoading}
                onCancel={onBack}
                onSubmit={async (formData) => {
                  createMutation.mutate({
                    templateId,
                    title: computedTitle,
                    filledData: formData,
                  });
                }}
              />
            </div>
          </div>
        </Layout>
      );
    }

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

      if (Array.isArray(out.item_rows)) {
        if (!out.total_items) out.total_items = String(out.item_rows.length);
        if (!out.total_qty) {
          const qty = out.item_rows.reduce((sum: number, r: any) => sum + Number(r?.qty || 0), 0);
          out.total_qty = qty ? String(qty) : '';
        }
      }

      return out;
    };

    return (
      <Layout hideHeader={isAdmin}>
        <div className="p-6 md:p-8 max-w-[1200px] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {template.name}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {locked ? 'Structure is locked. Edit data only.' : 'Edit document data.'}
              </p>
            </div>
            <Button variant="outline" onClick={onBack}>
              <span className="material-symbols-outlined mr-2">arrow_back</span>
              Back
            </Button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
            <SchemaDrivenDocumentEditor
              schema={schema}
              initialValues={initialValues}
              submitLabel={createMutation.isLoading ? 'Creating...' : 'Create Document'}
              disabled={createMutation.isLoading}
              onCancel={onBack}
              onSubmit={async (formData) => {
                const filledData = normalizeForSubmit(formData);
                createMutation.mutate({
                  templateId,
                  title: computedTitle,
                  filledData,
                });
              }}
            />
          </div>
        </div>
      </Layout>
    );
  };

  if (selectedTemplateId) {
    return (
      <TemplateFillRouter
        templateId={selectedTemplateId}
        isAdmin={isAdmin}
        onBack={() => {
          setSelectedTemplateId(null);
          navigate(isAdmin ? '/admin/documents/create' : '/documents/create');
        }}
      />
    );
  }

  const Layout = isAdmin ? AdminLayout : EmployeeLayout;

  return (
    <Layout>
      <div className="p-6 md:p-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              Create New Document
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Select a template to start creating your document
            </p>
          </div>
          <button
            onClick={() => navigate(isAdmin ? '/admin/documents' : '/documents')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </button>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading templates...</p>
          </div>
        ) : templatesData?.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">description</span>
            <p className="text-gray-600 dark:text-gray-400 mb-2 text-lg font-medium">No active templates available</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Please contact your Super Admin to create templates</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {templatesData?.map((t: any) => (
              <div
                key={t.id}
                onClick={() => setSelectedTemplateId(t.id)}
                className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg hover:border-primary dark:hover:border-primary/50 cursor-pointer transition-all group"
              >
                <div className="h-14 w-14 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center text-primary mb-4 group-hover:scale-110 group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-all">
                  <span className="material-symbols-outlined text-3xl">description</span>
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-lg">{t.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.type || 'Document'}</p>
                <div className="flex items-center text-sm text-primary dark:text-primary-light font-semibold group-hover:gap-2 transition-all">
                  <span>Use Template</span>
                  <span className="material-symbols-outlined text-base ml-1 group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
