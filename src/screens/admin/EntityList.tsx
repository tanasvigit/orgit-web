import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { entityListService } from '../../services/entityListService';
import { BulkMasterUploadPanel } from '../../components/admin/BulkMasterUploadPanel';
import { masterDataService, TaskServiceFrequency, OrgConstitutionOption } from '../../services/masterDataService';
import { getOrganizationStructureTree } from '../../services/settingsService';
import { useToast } from '../../context/ToastContext';
import { EmployeeOrgLevelNodeSelectors } from '../../components/admin/EmployeeOrgLevelNodeSelectors';
import {
  buildEmployeeOrgFieldValuesPayload,
  deriveOrgNodeByLevelFromPrimary,
  extractOrgNodeByLevel,
  formatOrgNodeByLevelSummary,
  getAssignmentSectionsFromTree,
  getDeepestSelectedNodeId,
  getEntityTypeFromNode,
  lookupOrgNodeId,
  normalizeOrgNodeByLevel,
  type OrgNodeByLevel,
} from '../../utils/employeeOrgNodeLevels';

export const EntityList: React.FC = () => {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'clients' | 'matrix'>('clients');
  const [matrixEdits, setMatrixEdits] = useState<Record<string, Record<string, TaskServiceFrequency>>>({});

  const { data: orgStructureTreeData } = useQuery(['entity-list-org-structure-tree'], async () => {
    const res = await getOrganizationStructureTree({ includeArchived: false, includeInactive: false });
    return res.data || res;
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery(['client-entities'], async () => {
    const res = await entityListService.list();
    return res.data.data || res.data;
  });

  const { data: orgConstitutionsData } = useQuery(['master-org-constitutions'], async () => {
    const res = await masterDataService.getOrgConstitutions();
    return (res.data?.data || res.data || []) as OrgConstitutionOption[];
  });
  const orgConstitutions = Array.isArray(orgConstitutionsData) ? orgConstitutionsData : [];

  const toggleStatusMutation = useMutation(
    async (payload: { id: string; status: 'active' | 'inactive' }) => {
      await entityListService.update(payload.id, { status: payload.status });
    },
    {
      onSuccess: () => {
        qc.invalidateQueries(['client-entities']);
      },
    }
  );

  const { data: freqOptionsData } = useQuery(['task-frequencies'], async () => {
    const res = await masterDataService.getTaskFrequencies();
    return res.data.data || res.data;
  });

  const frequencyOptions: Array<{ value: TaskServiceFrequency; label: string }> = Array.isArray(freqOptionsData)
    ? freqOptionsData
    : [];

  const { data: matrixData, isLoading: matrixLoading } = useQuery(
    'client-matrix-all',
    async () => {
      const res = await entityListService.matrix();
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
  }, [activeTab, matrixData]);

  const [modal, setModal] = React.useState<{ mode: 'add' | 'edit'; client?: any } | null>(null);
  const [form, setForm] = React.useState({
    name: '',
    orgNodeByLevel: {} as OrgNodeByLevel,
    pan: '',
    reportingPartnerMobile: '',
    status: 'active' as 'active' | 'inactive',
  });

  const getClientOrgLabel = (client: any): string => {
    const rawFv = (client.org_field_values || {}) as Record<string, unknown>;
    let byLevel = extractOrgNodeByLevel(rawFv);
    if (Object.keys(byLevel).length === 0 && client.org_structure_node_id) {
      byLevel = deriveOrgNodeByLevelFromPrimary(orgStructureTreeData, client.org_structure_node_id);
    }
    if (orgStructureTreeData?.levels) {
      byLevel = normalizeOrgNodeByLevel(byLevel, orgStructureTreeData.levels);
    }
    const summary = formatOrgNodeByLevelSummary(orgStructureTreeData, byLevel);
    if (summary) return summary;
    if (Array.isArray(client.org_structure_path) && client.org_structure_path.length > 0) {
      return client.org_structure_path.map((node: { name: string }) => node.name).join(' / ');
    }
    return client.org_structure_node_name || '-';
  };

  React.useEffect(() => {
    if (!modal) return;
    if (modal.mode === 'edit' && modal.client) {
      const nodeId = modal.client.org_structure_node_id || '';
      const rawFv = (modal.client.org_field_values || {}) as Record<string, unknown>;
      let orgNodeByLevel = extractOrgNodeByLevel(rawFv);
      if (Object.keys(orgNodeByLevel).length === 0 && nodeId && orgStructureTreeData) {
        orgNodeByLevel = deriveOrgNodeByLevelFromPrimary(orgStructureTreeData, nodeId);
      }
      setForm({
        name: modal.client.name || '',
        orgNodeByLevel,
        pan: modal.client.pan || '',
        reportingPartnerMobile: modal.client.reporting_partner_mobile || '',
        status: (modal.client.status as 'active' | 'inactive') || 'active',
      });
    } else {
      setForm({
        name: '',
        orgNodeByLevel: {},
        pan: '',
        reportingPartnerMobile: '',
        status: 'active',
      });
    }
  }, [modal, orgStructureTreeData]);

  const buildSavePayload = () => {
    const orgNodeByLevel = orgStructureTreeData?.levels
      ? normalizeOrgNodeByLevel(form.orgNodeByLevel, orgStructureTreeData.levels)
      : form.orgNodeByLevel;

    const sectionsOnChart = getAssignmentSectionsFromTree(orgStructureTreeData, orgNodeByLevel);
    if (sectionsOnChart.length > 0) {
      for (const level of sectionsOnChart) {
        if (!lookupOrgNodeId(orgNodeByLevel, level)) {
          toast.error(`Please select ${level.levelLabel}`);
          return null;
        }
      }
    }
    const orgStructureNodeId = getDeepestSelectedNodeId(orgNodeByLevel, sectionsOnChart);
    return {
      name: form.name,
      entityType: getEntityTypeFromNode(orgStructureTreeData, orgStructureNodeId) || undefined,
      orgStructureNodeId: orgStructureNodeId || undefined,
      pan: form.pan,
      reportingPartnerMobile: form.reportingPartnerMobile,
      status: form.status,
      orgFieldValues: buildEmployeeOrgFieldValuesPayload(orgNodeByLevel, {}),
    };
  };

  const saveMutation = useMutation(
    async () => {
      const payload = buildSavePayload();
      if (!payload) throw new Error('Validation failed');
      if (modal?.mode === 'edit' && modal.client?.id) {
        await entityListService.update(modal.client.id, payload);
      } else {
        await entityListService.create(payload);
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
      onSuccess: () => qc.invalidateQueries('client-matrix-all'),
    }
  );

  const formatRollout = (rule: string) =>
    rule === 'one_month_before_period_end' ? '1 MONTH BEFORE PERIOD END' : 'End of Period';

  return (
    <AdminLayout>
      <div className="p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1.5">Client List</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              
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

        <BulkMasterUploadPanel variant="compact" className="mb-4" />

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
                        ORGANISATION
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        PAN
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        REPORTING PARTNER
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        STATUS
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {clientsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      clients.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                          <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">{c.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">{c.entity_type || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                            <div className="max-w-xs truncate" title={getClientOrgLabel(c)}>
                              {getClientOrgLabel(c)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200 font-mono uppercase">
                            {c.pan || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                            {c.reporting_partner_name
                              ? c.reporting_partner_name
                              : c.reporting_partner_mobile || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <select
                              className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${
                                (c.status === 'inactive'
                                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700') as string
                              }`}
                              value={c.status === 'inactive' ? 'inactive' : 'active'}
                              onChange={(e) => {
                                const next = e.target.value as 'active' | 'inactive';
                                toggleStatusMutation.mutate({ id: c.id, status: next });
                              }}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
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
                        <td colSpan={9} className="px-6 py-10 text-center text-sm text-slate-500">
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
            {/* Header + tip in the new style */}
            <div className="flex items-center justify-between flex-col md:flex-row gap-3">
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Service Matrix</h2>
                <span className="px-2 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 rounded uppercase">
                  Live
                </span>
              </div>
              <div className="flex items-center text-xs text-slate-400 italic">
                <span className="material-icons-outlined text-[14px] mr-1">info</span>
                <span>
                  Tip: set per-client frequency; use{' '}
                  <strong className="mx-1 text-slate-600 dark:text-slate-300">NA</strong> to mark not
                  applicable.
                </span>
              </div>
            </div>

            {/* Table matching the new visual design */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[960px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider w-1/4 sticky left-0 bg-slate-50 dark:bg-slate-800/50">
                        Client
                      </th>
                      {services.map((s: any) => (
                        <th
                          key={s.id}
                          className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider align-bottom"
                        >
                          <div className="flex flex-col">
                            <span>{s.title}</span>
                            <span className="text-[10px] font-normal text-slate-400 mt-1">
                              {formatRollout(s.rollout_rule)}
                            </span>
                            <div className="mt-1">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                  s.task_type === 'recurring'
                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20'
                                    : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20'
                                }`}
                              >
                                {s.task_type === 'recurring' ? 'Recurring' : 'One-Time'}
                              </span>
                            </div>
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {matrixLoading ? (
                      <tr>
                        <td
                          colSpan={services.length + 2}
                          className="px-6 py-10 text-center text-sm text-slate-500"
                        >
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      matrixClients.map((c: any) => {
                        const rowState = matrixEdits[c.id] || {};
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            {/* Client */}
                            <td className="px-6 py-6 font-semibold text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-900">
                              {c.name}
                            </td>

                            {/* Service cells */}
                            {services.map((s: any) => {
                              const currentFreq = (rowState[s.id] || 'NA') as TaskServiceFrequency;
                              const isOneTime = s.task_type === 'one_time';

                              if (isOneTime) {
                                const enabled = currentFreq !== 'NA';
                                return (
                                  <td key={s.id} className="px-6 py-6">
                                    <div className="flex items-center space-x-3">
                                      <label className="relative inline-flex items-center cursor-pointer group">
                                        <input
                                          type="checkbox"
                                          className="sr-only peer"
                                          checked={enabled}
                                          onChange={() =>
                                            setMatrixEdits((prev) => ({
                                              ...prev,
                                              [c.id]: {
                                                ...(prev[c.id] || {}),
                                                [s.id]: (enabled ? 'NA' : 'Custom') as TaskServiceFrequency,
                                              },
                                            }))
                                          }
                                        />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                                      </label>
                                      <span
                                        className={`text-xs font-semibold px-2 py-1 rounded-md border ${
                                          enabled
                                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                        }`}
                                      >
                                        {enabled ? 'Enabled' : 'Disabled'}
                                      </span>
                                      <div className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800 uppercase tracking-wider">
                                        One-Time
                                      </div>
                                    </div>
                                  </td>
                                );
                              }

                              const enabled = currentFreq !== 'NA';
                              const fallbackFreq =
                                frequencyOptions.find((o: any) => o.value !== 'NA')?.value || 'NA';
                              const handleToggleRecurring = () => {
                                setMatrixEdits((prev) => ({
                                  ...prev,
                                  [c.id]: {
                                    ...(prev[c.id] || {}),
                                    [s.id]: (enabled ? 'NA' : (fallbackFreq as TaskServiceFrequency)),
                                  },
                                }));
                              };
                              const freqLabel =
                                frequencyOptions.find((o: any) => o.value === currentFreq)?.label ||
                                currentFreq;

                              return (
                                <td key={s.id} className="px-6 py-6">
                                  <div className="flex items-center space-x-3">
                                    <label className="relative inline-flex items-center cursor-pointer group">
                                      <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={enabled}
                                        onChange={handleToggleRecurring}
                                      />
                                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                                    </label>
                                    <span
                                      className={`text-xs font-semibold px-2 py-1 rounded-md border ${
                                        enabled
                                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                      }`}
                                    >
                                      {enabled ? 'Enabled' : 'NA'}
                                    </span>
                                    <select
                                      className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded border bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20 focus:outline-none"
                                      value={currentFreq}
                                      disabled={!enabled}
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
                                      {(frequencyOptions.length ? frequencyOptions : [{ value: 'NA', label: 'NA' }]).map(
                                        (o: any) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </div>
                                </td>
                              );
                            })}

                            {/* Row Save */}
                            <td className="px-6 py-6 text-right">
                              <button
                                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded uppercase tracking-widest shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                                onClick={() => {
                                  const items = services.map((s: any) => ({
                                    taskServiceId: s.id,
                                    frequency: (rowState[s.id] || 'NA') as TaskServiceFrequency,
                                  }));
                                  upsertMutation.mutate({ clientId: c.id, items });
                                }}
                                disabled={upsertMutation.isLoading}
                              >
                                {upsertMutation.isLoading ? 'Saving…' : 'Save'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {!matrixLoading && matrixClients.length === 0 && (
                      <tr>
                        <td
                          colSpan={services.length + 2}
                          className="px-6 py-10 text-center text-sm text-slate-500"
                        >
                          No clients found. Add clients first.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer-like area for pagination UI */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between">
                <span className="text-sm text-slate-500">Showing {matrixClients.length} clients</span>
                <div className="flex space-x-2">
                  <button className="p-2 border border-slate-200 dark:border-slate-700 rounded hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-400">
                    <span className="material-icons-outlined">chevron_left</span>
                  </button>
                  <button className="p-2 border border-slate-200 dark:border-slate-700 rounded hover:bg-white dark:hover:bg-slate-800 transition-colors text-slate-400">
                    <span className="material-icons-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {modal && (
          <div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"
            onClick={() => setModal(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg mx-auto flex flex-col max-h-[90vh] my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 pb-2 flex-shrink-0">
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {modal.mode === 'add' ? 'Add Client' : 'Edit Client'}
                </div>
              </div>
              <div className="px-6 pb-4 flex-1 overflow-y-auto space-y-3 min-h-0">
                <div>
                  <label className="block text-sm font-medium mb-1">Name *</label>
                  <input
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <EmployeeOrgLevelNodeSelectors
                  tree={orgStructureTreeData}
                  value={form.orgNodeByLevel}
                  onChange={(orgNodeByLevel) => setForm((prev) => ({ ...prev, orgNodeByLevel }))}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1">
                  Select organisation, company, region, etc. Node field values are managed in Entity Master Data.
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1">PAN</label>
                  <input
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800 uppercase"
                    placeholder="ABCDE1234F"
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reporting Partner Mobile No.</label>
                  <input
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800"
                    placeholder="+911234567890"
                    value={form.reportingPartnerMobile}
                    onChange={(e) => setForm({ ...form, reportingPartnerMobile: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white dark:bg-slate-800"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="p-6 pt-4 flex-shrink-0 border-t border-slate-100 dark:border-slate-700">
                <div className="flex justify-end gap-2">
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
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

