import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useToast } from '../../../context/ToastContext';
import {
  archiveOrganizationStructureNode,
  createOrganizationStructureNode,
  OrganizationStructureFieldSchemaField,
  getOrganizationStructureTree,
  OrganizationStructureLevel,
  OrganizationStructureNode,
  updateOrganizationStructureNode,
} from '../../../services/settingsService';
import {
  OrganizationStructureInlineDraftForm,
  type InlineDraftState,
} from './OrganizationStructureInlineDraftForm';
import {
  OrganizationStructureHorizontalChart,
} from './OrganizationStructureHorizontalChart';
import {
  getEntityTypeOptionsForSection,
  getOrgLevelChoicesForChild,
  getOrgLevelDefinitionByHeader,
  normalizeEntityTypeSelection,
} from './organizationStructureEntityTypes';
import {
  CREATE_NODE_FIELD_SCHEMA,
  buildEditFieldList,
  type ExtendedFieldDef,
} from './organizationStructureExtendedFieldCatalog';
import {
  OrganizationStructureNodeEditModal,
  type NodeEditFormState,
  type NodeModalPanelMode,
} from './OrganizationStructureNodeEditModal';

type NodeModalState = {
  node: OrganizationStructureNode;
  panelMode: NodeModalPanelMode;
} | null;

const levelThemePalette = [
  {
    column: 'bg-sky-50/80 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900/60',
    header: 'bg-gradient-to-b from-sky-100 to-sky-50 border-sky-200 dark:from-sky-900/50 dark:to-sky-950/30 dark:border-sky-900/60',
    icon: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200',
    action: 'text-sky-600 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-900/40',
    arrow: 'text-sky-300 dark:text-sky-800',
  },
  {
    column: 'bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60',
    header: 'bg-gradient-to-b from-emerald-100 to-emerald-50 border-emerald-200 dark:from-emerald-900/50 dark:to-emerald-950/30 dark:border-emerald-900/60',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
    action: 'text-emerald-600 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/40',
    arrow: 'text-emerald-300 dark:text-emerald-800',
  },
  {
    column: 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/60',
    header: 'bg-gradient-to-b from-amber-100 to-amber-50 border-amber-200 dark:from-amber-900/50 dark:to-amber-950/30 dark:border-amber-900/60',
    icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
    action: 'text-amber-600 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40',
    arrow: 'text-amber-300 dark:text-amber-800',
  },
  {
    column: 'bg-violet-50/80 border-violet-200 dark:bg-violet-950/20 dark:border-violet-900/60',
    header: 'bg-gradient-to-b from-violet-100 to-violet-50 border-violet-200 dark:from-violet-900/50 dark:to-violet-950/30 dark:border-violet-900/60',
    icon: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
    action: 'text-violet-600 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/40',
    arrow: 'text-violet-300 dark:text-violet-800',
  },
  {
    column: 'bg-cyan-50/80 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-900/60',
    header: 'bg-gradient-to-b from-cyan-100 to-cyan-50 border-cyan-200 dark:from-cyan-900/50 dark:to-cyan-950/30 dark:border-cyan-900/60',
    icon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-200',
    action: 'text-cyan-600 hover:bg-cyan-100 dark:text-cyan-300 dark:hover:bg-cyan-900/40',
    arrow: 'text-cyan-300 dark:text-cyan-800',
  },
  {
    column: 'bg-rose-50/80 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60',
    header: 'bg-gradient-to-b from-rose-100 to-rose-50 border-rose-200 dark:from-rose-900/50 dark:to-rose-950/30 dark:border-rose-900/60',
    icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200',
    action: 'text-rose-600 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40',
    arrow: 'text-rose-300 dark:text-rose-800',
  },
];

const getNodeEntityType = (node?: OrganizationStructureNode | null) => {
  const rawEntityType =
    node && node.metaJson && typeof (node.metaJson as Record<string, unknown>).entityType === 'string'
      ? String((node.metaJson as Record<string, unknown>).entityType).trim()
      : '';

  return rawEntityType || node?.levelLabel || '';
};

const getDraftFieldLabel = (draft: Pick<InlineDraftState, 'selectedEntityType' | 'customEntityType'>) => {
  const selected = draft.selectedEntityType.trim();
  if (selected === 'Custom') {
    return draft.customEntityType.trim();
  }
  return selected;
};

