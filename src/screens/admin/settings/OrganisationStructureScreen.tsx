import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useToast } from '../../../context/ToastContext';
import {
  createOrganizationStructureNode,
  deleteOrganizationStructureNode,
  OrganizationStructureFieldSchemaField,
  getOrganizationStructureTree,
  OrganizationStructureLevel,
  OrganizationStructureNode,
  OrganizationStructureStage,
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
  computeDraftStageOrder,
  NEW_LEVEL_SELECT_VALUE,
  normalizeEntityTypeSelection,
  stageColumnLabel,
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

function computeDraftStageOrderForChart(
  draft: InlineDraftState,
  nodes: OrganizationStructureNode[],
  rootNode: OrganizationStructureNode | null
): number {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const autoParentId = resolveAutoParentNodeId(draft.relation, draft.referenceNode, rootNode);
  const resolveParent = autoParentId ? nodeById.get(autoParentId) : null;
  return computeDraftStageOrder({
    relation: draft.relation,
    referenceNode: draft.referenceNode,
    resolveParentNode: resolveParent,
  });
}

function resolveAutoParentNodeId(
  relation: InlineDraftState['relation'],
  referenceNode: OrganizationStructureNode | undefined,
  rootNode: OrganizationStructureNode | null
): string | null {
  if (relation === 'child') {
    return referenceNode?.id ?? rootNode?.id ?? null;
  }
  if (relation === 'sibling') {
    return referenceNode?.parentNodeId ?? null;
  }
  return null;
}

/** Chart columns: only stages that have nodes, plus the column used by an open create draft. */
function getChartVisibleStages(
  stages: OrganizationStructureStage[],
  nodes: OrganizationStructureNode[],
  inlineDraft: InlineDraftState | null,
  rootNode: OrganizationStructureNode | null
): OrganizationStructureStage[] {
  const stageOrdersToShow = new Set<number>();

  if (nodes.some((node) => !node.parentNodeId) || inlineDraft?.relation === 'root') {
    stageOrdersToShow.add(1);
  }

  for (const node of nodes) {
    stageOrdersToShow.add(node.stageOrder ?? 1);
  }

  if (inlineDraft && inlineDraft.relation !== 'root') {
    const draftOrder = computeDraftStageOrderForChart(inlineDraft, nodes, rootNode);
    stageOrdersToShow.add(draftOrder);
  }

  const visible = stages
    .filter((stage) => stageOrdersToShow.has(stage.stageOrder))
    .sort((a, b) => a.stageOrder - b.stageOrder);

  const coveredOrders = new Set(visible.map((stage) => stage.stageOrder));
  for (const order of stageOrdersToShow) {
    if (!coveredOrders.has(order)) {
      visible.push({
        id: `pending-stage-${order}`,
        organizationId: stages[0]?.organizationId || '',
        stageOrder: order,
        stageLabel: stageColumnLabel(order),
        isActive: true,
        levelIds: [],
        levels: [],
      });
      coveredOrders.add(order);
    }
  }

  return visible.sort((a, b) => a.stageOrder - b.stageOrder);
}

function countDescendantNodes(
  nodeId: string,
  childrenByParentId: Map<string, OrganizationStructureNode[]>
): number {
  const children = childrenByParentId.get(nodeId) || [];
  return children.reduce(
    (sum, child) => sum + 1 + countDescendantNodes(child.id, childrenByParentId),
    0
  );
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

const invalidateStructureTreeQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries('organization-structure-tree');
  queryClient.invalidateQueries('organization-structure-tree-overview');
};

export const OrganizationStructureBuilderPanel: React.FC = () => {
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

  const stages: OrganizationStructureStage[] = treeQuery.data?.stages || [];
  const levels: OrganizationStructureLevel[] = treeQuery.data?.levels || [];
  const nodes: OrganizationStructureNode[] = treeQuery.data?.nodes || [];
  const rootNode: OrganizationStructureNode | null = treeQuery.data?.rootNode || null;
  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.stageOrder - b.stageOrder),
    [stages]
  );

  const chartVisibleStages = useMemo(
    () => getChartVisibleStages(orderedStages, nodes, inlineDraft, rootNode),
    [orderedStages, nodes, inlineDraft, rootNode]
  );

  const levelByNumber = useMemo(() => new Map(levels.map((level) => [level.levelNumber, level])), [levels]);
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

  const chartColumnCount = useMemo(
    () => Math.max(1, chartVisibleStages.length),
    [chartVisibleStages.length]
  );

  const createNodeMutation = useMutation(createOrganizationStructureNode, {
    onSuccess: () => {
      invalidateStructureTreeQueries(queryClient);
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
        invalidateStructureTreeQueries(queryClient);
        setNodeModalState(null);
        toast.success('Hierarchy node updated successfully');
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.error || error?.message || 'Failed to update hierarchy node');
      },
    }
  );

  const deleteNodeMutation = useMutation(deleteOrganizationStructureNode, {
    onSuccess: (response: { message?: string; deletedCount?: number }) => {
      invalidateStructureTreeQueries(queryClient);
      setNodeModalState(null);
      setInlineDraft(null);
      setSelectedPathByLevel({});
      toast.success(
        response?.message ||
          (response?.deletedCount && response.deletedCount > 1
            ? `Deleted ${response.deletedCount} hierarchy nodes`
            : 'Hierarchy node deleted successfully')
      );
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to delete hierarchy node');
    },
  });

  const openNodeModal = (node: OrganizationStructureNode, panelMode: NodeModalPanelMode) => {
    setNodeModalState({ node, panelMode });
  };

  const closeNodeModal = () => {
    setNodeModalState(null);
  };

  const openInlineDraft = (relation: 'root' | 'child' | 'sibling', referenceNode?: OrganizationStructureNode) => {
    const suggestLevelId =
      relation !== 'root' && referenceNode?.levelId ? referenceNode.levelId : '';
    const suggestedEntity = referenceNode ? normalizeEntityTypeSelection(getNodeEntityType(referenceNode)) : null;

    setInlineDraft({
      relation,
      referenceNode,
      selectedLevelId: relation === 'root' ? '' : suggestLevelId,
      newSectionTemplate: '',
      selectedEntityType: suggestedEntity?.selectedEntityType || '',
      customEntityType: suggestedEntity?.customEntityType || '',
      definitionSource: 'preset',
      presetKey: referenceNode?.levelKey || null,
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

    const isNewLevel = inlineDraft.selectedLevelId === NEW_LEVEL_SELECT_VALUE;
    const selectedLevel =
      !isNewLevel && inlineDraft.selectedLevelId
        ? levels.find((level) => level.id === inlineDraft.selectedLevelId)
        : undefined;
    const newSectionLabel = inlineDraft.newSectionTemplate.trim();

    if (!selectedLevel && !isNewLevel) {
      toast.error('Select a level (section) for this node');
      return;
    }
    if (isNewLevel && !newSectionLabel) {
      toast.error('Select a template for the new section');
      return;
    }

    const createLevelFieldSchema = CREATE_NODE_FIELD_SCHEMA.map((field) => ({ ...field }));
    const fieldSchemaError = validateFieldSchemaDraft(createLevelFieldSchema);
    if (isNewLevel && !selectedLevel && fieldSchemaError) {
      toast.error(fieldSchemaError);
      return;
    }

    const fieldValues = serializeFieldValues(createLevelFieldSchema, inlineDraft.fieldValues);

    await createNodeMutation.mutateAsync({
      relation: inlineDraft.relation,
      referenceNodeId: inlineDraft.referenceNode?.id,
      targetLevelId: selectedLevel?.id,
      targetSectionLabel: isNewLevel ? newSectionLabel : undefined,
      entityField: fieldLabel,
      createLevelLabel: isNewLevel ? newSectionLabel : undefined,
      createLevelDefinitionSource: isNewLevel ? inlineDraft.definitionSource : undefined,
      createLevelPresetKey: isNewLevel ? inlineDraft.presetKey : undefined,
      createLevelFieldSchema: isNewLevel && !selectedLevel ? createLevelFieldSchema : undefined,
      name: typeof fieldValues.name === 'string' ? String(fieldValues.name) : undefined,
      code: typeof fieldValues.code === 'string' ? String(fieldValues.code).toUpperCase() : undefined,
      description: inlineDraft.description.trim() || undefined,
      status: inlineDraft.status,
      metaJson: { entityType: fieldLabel },
      fieldValues,
    });

    setInlineDraft(null);
  };

  const schemaFieldsFromExtended = (fields: ExtendedFieldDef[]): OrganizationStructureFieldSchemaField[] =>
    fields.map(({ category: _category, readOnly: _readOnly, ...field }) => field);

  const handleDeleteNode = async (node: OrganizationStructureNode) => {
    const descendantCount = countDescendantNodes(node.id, childrenByParentId);
    const nodeLabel = node.name?.trim() || node.levelLabel || 'this node';
    const cascadeNote =
      descendantCount > 0
        ? ` This will also delete ${descendantCount} descendant node${descendantCount === 1 ? '' : 's'}.`
        : '';
    const confirmed = window.confirm(
      `Delete "${nodeLabel}" from the organization structure?${cascadeNote} This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    await deleteNodeMutation.mutateAsync(node.id);
  };

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

  const draftStageMeta = useMemo(() => {
    if (!inlineDraft) {
      return { order: 1, hint: '' };
    }
    const autoParentId = resolveAutoParentNodeId(
      inlineDraft.relation,
      inlineDraft.referenceNode,
      rootNode
    );
    const parent = autoParentId ? nodeById.get(autoParentId) : null;
    const order = computeDraftStageOrder({
      relation: inlineDraft.relation,
      referenceNode: inlineDraft.referenceNode,
      resolveParentNode: parent,
    });
    let hint = '';
    if (inlineDraft.relation === 'child') {
      hint = parent
        ? `Child of ${parent.name || parent.levelLabel || 'parent'} → ${stageColumnLabel(order)}`
        : 'Child link';
    } else if (inlineDraft.relation === 'sibling') {
      const ref = inlineDraft.referenceNode;
      hint = ref
        ? `Sibling of ${ref.name || ref.levelLabel} (same parent) → ${stageColumnLabel(order)}`
        : 'Sibling link';
    }
    return { order, hint };
  }, [inlineDraft, nodeById, rootNode]);


  return (
    <>
      <div className="w-full px-2 py-3 pb-4 sm:px-3 md:px-4 md:py-4">
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Stages are ordered columns (Root, Stage 2, …). Add, view, and edit nodes from each card; use the toolbar to delete the selected node.
        </p>
        {treeQuery.isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Loading hierarchy…
          </div>
        ) : (
          <>
            {!rootNode && !inlineDraft ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center dark:border-slate-600">
                <p className="text-sm text-slate-600 dark:text-slate-400">No organization structure yet.</p>
                <button
                  type="button"
                  onClick={() => openInlineDraft('root')}
                  className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark"
                >
                  Create root
                </button>
              </div>
            ) : null}

            {rootNode ? (
              <>
                <div className="mb-2 flex flex-wrap justify-end gap-1.5">
                  <button
                    type="button"
                    title="Delete selected node (and descendants)"
                    onClick={() => selectedNode && handleDeleteNode(selectedNode)}
                    disabled={!selectedNode || deleteNodeMutation.isLoading}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <span className="material-symbols-outlined text-[22px]">delete</span>
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
                  stages={chartVisibleStages}
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
                  onOpenNodeView={(node) => openNodeModal(node, 'view')}
                  onOpenNodeEdit={(node) => openNodeModal(node, 'edit')}
                  inlineDraft={null}
                  chartInlineDraft={() => null}
                  orderedLevels={orderedLevels}
                  columnCount={chartColumnCount}
                />
              </>
            ) : null}
          </>
        )}
      </div>

      {inlineDraft ? (
        <OrganizationStructureInlineDraftForm
          asModal
          inlineDraft={inlineDraft}
          computedStageOrder={draftStageMeta.order}
          computedStageHint={draftStageMeta.hint}
          allLevels={levels}
          slugifyFieldKey={slugifyFieldKey}
          onClose={closeInlineDraft}
          onSubmit={handleInlineDraftSubmit}
          setInlineDraft={setInlineDraft}
          updateInlineDraftFieldValue={updateInlineDraftFieldValue}
        />
      ) : null}

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
          descendantCount={countDescendantNodes(nodeModalState.node.id, childrenByParentId)}
          getNodeEntityType={getNodeEntityType}
          getNodeFieldValues={getNodeFieldValues}
          onClose={closeNodeModal}
          onSubmit={handleEditNodeSubmit}
          onDelete={() => handleDeleteNode(nodeModalState.node)}
          isSaving={updateNodeMutation.isLoading}
          isDeleting={deleteNodeMutation.isLoading}
        />
      ) : null}
    </>
  );
};

export const OrganisationDefinitionScreen: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/admin/settings/organisation-structure#org-builder', { replace: true });
  }, [navigate]);

  return null;
};

export const OrganisationStructureScreen: React.FC = () => {
  useEffect(() => {
    if (window.location.hash === '#org-builder') {
      document.getElementById('org-builder')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-6xl p-6 pb-24 md:p-8 md:pb-20">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Organisation Structure</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Create and manage your organisation hierarchy in the builder below.
          </p>
        </div>

        <section
          id="org-builder"
          className="scroll-mt-6 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hierarchy builder</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Stages are chart columns only. Each node uses its own level, entity field, and name — fully dynamic.
            </p>
          </div>
          <OrganizationStructureBuilderPanel />
        </section>
      </div>
    </AdminLayout>
  );
};

