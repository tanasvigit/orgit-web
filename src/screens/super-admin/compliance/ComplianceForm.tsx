import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { complianceService } from '../../../services/complianceService';
import { useAuth } from '../../../context/AuthContext';
import { ComplianceMaster } from '../../../../shared/src/types';

export const ComplianceForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isEdit = !!id;
  const isSuperAdmin = user?.role === 'super_admin';

  const { data: item, isLoading } = useQuery(
    ['compliance', id],
    () => complianceService.getById(id!).then((res) => res.data.data),
    { enabled: isEdit }
  );

  const [formData, setFormData] = useState<Partial<ComplianceMaster>>({
    title: '',
    category: '',
    actName: '',
    description: '',
    complianceType: 'ONE_TIME',
    frequency: undefined,
    effectiveDate: '',
    status: 'ACTIVE',
    version: '1.0',
  });

  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (isEdit && item) {
      setFormData({
        title: item.title || '',
        category: item.category || '',
        actName: item.actName || '',
        description: item.description || '',
        complianceType: item.complianceType || 'ONE_TIME',
        frequency: item.frequency,
        effectiveDate: item.effectiveDate || '',
        status: item.status || 'ACTIVE',
        version: item.version || '1.0',
      });

      // Check if Admin viewing Global compliance (read-only)
      if (!isSuperAdmin && item.scope === 'GLOBAL') {
        setIsReadOnly(true);
      }
    }
  }, [isEdit, item, isSuperAdmin]);

  const createMutation = useMutation(
    (data: Partial<ComplianceMaster>) => complianceService.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compliance');
        navigate('/super-admin/compliance');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const updateMutation = useMutation(
    (data: Partial<ComplianceMaster>) => complianceService.update(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('compliance');
        navigate('/super-admin/compliance');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('You do not have permission to edit this Global compliance');
      return;
    }

    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isEdit && isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">Loading...</div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout
      breadcrumbs={[
        { label: 'Compliance Management', path: '/super-admin/compliance' },
        { label: isEdit ? 'Edit Compliance' : 'Add Compliance' },
      ]}
    >
      <div className="max-w-4xl mx-auto p-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          {isEdit ? 'Edit Compliance Item' : 'Add Compliance Item'}
        </h2>

        {/* Scope Info Banner */}
        {!isEdit && (
          <div className={`mb-6 p-4 rounded-lg ${
            isSuperAdmin
              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          }`}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isSuperAdmin
                ? '🌐 This compliance will be available to all organisations (Global scope)'
                : '🏢 This compliance is limited to your organisation (Organisation scope)'}
            </p>
          </div>
        )}

        {isReadOnly && (
          <div className="mb-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              ⚠️ You are viewing a Global compliance in read-only mode. Only Super Admin can edit Global compliances.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Act Name
                  </label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.actName}
                    onChange={(e) => setFormData({ ...formData, actName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  disabled={isReadOnly}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  rows={5}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Compliance Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.complianceType}
                    onChange={(e) => setFormData({ ...formData, complianceType: e.target.value as 'ONE_TIME' | 'RECURRING' })}
                  >
                    <option value="ONE_TIME">One Time</option>
                    <option value="RECURRING">Recurring</option>
                  </select>
                </div>

                {formData.complianceType === 'RECURRING' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Frequency
                    </label>
                    <select
                      disabled={isReadOnly}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      value={formData.frequency || ''}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any || undefined })}
                    >
                      <option value="">Select Frequency</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="HALF_YEARLY">Half Yearly</option>
                      <option value="YEARLY">Yearly</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  />
                </div>
              </div>

              {isEdit && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    disabled={isReadOnly}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('/super-admin/compliance')}
              className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-super-admin-surface-dark hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={createMutation.isLoading || updateMutation.isLoading}
                className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">save</span>
                {isEdit ? 'Update' : 'Create'} Compliance
              </button>
            )}
          </div>
        </form>
      </div>
    </SuperAdminLayout>
  );
};
