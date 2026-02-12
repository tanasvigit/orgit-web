import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { BottomNav } from '../../components/shared';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { employeeService, Employee } from '../../services/employeeService';
import { documentManagementSettingsService, DocumentManagementSettings } from '../../services/documentManagementSettingsService';
import { Button } from '../../components/shared';
import { useToast } from '../../context/ToastContext';

export const AdminSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employeesData } = useQuery(
    'employees',
    () => employeeService.getEmployees().then((res) => res.data.data || res.data),
    { enabled: user?.role === 'admin' }
  );
  const employees: Employee[] = Array.isArray(employeesData) ? employeesData : [];

  const { data: settingsData, isLoading: isSettingsLoading } = useQuery(
    'documentManagementSettings',
    () => documentManagementSettingsService.get(),
    { enabled: user?.role === 'admin' }
  );

  const [enabled, setEnabled] = useState(false);
  const [checkedByUserId, setCheckedByUserId] = useState<string>('');
  const [approvedByUserId, setApprovedByUserId] = useState<string>('');

  useEffect(() => {
    if (settingsData) {
      setEnabled(!!settingsData.enabled);
      setCheckedByUserId(settingsData.checkedByUserId || '');
      setApprovedByUserId(settingsData.approvedByUserId || '');
    }
  }, [settingsData]);

  const userOptions = useMemo(() => {
    const options: Array<{ id: string; name: string }> = [];
    if (user?.id) {
      options.push({ id: user.id, name: `${user.name || 'Admin'} (You)` });
    }
    for (const emp of employees) {
      if (emp?.id && emp?.name) options.push({ id: emp.id, name: emp.name });
    }
    // de-dup by id
    const seen = new Set<string>();
    return options.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  }, [employees, user?.id, user?.name]);

  const updateMutation = useMutation(
    (payload: DocumentManagementSettings) => documentManagementSettingsService.update(payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documentManagementSettings');
        toast.success('Document management settings updated');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || err.message || 'Failed to update settings');
      },
    }
  );

  const content = (
    <div className="p-4 md:p-8 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Organization Settings</h1>
        <p className="text-slate-600 mt-1">Configure your organization's global settings</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Notification Settings</h2>
        <p className="text-slate-600 mb-4">Manage how your organization receives notifications.</p>
        {/* Settings options would go here */}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Document Management Settings</h2>
            <p className="text-slate-600">
              Configure the approval flow for documents: Prepared By → Checked By → Approved By.
            </p>
          </div>
          <Button
            variant="primary"
            disabled={updateMutation.isLoading || isSettingsLoading}
            onClick={() =>
              updateMutation.mutate({
                enabled,
                checkedByUserId: checkedByUserId || null,
                approvedByUserId: approvedByUserId || null,
              })
            }
          >
            {updateMutation.isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>

        <div className="mt-6 space-y-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold text-slate-900">Enable approval flow</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Checked By</label>
              <select
                value={checkedByUserId}
                onChange={(e) => setCheckedByUserId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={!enabled}
              >
                <option value="">Select user</option>
                {userOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Approved By</label>
              <select
                value={approvedByUserId}
                onChange={(e) => setApprovedByUserId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={!enabled}
              >
                <option value="">Select user</option>
                {userOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
            <div className="font-bold text-slate-900 mb-2">Flow</div>
            <div className="leading-7">
              Prepared By
              <br />
              <span className="pl-2">|</span>
              <br />
              Checked By
              <br />
              <span className="pl-2">|</span>
              <br />
              Approved By
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Auto-Escalation</h2>
        <p className="text-slate-600 mb-4">Configure rules for automatic task escalation.</p>
        {/* Settings options would go here */}
      </div>
    </div>
  );

  if (user?.role !== 'admin') {
    return (
      <div className="pb-24 min-h-screen bg-background-light dark:bg-background-dark text-text-main dark:text-white antialiased min-h-screen flex flex-col font-display">
        <div className="p-4">
          <p className="text-red-500 font-bold">Access denied. Admin permissions required.</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <AdminLayout>
      {content}
    </AdminLayout>
  );
};
