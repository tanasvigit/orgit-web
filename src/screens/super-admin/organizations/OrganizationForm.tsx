import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { organizationService } from '../../../services/organizationService';

export const OrganizationForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: org } = useQuery(
    ['organization', id],
    () => organizationService.getById(id!).then((res) => res.data.data),
    { enabled: isEdit }
  );

  const [formData, setFormData] = useState({
    name: org?.name || '',
    email: org?.email || '',
    mobile: org?.mobile || '',
    address: org?.address || '',
    gst: org?.gst || '',
    pan: org?.pan || '',
    cin: org?.cin || '',
    accountingYearStart: org?.accountingYearStart || '',
  });

  const createMutation = useMutation(
    (data: any) => organizationService.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('organizations');
        navigate('/super-admin/organizations');
      },
    }
  );

  const updateMutation = useMutation(
    (data: any) => organizationService.update(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('organizations');
        navigate('/super-admin/organizations');
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <SuperAdminLayout
      breadcrumbs={[
        { label: 'Organisations', path: '/super-admin/organizations' },
        { label: isEdit ? 'Edit' : 'Create' },
      ]}
    >
      <div className="max-w-4xl mx-auto p-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          {isEdit ? 'Edit Organization' : 'Create Organization'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                value={formData.gst}
                onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PAN</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CIN</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                value={formData.cin}
                onChange={(e) => setFormData({ ...formData, cin: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
              <textarea
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                rows={3}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/super-admin/organizations')}
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-super-admin-surface-dark hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium"
            >
              <span className="material-symbols-outlined text-xl">save</span>
              {isEdit ? 'Update' : 'Create'} Organization
            </button>
          </div>
        </form>
      </div>
    </SuperAdminLayout>
  );
};

