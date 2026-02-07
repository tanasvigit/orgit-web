import React, { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { entityListService } from '../../services/entityListService';
import { entityMasterBulkService } from '../../services/entityMasterBulkService';
import { masterDataService, TaskServiceFrequency } from '../../services/masterDataService';
import { organizationService } from '../../services/organizationService';
import { useToast } from '../../context/ToastContext';

export const EntityList: React.FC = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'clients' | 'matrix'>('clients');
  const [matrixType, setMatrixType] = useState<'recurring' | 'one_time'>('recurring');
  const [matrixEdits, setMatrixEdits] = useState<Record<string, Record<string, TaskServiceFrequency>>>({});
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const { data: orgData } = useQuery(['admin-organization'], async () => {
    const res = await organizationService.getMyOrganization();
    return res.data.data;
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery(['client-entities'], async () => {
    const res = await entityListService.list();
    return res.data.data || res.data;
  });

  const { data: freqOptionsData } = useQuery(['task-frequencies'], async () => {
    const res = await masterDataService.getTaskFrequencies();
    return res.data.data || res.data;
  });

  const frequencyOptions: Array<{ value: TaskServiceFrequency; label: string }> = Array.isArray(freqOptionsData)
    ? freqOptionsData
    : [];

  const { data: matrixData, isLoading: matrixLoading } = useQuery(
    ['client-matrix', matrixType],
    async () => {
      const res = await entityListService.matrix(matrixType);
      return res.data.data || res.data;
    },
    { enabled: activeTab === 'matrix' }
  );

  const clients = Array.isArray(clientsData) ? clientsData : [];
  const services = matrixData?.services || [];
  const matrixClients = matrixData?.clients || [];

  React.useEffect(() => {
    if (activeTab !== 'matrix') return;
    if (!Array.isArray(matrixClients)) return;
    // Initialize local edit state from server once per response
    const next: Record<string, Record<string, TaskServiceFrequency>> = {};
    for (const c of matrixClients) {
      next[c.id] = { ...(c.serviceFrequencies || {}) };
    }
    setMatrixEdits(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, matrixType, matrixData]);

  const [modal, setModal] = React.useState<{ mode: 'add' | 'edit'; client?: any } | null>(null);
  const [form, setForm] = React.useState({ name: '', entityType: '', costCentreId: '' });

  React.useEffect(() => {
    if (!modal) return;
    if (modal.mode === 'edit' && modal.client) {
      setForm({
        name: modal.client.name || '',
        entityType: modal.client.entity_type || '',
        costCentreId: modal.client.cost_centre_id || '',
      });
    } else {
      setForm({ name: '', entityType: '', costCentreId: '' });
    }
  }, [modal]);

  const saveMutation = useMutation(
    async () => {
      if (modal?.mode === 'edit' && modal.client?.id) {
        await entityListService.update(modal.client.id, form);
      } else {
        await entityListService.create(form);
      }
    },
    {
      onSuccess: () => {
        qc.invalidateQueries(['client-entities']);
        setModal(null);
      },
    }
  );

  const deleteMutation = useMutation((id: string) => entityListService.remove(id), {
    onSuccess: () => qc.invalidateQueries(['client-entities']),
  });

  const upsertMutation = useMutation(
    (payload: { clientId: string; items: Array<{ taskServiceId: string; frequency: TaskServiceFrequency }> }) =>
      entityListService.upsertClientServices(payload.clientId, payload.items),
    {
      onSuccess: () => qc.invalidateQueries(['client-matrix', matrixType]),
    }
  );

  const handleDownloadEntityListTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await entityMasterBulkService.getTemplate('entity-list');
      toast.success('Entity List template downloaded. Fill NAME OF THE CLIENT, ENTITY TYPE, COST CENTRE and compliance dropdowns (GSTR, etc.), then upload.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to download template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const bulkUploadMutation = useMutation(
    (file: File) => entityMasterBulkService.uploadFile(file),
    {
      onSuccess: (res) => {
        const data = res.data?.data;
        if (data) {
          const { updated, errors } = data;
          if (updated?.client_entities != null && updated.client_entities > 0) {
            toast.success(`Updated ${updated.client_entities} client(s).`);
          }
          if (updated?.client_entity_services != null && updated.client_entity_services > 0) {
            toast.success(`Updated ${updated.client_entity_services} client service(s).`);
          }
          if (errors?.length) {
            errors.slice(0, 5).forEach((e: any) => toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`));
            if (errors.length > 5) toast.error(`… and ${errors.length - 5} more errors`);
          }
        }
        qc.invalidateQueries(['client-entities']);
        qc.invalidateQueries(['client-matrix', 'recurring']);
        qc.invalidateQueries(['client-matrix', 'one_time']);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || err.message || 'Upload failed');
      },
      onSettled: () => {
        setIsBulkUploading(false);
      },
    }
  );

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      e.target.value = '';
      return;
    }
    setIsBulkUploading(true);
    bulkUploadMutation.mutate(file);
  };

  const formatRollout = (rule: string) =>
    rule === 'one_month_before_period_end' ? '1 MONTH BEFORE PERIOD END' : 'End of Period';

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">Entity List</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              NAME OF THE CLIENT, ENTITY TYPE, COST CENTRE, GSTR & compliance fields (dropdowns). Clients and services (Admin only).
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('clients')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                activeTab === 'clients' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              Clients
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                activeTab === 'matrix' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              Service Matrix
            </button>
          </div>
        </div>

        {/* Bulk update from Excel */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Bulk update from Excel</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              onClick={handleDownloadEntityListTemplate}
              disabled={isDownloadingTemplate}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 disabled:opacity-50"
            >
              {isDownloadingTemplate ? 'Downloading…' : 'Download Entity List template'}
            </button>
            <input
              ref={bulkFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleBulkFileChange}
            />
            <button
              type="button"
              onClick={() => bulkFileInputRef.current?.click()}
              disabled={isBulkUploading}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-50"
            >
              {isBulkUploading ? 'Uploading…' : 'Upload file'}
            </button>
            <span className="text-xs text-slate-500">First 3 columns: text. All compliance columns (GSTR 1, GSTR 1A, …): dropdown (Daily, Weekly, … NA, Custom).</span>
          </div>
        </div>

        {activeTab === 'clients' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setModal({ mode: 'add' })}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
              >
                Add Client
              </button>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        NAME OF THE CLIENT
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        ENTITY TYPE
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        COST CENTRE
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {clientsLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      clients.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{c.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{c.entity_type || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                            {c.cost_centre_name ? `${c.cost_centre_name}${c.cost_centre_short_name ? ` (${c.cost_centre_short_name})` : ''}` : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                className="px-3 py-1.5 rounded-lg text-sm text-blue-600 hover:bg-blue-50"
                                onClick={() => setModal({ mode: 'edit', client: c })}
                              >
                                Edit
                              </button>
                              <button
                                className="px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50"
                                onClick={() => deleteMutation.mutate(c.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                    {!clientsLoading && clients.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                          No clients yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setMatrixType('recurring')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    matrixType === 'recurring' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Recurring
                </button>
                <button
                  onClick={() => setMatrixType('one_time')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    matrixType === 'one_time' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  One-Time
                </button>
              </div>
              <div className="text-xs text-slate-500">
                Tip: set per-client frequency; use <b>NA</b> to mark not applicable.
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-[1200px] divide-y divide-slate-200 dark:divide-slate-700">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="sticky left-0 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Client
                      </th>
                      {services.map((s: any) => (
                        <th key={s.id} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          <div className="min-w-[160px]">
                            <div className="font-bold">{s.title}</div>
                            <div className="text-[10px] font-normal normal-case text-slate-400">{formatRollout(s.rollout_rule)}</div>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Save
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {matrixLoading ? (
                      <tr>
                        <td colSpan={services.length + 2} className="px-6 py-10 text-center text-sm text-slate-500">
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      matrixClients.map((c: any) => {
                        const rowState = matrixEdits[c.id] || {};
                        return (
                          <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                            <td className="sticky left-0 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                              {c.name}
                            </td>
                            {services.map((s: any) => (
                              <td key={s.id} className="px-4 py-3">
                                <select
                                  className="w-full min-w-[160px] px-3 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 text-sm"
                                  value={rowState[s.id] || 'NA'}
                                  onChange={(e) =>
                                    setMatrixEdits((prev) => ({
                                      ...prev,
                                      [c.id]: {
                                        ...(prev[c.id] || {}),
                                        [s.id]: e.target.value as TaskServiceFrequency,
                                      },
                                    }))
                                  }
                                >
                                  {(frequencyOptions.length ? frequencyOptions : [{ value: 'NA', label: 'NA' }]).map((o: any) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right">
                              <button
                                className="px-3 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
                                onClick={() => {
                                  const items = services.map((s: any) => ({
                                    taskServiceId: s.id,
                                    frequency: (rowState[s.id] || 'NA') as TaskServiceFrequency,
                                  }));
                                  upsertMutation.mutate({ clientId: c.id, items });
                                }}
                                disabled={upsertMutation.isLoading}
                              >
                                {upsertMutation.isLoading ? 'Saving...' : 'Save'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {!matrixLoading && matrixClients.length === 0 && (
                      <tr>
                        <td colSpan={services.length + 2} className="px-6 py-10 text-center text-sm text-slate-500">
                          No clients found. Add clients first.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {modal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {modal.mode === 'add' ? 'Add Client' : 'Edit Client'}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Entity Type</label>
                  <input
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800"
                    placeholder="Individual / Company / Partnership ..."
                    value={form.entityType}
                    onChange={(e) => setForm({ ...form, entityType: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cost Centre</label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800"
                    value={form.costCentreId}
                    onChange={(e) => setForm({ ...form, costCentreId: e.target.value })}
                  >
                    <option value="">None</option>
                    {(orgData?.costCentres || []).map((cc: any) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name} {cc.shortName ? `(${cc.shortName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700"
                  onClick={() => setModal(null)}
                  disabled={saveMutation.isLoading}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-lg bg-primary text-white font-semibold"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isLoading}
                >
                  {saveMutation.isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

