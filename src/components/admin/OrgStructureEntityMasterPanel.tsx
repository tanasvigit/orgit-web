import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { normalizeEntityTypeSelection } from '../../screens/admin/settings/organizationStructureEntityTypes';
import { schemaToFieldValues } from './OrganizationStructureDynamicFields';
import { getLevelSchema } from '../../hooks/useOrgStructureLevelSchema';
import type {
  OrganizationStructureFieldSchemaField,
  OrganizationStructureNode,
  OrganizationStructureTree,
} from '../../services/settingsService';
import { updateOrganizationStructureNode } from '../../services/settingsService';
import { useToast } from '../../context/ToastContext';
import { getAssignmentSectionsFromTree } from '../../utils/employeeOrgNodeLevels';

function getNodeEntityType(node: { metaJson?: Record<string, unknown>; levelLabel?: string }) {
  const raw =
    node.metaJson && typeof node.metaJson.entityType === 'string'
      ? String(node.metaJson.entityType).trim()
      : '';
  return raw || node.levelLabel || '';
}

function entityTypeDisplay(selected: string, custom: string): string {
  if (!selected) return '—';
  if (selected === 'Custom') return custom.trim() || 'Custom';
  return selected;
}

function getNodeTypeLabel(node: OrganizationStructureNode): string {
  const norm = normalizeEntityTypeSelection(getNodeEntityType(node), node.levelNumber);
  return entityTypeDisplay(norm.selectedEntityType, norm.customEntityType);
}

function cellDisplayValue(
  node: OrganizationStructureNode,
  field: OrganizationStructureFieldSchemaField
): string {
  const raw = node.fieldValues?.[field.key];
  if (raw === undefined || raw === null || raw === '') {
    if (field.key === 'name') return node.name || '';
    return '';
  }
  return String(raw);
}

type Props = {
  tree: OrganizationStructureTree | null | undefined;
  organizationName?: string;
  onOrganizationNameChange?: (name: string) => void;
  valuesEditable?: boolean;
};

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{label}</span>
      <p className="text-sm text-slate-900 dark:text-slate-100">{value || '—'}</p>
    </div>
  );
}

export function OrgStructureEntityMasterPanel({
  tree,
  organizationName,
  onOrganizationNameChange,
  valuesEditable = false,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rootNode = tree?.rootNode ?? null;
  const levels = tree?.levels ?? [];
  const nodes = tree?.nodes ?? [];

  const assignmentSections = useMemo(() => getAssignmentSectionsFromTree(tree), [tree]);

  const [selectedLevelId, setSelectedLevelId] = useState<string>(() => assignmentSections[0]?.id ?? '');

  React.useEffect(() => {
    if (assignmentSections.length === 0) return;
    const exists = assignmentSections.some((l) => l.id === selectedLevelId);
    if (!exists) {
      setSelectedLevelId(assignmentSections[0].id);
    }
  }, [assignmentSections, selectedLevelId]);

  const rootEntityType = useMemo(() => {
    if (!rootNode) return { selectedEntityType: '', customEntityType: '' };
    return normalizeEntityTypeSelection(getNodeEntityType(rootNode), 1);
  }, [rootNode]);

  const [l1Name, setL1Name] = useState(rootNode?.name || organizationName || '');

  React.useEffect(() => {
    setL1Name(rootNode?.name || organizationName || '');
  }, [rootNode?.id, rootNode?.name, organizationName]);

  const saveRootMutation = useMutation(
    async () => {
      if (!rootNode) throw new Error('No level-1 node defined');
      const fieldValues = {
        ...(rootNode.fieldValues || {}),
        name: l1Name.trim(),
      };
      await updateOrganizationStructureNode(rootNode.id, {
        name: l1Name.trim(),
        fieldValues,
      });
      onOrganizationNameChange?.(l1Name.trim());
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['entity-master-org-structure-status']);
        queryClient.invalidateQueries(['organization-structure-tree']);
        toast.success('Organisation (level 1) updated');
      },
      onError: (err: any) => {
        toast.error(err.response?.data?.error || err.message || 'Failed to save');
      },
    }
  );

  const selectedLevel = assignmentSections.find((l) => l.id === selectedLevelId);
  const levelNodes = useMemo(
    () =>
      nodes
        .filter(
          (n) =>
            n.status !== 'archived' &&
            (n.levelId === selectedLevelId ||
              (selectedLevel &&
                (n.levelLabel || '').trim().toLowerCase() ===
                  selectedLevel.levelLabel.trim().toLowerCase()))
        )
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
    [nodes, selectedLevelId, selectedLevel]
  );
  const schema = getLevelSchema(levels, selectedLevel?.levelNumber ?? 0);

  if (!(tree?.summary?.hasRootNode || tree?.summary?.hasRootGroup)) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
        Complete <strong>Org Definition</strong> first (level 1 group). Entity master sections mirror that hierarchy.
      </div>
    );
  }

  const l1TypeDisplay = entityTypeDisplay(
    rootEntityType.selectedEntityType,
    rootEntityType.customEntityType
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Level 1 — Organisation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReadOnlyValue label="Type of entity" value={l1TypeDisplay} />
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
              Organisation name *
            </label>
            {valuesEditable ? (
              <input
                type="text"
                value={l1Name}
                onChange={(e) => setL1Name(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            ) : (
              <p className="text-sm text-slate-900 dark:text-slate-100">{l1Name || '—'}</p>
            )}
          </div>
        </div>
        {valuesEditable ? (
          <button
            type="button"
            onClick={() => saveRootMutation.mutate()}
            disabled={saveRootMutation.isLoading || !l1Name.trim()}
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saveRootMutation.isLoading ? 'Saving…' : 'Save organisation'}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-700 dark:bg-slate-800">
        <div className="p-5 md:p-6 border-b border-slate-100 bg-slate-50/40 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2 dark:text-white">
            <span className="material-symbols-outlined text-primary text-lg">tune</span>
            Entity Section
          </h2>
          <p className="text-xs text-slate-500 mb-3 dark:text-slate-400">
            Select a level (from L2). Field definitions are managed in Org Definition; edit values with{' '}
            <span className="font-medium">Edit</span> above.
          </p>
          {assignmentSections.length === 0 ? (
            <p className="text-sm text-slate-500">No levels below L1 defined yet. Add them in Org Definition.</p>
          ) : (
            <select
              value={selectedLevelId}
              onChange={(e) => setSelectedLevelId(e.target.value)}
              className="w-full md:max-w-md rounded-lg border border-slate-200 bg-white text-slate-900 text-sm py-2.5 px-3 focus:border-primary focus:ring-primary focus:ring-1 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {assignmentSections.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.levelLabel}
                </option>
              ))}
            </select>
          )}
        </div>

        {assignmentSections.length > 0 ? (
          <OrgStructureLevelValuesTable
            key={selectedLevelId}
            levelLabel={selectedLevel?.levelLabel ?? ''}
            nodes={levelNodes}
            schema={schema}
            valuesEditable={valuesEditable}
          />
        ) : null}
      </div>
    </div>
  );
}