const getDraftHeaderCategory = (
  draft: Pick<InlineDraftState, 'selectedSection'>,
  existingLevel?: OrganizationStructureLevel
) => {
  if (existingLevel?.levelLabel?.trim()) {
    return existingLevel.levelLabel.trim();
  }
  return draft.selectedSection.trim();
};

const getDraftSummaryLabel = (
  draft: Pick<InlineDraftState, 'selectedSection' | 'selectedEntityType' | 'customEntityType'>,
  existingLevel?: OrganizationStructureLevel
) => {
  const header = getDraftHeaderCategory(draft, existingLevel);
  const field = getDraftFieldLabel(draft);
  if (header && field) {
    return `${header} · ${field}`;
  }
  return header || field;
};

const slugifyFieldKey = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const getNodeFieldValues = (node?: OrganizationStructureNode | null): Record<string, unknown> => {
  if (!node) {
    return {};
  }

  if (node.fieldValues && typeof node.fieldValues === 'object') {
    return node.fieldValues;
  }

  const metaFieldValues = node.metaJson && typeof node.metaJson === 'object' ? (node.metaJson as Record<string, unknown>).fieldValues : null;
  return metaFieldValues && typeof metaFieldValues === 'object' ? (metaFieldValues as Record<string, unknown>) : {};
};

const createEmptyFieldValues = (
  schema: OrganizationStructureFieldSchemaField[],
  source?: Record<string, unknown>
): Record<string, string> =>
  schema.reduce<Record<string, string>>((acc, field) => {
    const rawValue = source?.[field.key];
    acc[field.key] = rawValue === undefined || rawValue === null ? '' : String(rawValue);
    return acc;
  }, {});

const serializeFieldValues = (
  schema: OrganizationStructureFieldSchemaField[],
  fieldValues: Record<string, string>
): Record<string, unknown> =>
  schema.reduce<Record<string, unknown>>((acc, field) => {
    const rawValue = fieldValues[field.key] ?? '';
    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      return acc;
    }

    if (field.type === 'number') {
      acc[field.key] = Number(trimmedValue);
      return acc;
    }

    acc[field.key] = trimmedValue;
    return acc;
  }, {});

const validateFieldSchemaDraft = (schema: OrganizationStructureFieldSchemaField[]): string | null => {
  if (schema.length === 0) {
    return 'Add at least one field to the entity section';
  }

  const usedKeys = new Set<string>();
  let hasNameField = false;

  for (const field of schema) {
    const label = field.label.trim();
    const key = field.key.trim();
    if (!label) {
      return 'Each field must have a label';
    }
    if (!key) {
      return `Field "${label}" must have a key`;
    }
    if (usedKeys.has(key)) {
      return `Field key "${key}" is duplicated`;
    }
    usedKeys.add(key);

    if (field.key === 'name') {
      hasNameField = field.required;
    }

    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      return `Field "${label}" needs at least one option`;
    }
  }

  if (!hasNameField) {
    return 'Each entity section must include a required "name" field';
  }

  return null;
};

function sortStructureNodes(list: OrganizationStructureNode[]): OrganizationStructureNode[] {
  return [...list].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

const buildSelectedPathState = (node?: OrganizationStructureNode | null): Record<number, string> => {
  if (!node) {
    return {};
  }

  return node.path.reduce<Record<number, string>>((acc, pathItem) => {
    acc[pathItem.levelNumber] = pathItem.id;
    return acc;
  }, {});
};

const isSameSelectedPath = (left: Record<number, string>, right: Record<number, string>) => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[Number(key)] === right[Number(key)]);
};

