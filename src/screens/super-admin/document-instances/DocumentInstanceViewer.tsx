import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { documentInstanceService } from '../../../services/documentInstanceService';
import { documentTemplateService } from '../../../services/documentTemplateService';
import { Button } from '../../../components/shared';

export const DocumentInstanceViewer: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const queryClient = useQueryClient();

  const { data: instance, isLoading } = useQuery(
    ['documentInstance', id],
    () => documentInstanceService.getById(id!),
    { enabled: !!id }
  );

  const { data: template } = useQuery(
    ['template', instance?.templateId],
    () => documentTemplateService.getById(instance!.templateId),
    { enabled: !!instance?.templateId }
  );

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: instance?.filledData || {},
  });

  const updateMutation = useMutation(
    (data: any) => documentInstanceService.update(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['documentInstance', id]);
        queryClient.invalidateQueries('documentInstances');
        navigate(`/super-admin/document-instances/${id}`);
      },
    }
  );

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
        navigate('/super-admin/document-instances');
      },
    }
  );

  const handleDownload = async () => {
    try {
      const blob = await documentInstanceService.download(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${instance?.title || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download document');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate();
    }
  };

  const onSubmit = (formData: any) => {
    updateMutation.mutate({
      filledData: formData,
      title: instance?.title,
    });
  };

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="p-6 md:p-8">
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading document...</p>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  if (!instance) {
    return (
      <SuperAdminLayout>
        <div className="p-6 md:p-8">
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Document not found</p>
            <Button onClick={() => navigate('/super-admin/document-instances')} className="mt-4">
              Back to List
            </Button>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  const pdfUrl = instance.pdfUrl.startsWith('/')
    ? `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}${instance.pdfUrl}`
    : instance.pdfUrl;

  return (
    <SuperAdminLayout
      breadcrumbs={[
        { label: 'Document Management' },
        { label: 'Document Instances', path: '/super-admin/document-instances' },
        { label: instance.title }
      ]}
    >
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{instance.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-600 dark:text-gray-400">{template?.name}</p>
              <span className="text-gray-400">•</span>
              <span
                className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  instance.status === 'final'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : instance.status === 'draft'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {instance.status.charAt(0).toUpperCase() + instance.status.slice(1)}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {instance.status === 'draft' && !isEditMode && (
              <Button
                variant="outline"
                onClick={() => navigate(`/super-admin/document-instances/${id}?edit=true`)}
              >
                <span className="material-symbols-outlined mr-2">edit</span>
                Edit
              </Button>
            )}
            {instance.status === 'draft' && (
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
            )}
            <Button variant="outline" onClick={handleDownload}>
              <span className="material-symbols-outlined mr-2">download</span>
              Download PDF
            </Button>
            <Button variant="outline" onClick={handleDelete}>
              <span className="material-symbols-outlined mr-2">delete</span>
              Delete
            </Button>
            <Button variant="outline" onClick={() => navigate('/super-admin/document-instances')}>
              Back
            </Button>
          </div>
        </div>

        {isEditMode && instance.status === 'draft' ? (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Document</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {template?.templateSchema?.editableFields?.map((field: any) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      {...register(field.name, { required: field.required })}
                      rows={4}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-super-admin-primary focus:ring-super-admin-primary py-2.5 px-3"
                      defaultValue={instance.filledData[field.name]}
                    />
                  ) : (
                    <input
                      {...register(field.name, { required: field.required })}
                      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:border-super-admin-primary focus:ring-super-admin-primary py-2.5 px-3"
                      defaultValue={instance.filledData[field.name]}
                    />
                  )}
                  {errors[field.name] && (
                    <p className="text-red-500 text-xs mt-1">{errors[field.name]?.message as string}</p>
                  )}
                </div>
              ))}
              <div className="flex gap-4 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/super-admin/document-instances/${id}`)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isLoading}>
                  {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">PDF Preview</h2>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-[800px]"
                title="PDF Preview"
              />
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
};