function OrgStructureLevelValuesTable({
  levelLabel,
  nodes,
  schema,
  valuesEditable,
}: {
  levelLabel: string;
  nodes: OrganizationStructureNode[];
  schema: OrganizationStructureFieldSchemaField[];
  valuesEditable: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draftByNodeId, setDraftByNodeId] = useState<Record<string, Record<string, string>>>({});
  const [savingNodeId, setSavingNodeId] = useState<string | null>(null);

  React.useEffect(() => {
    const next: Record<string, Record<string, string>> = {};
    for (const node of nodes) {
      next[node.id] = schemaToFieldValues(schema, node.fieldValues as Record<string, unknown>);
      if (schema.some((f) => f.key === 'name')) {
        next[node.id].name = next[node.id].name || node.name || '';
      }
    }
    setDraftByNodeId(next);
  }, [nodes, schema]);

  const saveNode = async (node: OrganizationStructureNode) => {
    const fv = { ...(draftByNodeId[node.id] || {}) };
    setSavingNodeId(node.id);
    try {
      if (fv.name !== undefined) {
        await updateOrganizationStructureNode(node.id, {
          name: String(fv.name || node.name).trim(),
          fieldValues: fv,
        });
      } else {
        await updateOrganizationStructureNode(node.id, { fieldValues: fv });
      }
      queryClient.invalidateQueries(['entity-master-org-structure-status']);
      toast.success(`Saved ${String(fv.name || node.name).trim() || node.name}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save');
    } finally {
      setSavingNodeId(null);
    }
  };

  const updateDraft = (nodeId: string, key: string, value: string) => {
    setDraftByNodeId((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] || {}), [key]: value },
    }));
  };

  const colCount = 1 + schema.length + (valuesEditable ? 1 : 0);

  return (
    <div className="p-4 md:p-5">
      <p className="text-sm font-medium text-slate-700 mb-3 dark:text-slate-200">
        {levelLabel}
        <span className="ml-2 font-normal text-slate-500">({nodes.length} records)</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Type
              </th>
              {schema.map((field) => (
                <th
                  key={field.id || field.key}
                  className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {field.label}
                  {field.required ? ' *' : ''}
                </th>
              ))}
              {valuesEditable ? (
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {nodes.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-slate-500">
                  No entities at this level. Add nodes in Org Definition.
                </td>
              </tr>
            ) : (
              nodes.map((node) => {
                const draft = draftByNodeId[node.id] || {};
                return (
                  <tr key={node.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {getNodeTypeLabel(node)}
                    </td>
                    {schema.map((field) => (
                      <td key={field.id || field.key} className="px-4 py-3 text-sm align-top">
                        {valuesEditable ? (
                          field.type === 'textarea' ? (
                            <textarea
                              value={draft[field.key] ?? ''}
                              onChange={(e) => updateDraft(node.id, field.key, e.target.value)}
                              rows={2}
                              className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                            />
                          ) : field.type === 'select' ? (
                            <select
                              value={draft[field.key] ?? ''}
                              onChange={(e) => updateDraft(node.id, field.key, e.target.value)}
                              className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                            >
                              <option value="">—</option>
                              {(field.options || []).map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={
                                field.type === 'number'
                                  ? 'number'
                                  : field.type === 'date'
                                    ? 'date'
                                    : 'text'
                              }
                              value={draft[field.key] ?? ''}
                              onChange={(e) => updateDraft(node.id, field.key, e.target.value)}
                              className="w-full min-w-[120px] rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                            />
                          )
                        ) : (
                          <span className="text-slate-900 dark:text-slate-100">
                            {draft[field.key]?.trim() || cellDisplayValue(node, field) || '—'}
                          </span>
                        )}
                      </td>
                    ))}
                    {valuesEditable ? (
                      <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                        <button
                          type="button"
                          onClick={() => saveNode(node)}
                          disabled={savingNodeId === node.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {savingNodeId === node.id ? 'Saving…' : 'Save'}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