export const OrganisationDefinitionScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPathByLevel, setSelectedPathByLevel] = useState<Record<number, string>>({});
  const [nodeModalState, setNodeModalState] = useState<NodeModalState>(null);
  const [inlineDraft, setInlineDraft] = useState<InlineDraftState | null>(null);

  const treeQuery = useQuery(
    ['organization-structure-tree'],
    () =>
      getOrganizationStructureTree({
        includeArchived: true,
        includeInactive: true,
      }).then((response) => response.data || response),
    {
      refetchOnWindowFocus: false,
    }
  );

  const levels: OrganizationStructureLevel[] = treeQuery.data?.levels || [];
  const nodes: OrganizationStructureNode[] = treeQuery.data?.nodes || [];
  const rootNode: OrganizationStructureNode | null = treeQuery.data?.rootNode || null;

  const levelByNumber = useMemo(() => new Map(levels.map((level) => [level.levelNumber, level])), [levels]);
  const levelByLabel = useMemo(
    () => new Map(levels.map((level) => [level.levelLabel.trim().toLowerCase(), level])),
    [levels]
  );
  const orderedLevels = useMemo(
    () => [...levels].sort((a, b) => a.levelNumber - b.levelNumber),
    [levels]
  );
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  useEffect(() => {
    if (!rootNode) {
      setSelectedPathByLevel((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    setSelectedPathByLevel((prev) => {
      const deepestSelectedNode = [...levels]
        .sort((a, b) => b.levelNumber - a.levelNumber)
        .map((level) => {
          const selectedId = prev[level.levelNumber];
          return selectedId ? nodeById.get(selectedId) || null : null;
        })
        .find((node): node is OrganizationStructureNode => Boolean(node));

      const nextSelection = deepestSelectedNode ? buildSelectedPathState(deepestSelectedNode) : { 1: rootNode.id };
      return isSameSelectedPath(prev, nextSelection) ? prev : nextSelection;
    });
  }, [levels, nodeById, rootNode]);

  const selectedNode = useMemo(() => {
    const selectedLevelNumber = [...levels]
      .sort((a, b) => b.levelNumber - a.levelNumber)
      .find((level) => selectedPathByLevel[level.levelNumber])?.levelNumber;

    if (!selectedLevelNumber) {
      return rootNode;
    }

    return nodeById.get(selectedPathByLevel[selectedLevelNumber]) || rootNode;
  }, [levels, nodeById, rootNode, selectedPathByLevel]);

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, OrganizationStructureNode[]>();
    for (const n of nodes) {
      const key = n.parentNodeId ? String(n.parentNodeId) : '__root__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    for (const [k, arr] of map.entries()) {
      map.set(k, sortStructureNodes(arr));
    }
    return map;
  }, [nodes]);

  const rootTreeNodes = useMemo(() => {
    const fromRootKey = sortStructureNodes(childrenByParentId.get('__root__') || []);
    if (fromRootKey.length > 0) return fromRootKey;
    if (rootNode) return [rootNode];
    return sortStructureNodes(nodes.filter((n) => n.levelNumber === 1));
  }, [childrenByParentId, rootNode, nodes]);

  const chartColumnCount = useMemo(() => {
    const draftSection =
      inlineDraft?.relation === 'child' && inlineDraft.selectedSection
        ? inlineDraft.selectedSection.trim().toLowerCase()
        : '';
    const draftAddsColumn =
      draftSection && !levelByLabel.has(draftSection) && inlineDraft?.relation === 'child';
    return Math.max(1, orderedLevels.length + (draftAddsColumn ? 1 : 0));
  }, [inlineDraft, levelByLabel, orderedLevels.length]);

  const createNodeMutation = useMutation(createOrganizationStructureNode, {
    onSuccess: () => {
      queryClient.invalidateQueries('organization-structure-tree');
      setNodeModalState(null);
      toast.success('Hierarchy node saved successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to save hierarchy node');
    },
  });

  const updateNodeMutation = useMutation(
    ({ id, data }: { id: string; data: Parameters<typeof updateOrganizationStructureNode>[1] }) =>
      updateOrganizationStructureNode(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('organization-structure-tree');
        setNodeModalState(null);
        toast.success('Hierarchy node updated successfully');
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.error || error?.message || 'Failed to update hierarchy node');
      },
    }
  );

  const archiveNodeMutation = useMutation((id: string) => archiveOrganizationStructureNode(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('organization-structure-tree');
      toast.success('Hierarchy node archived successfully');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to archive hierarchy node');
    },
  });

  const openNodeModal = (node: OrganizationStructureNode, panelMode: NodeModalPanelMode) => {
    setNodeModalState({ node, panelMode });
  };

  const closeNodeModal = () => {
    setNodeModalState(null);
  };

  const openInlineDraft = (relation: 'root' | 'child' | 'sibling', referenceNode?: OrganizationStructureNode) => {
    const selectedSection =
      relation === 'root'
        ? 'Group'
        : relation === 'child'
          ? getOrgLevelChoicesForChild()[0]?.headerCategory || 'Entity'
          : referenceNode?.levelLabel || '';
    const existingLevel = levelByLabel.get(selectedSection.trim().toLowerCase());
    const headerCategory = getDraftHeaderCategory({ selectedSection }, existingLevel);

    setInlineDraft({
      relation,
      referenceNode,
      selectedSection,
      selectedEntityType: '',
      customEntityType: '',
      definitionSource: existingLevel?.definitionSource || (headerCategory ? 'preset' : 'custom'),
      presetKey:
        existingLevel?.presetKey ||
        (headerCategory ? slugifyFieldKey(headerCategory) : null),
      fieldValues: createEmptyFieldValues(CREATE_NODE_FIELD_SCHEMA),
      description: '',
      status: 'active',
    });
  };

  const closeInlineDraft = () => {
    setInlineDraft(null);
  };

  const updateInlineDraftFieldValue = (fieldKey: string, value: string) => {
    setInlineDraft((prev) =>
      prev
        ? {
            ...prev,
            fieldValues: {
              ...prev.fieldValues,
              [fieldKey]: value,
            },
          }
        : prev
    );
  };

  const handleSelectNode = (node: OrganizationStructureNode) => {
    setSelectedPathByLevel(buildSelectedPathState(node));
  };

  const handleInlineDraftSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inlineDraft) {
      return;
    }

    const fieldLabel = getDraftFieldLabel(inlineDraft);
    if (!fieldLabel) {
      toast.error('Select a field for this level');
      return;
    }

    const sectionLabel = inlineDraft.selectedSection.trim();
    if (!sectionLabel) {
      toast.error('Select a section');
      return;
    }

    const existingLevel = levelByLabel.get(sectionLabel.toLowerCase());
    const headerCategory = getDraftHeaderCategory(inlineDraft, existingLevel);

    const createLevelFieldSchema = CREATE_NODE_FIELD_SCHEMA.map((field) => ({ ...field }));
    const fieldSchemaError = validateFieldSchemaDraft(createLevelFieldSchema);
    if (!existingLevel && fieldSchemaError) {
      toast.error(fieldSchemaError);
      return;
    }

    const fieldValues = serializeFieldValues(createLevelFieldSchema, inlineDraft.fieldValues);

    await createNodeMutation.mutateAsync({
      relation: inlineDraft.relation,
      referenceNodeId: inlineDraft.referenceNode?.id,
      targetSectionLabel: inlineDraft.relation === 'child' ? sectionLabel : undefined,
      name: typeof fieldValues.name === 'string' ? String(fieldValues.name) : undefined,
      code: typeof fieldValues.code === 'string' ? String(fieldValues.code).toUpperCase() : undefined,
      description: inlineDraft.description.trim() || undefined,
      status: inlineDraft.status,
      createLevelLabel: existingLevel ? undefined : headerCategory,
      createLevelDefinitionSource: existingLevel ? undefined : inlineDraft.definitionSource,
      createLevelPresetKey: existingLevel ? undefined : inlineDraft.presetKey,
      createLevelFieldSchema: existingLevel ? undefined : createLevelFieldSchema,
      metaJson: { entityType: fieldLabel },
      fieldValues,
    });

    setInlineDraft(null);
  };

  const schemaFieldsFromExtended = (fields: ExtendedFieldDef[]): OrganizationStructureFieldSchemaField[] =>
    fields.map(({ category: _category, readOnly: _readOnly, ...field }) => field);

  const handleEditNodeSubmit = async (form: NodeEditFormState) => {
    if (!nodeModalState) {
      return;
    }

    const node = nodeModalState.node;
    const entityLabel =
      form.selectedEntityType === 'Custom' ? form.customEntityType.trim() : form.selectedEntityType.trim();
    const editFields = buildEditFieldList(form.customFieldSchema);
    const fieldValues = serializeFieldValues(schemaFieldsFromExtended(editFields), form.fieldValues);
    const existingMeta =
      node.metaJson && typeof node.metaJson === 'object'
        ? { ...(node.metaJson as Record<string, unknown>) }
        : {};
    const metaJson: Record<string, unknown> = {
      ...existingMeta,
      entityType: entityLabel || node.levelLabel,
      fieldValues,
      customFieldSchema: form.customFieldSchema,
    };

    await updateNodeMutation.mutateAsync({
      id: node.id,
      data: {
        name: typeof fieldValues.name === 'string' ? String(fieldValues.name) : undefined,
        code: typeof fieldValues.code === 'string' ? String(fieldValues.code).toUpperCase() : undefined,
        description: form.description.trim() || undefined,
        status: form.status,
        fieldValues,
        metaJson,
      },
    });
  };

  const handleArchiveNode = (node: OrganizationStructureNode) => {
    if (window.confirm(`Archive "${node.name}"? Archived nodes stay visible to admins but are hidden from operations.`)) {
      archiveNodeMutation.mutate(node.id);
    }
  };

  function renderInlineDraftForm(indentPx: number): React.ReactNode {
    if (!inlineDraft) return null;

    const sectionLabel = inlineDraft.selectedSection.trim();
    const existingLevel = levelByLabel.get(sectionLabel.toLowerCase());
    const levelDefinition = getOrgLevelDefinitionByHeader(sectionLabel);
    const levelPickerOptions =
      inlineDraft.relation === 'child' ? getOrgLevelChoicesForChild() : [];
    const showLevelPicker = inlineDraft.relation === 'child';

    return (
      <OrganizationStructureInlineDraftForm
        indentPx={indentPx}
        inlineDraft={inlineDraft}
        draftLevelNumber={existingLevel?.levelNumber || 0}
        existingLevel={existingLevel}
        levelDefinition={levelDefinition}
        levelPickerOptions={levelPickerOptions}
        showLevelPicker={showLevelPicker}
        draftSummaryLabel={getDraftSummaryLabel(inlineDraft, existingLevel)}
        fieldOptions={getEntityTypeOptionsForSection(sectionLabel)}
        slugifyFieldKey={slugifyFieldKey}
        onClose={closeInlineDraft}
        onSubmit={handleInlineDraftSubmit}
        setInlineDraft={setInlineDraft}
        updateInlineDraftFieldValue={updateInlineDraftFieldValue}
      />
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-none px-2 py-3 pb-6 sm:px-3 md:px-4 md:py-4">
        {treeQuery.isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Loading hierarchyâ€¦
          </div>
        ) : (
          <>
            {inlineDraft && !rootNode && inlineDraft.relation === 'root' ? (
              <div className="mb-3 max-w-lg">{renderInlineDraftForm(0)}</div>
            ) : null}

            {!rootNode && !inlineDraft ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center dark:border-slate-600">
                <p className="text-sm text-slate-600 dark:text-slate-400">No organization structure yet.</p>
                <button
                  type="button"
                  onClick={() => openInlineDraft('root')}
                  className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  Create Group
                </button>
              </div>
            ) : null}

            {rootNode ? (
              <>
                <div className="mb-2 flex flex-wrap justify-end gap-1.5">
                  <button
                    type="button"
                    title="Add sibling (same level)"
                    onClick={() => selectedNode && openInlineDraft('sibling', selectedNode)}
                    disabled={!selectedNode || selectedNode.levelNumber === 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200"
                  >
                    <span className="material-symbols-outlined text-[22px]">add_circle</span>
                  </button>
                  <button
                    type="button"
                    title="Add child (next level)"
                    onClick={() => selectedNode && openInlineDraft('child', selectedNode)}
                    disabled={!selectedNode}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                  >
                    <span className="material-symbols-outlined text-[22px]">control_point_duplicate</span>
                  </button>
                  <button
                    type="button"
                    title="View selected node"
                    onClick={() => selectedNode && openNodeModal(selectedNode, 'view')}
                    disabled={!selectedNode}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <span className="material-symbols-outlined text-[22px]">visibility</span>
                  </button>
                  <button
                    type="button"
                    title="Edit selected node"
                    onClick={() => selectedNode && openNodeModal(selectedNode, 'edit')}
                    disabled={!selectedNode}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <span className="material-symbols-outlined text-[22px]">edit</span>
                  </button>
                </div>
                {rootTreeNodes.length === 0 && !inlineDraft ? (
                  <div className="mb-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/80 p-2 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
                    No level-1 nodes returned. Refresh or check API data.
                  </div>
                ) : null}
                <OrganizationStructureHorizontalChart
                  title=""
                  showChartIntro={false}
                  levels={levels}
                  nodes={nodes}
                  rootTreeNodes={rootTreeNodes}
                  childrenByParentId={childrenByParentId}
                  levelThemePalette={levelThemePalette}
                  selectedNode={selectedNode}
                  onSelectNode={handleSelectNode}
                  getNodeFieldValues={getNodeFieldValues}
                  getNodeEntityType={getNodeEntityType}
                  openInlineDraft={openInlineDraft}
                  onArchiveNode={handleArchiveNode}
                  onOpenNodeView={(node) => openNodeModal(node, 'view')}
                  onOpenNodeEdit={(node) => openNodeModal(node, 'edit')}
                  inlineDraft={inlineDraft}
                  chartInlineDraft={(_box) => renderInlineDraftForm(0)}
                  orderedLevels={orderedLevels}
                  columnCount={chartColumnCount}
                />
              </>
            ) : null}
          </>
        )}
      </div>

      {nodeModalState ? (
        <OrganizationStructureNodeEditModal
          key={`${nodeModalState.node.id}-${nodeModalState.panelMode}`}
          node={nodeModalState.node}
          initialMode={nodeModalState.panelMode}
          parentName={
            nodeModalState.node.parentNodeId
              ? nodeById.get(nodeModalState.node.parentNodeId)?.name || null
              : null
          }
          getNodeEntityType={getNodeEntityType}
          getNodeFieldValues={getNodeFieldValues}
          onClose={closeNodeModal}
          onSubmit={handleEditNodeSubmit}
          isSaving={updateNodeMutation.isLoading}
        />
      ) : null}
    </AdminLayout>
  );
};

export const OrganisationStructureScreen: React.FC = () => {
  const navigate = useNavigate();
  const treeQuery = useQuery(
    ['organization-structure-tree-overview'],
    () =>
      getOrganizationStructureTree({
        includeArchived: true,
        includeInactive: true,
      }).then((response) => response.data || response),
    {
      refetchOnWindowFocus: false,
    }
  );

  const rootDefined = Boolean(treeQuery.data?.rootNode);
  const summary = treeQuery.data?.summary;

  const cards = [
    {
      icon: 'schema',
      title: 'Org Definition',
      subtitle: rootDefined
        ? 'Manage the web-only hierarchy definition, levels, and node lifecycle.'
        : 'Create the Group root and define the hierarchy on web before applying it elsewhere.',
      actionLabel: rootDefined ? 'Open Org Definition' : 'Start Org Definition',
      screen: '/admin/settings/org-definition',
      tone: 'primary',
    },
    {
      icon: 'groups',
      title: 'Entity List',
      subtitle: 'Assign client entities directly to org nodes once the hierarchy is defined.',
      actionLabel: 'Open Entity List',
      screen: '/admin/entities',
      tone: 'neutral',
    },
    {
      icon: 'group',
      title: 'Employees',
      subtitle: 'Employee mappings and org-node assignments are applied after org definition is created.',
      actionLabel: 'Open Employees',
      screen: '/admin/users',
      tone: 'neutral',
    },
  ] as const;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Organisation Structure</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Define the organization hierarchy first on web. After that, downstream settings like entity master data,
            employees, tasks, and reporting use that definition across web and mobile.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Org Definition</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
              {rootDefined ? 'Defined' : 'Pending'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Levels</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalLevels || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Nodes</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalNodes || 0}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Archived</p>
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{summary?.archivedNodes || 0}</p>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 dark:border-primary/30 dark:bg-primary/10">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-primary">info</span>
            <div className="space-y-1 text-sm text-text-main">
              <p className="font-semibold text-gray-900 dark:text-white">Recommended workflow</p>
              <p>1. Open `Org Definition` on web and create the Group root plus hierarchy levels.</p>
              <p>2. Apply that structure to entity master data, employees, task units, and reporting.</p>
              <p>3. Mobile uses the defined structure operationally, but hierarchy authoring stays on web.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    card.tone === 'primary'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined">{card.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-gray-900 dark:text-white">{card.title}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{card.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(card.screen)}
                className={`mt-5 rounded-lg px-4 py-2.5 text-sm font-semibold ${
                  card.tone === 'primary'
                    ? 'bg-primary text-white hover:bg-primary-dark'
                    : 'border border-slate-300 text-text-main hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                {card.actionLabel}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

