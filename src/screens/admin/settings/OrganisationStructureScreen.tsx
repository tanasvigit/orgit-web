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
  getEntityTypeOptionsForLevel,
  normalizeEntityTypeSelection,
} from './organizationStructureEntityTypes';

type NodeModalState =
  | {
      mode: 'create';
      relation: 'root' | 'child' | 'sibling';
      referenceNode?: OrganizationStructureNode;
    }
  | {
      mode: 'edit';
      node: OrganizationStructureNode;
    }
  | null;

type NodeFormState = {
  description: string;
  status: 'active' | 'inactive' | 'archived';
  fieldSchema: OrganizationStructureFieldSchemaField[];
  fieldValues: Record<string, string>;
};

const emptyNodeForm: NodeFormState = {
  description: '',
  status: 'active',
  fieldSchema: [],
  fieldValues: {},
};

const DEFAULT_LEVEL_FIELDS: OrganizationStructureFieldSchemaField[] = [
  {
    id: 'name',
    key: 'name',
    label: 'Name',
    type: 'text',
    required: true,
  },
  {
    id: 'code',
    key: 'code',
    label: 'Code',
    type: 'text',
    required: false,
  },
];

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

const getDraftEntityLabel = (draft: Pick<InlineDraftState, 'selectedEntityType' | 'customEntityType'>) => {
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

const getDefaultLevelFields = (): OrganizationStructureFieldSchemaField[] => DEFAULT_LEVEL_FIELDS.map((field) => ({ ...field }));

const getEffectiveFieldSchema = (level?: OrganizationStructureLevel | null): OrganizationStructureFieldSchemaField[] => {
  if (!level?.fieldSchemaJson || level.fieldSchemaJson.length === 0) {
    return getDefaultLevelFields();
  }

  return level.fieldSchemaJson.map((field) => ({
    ...field,
    options: Array.isArray(field.options) ? [...field.options] : undefined,
  }));
};

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

const createBlankFieldDefinition = (): OrganizationStructureFieldSchemaField => ({
  id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  key: '',
  label: '',
  type: 'text',
  required: false,
  options: undefined,
  placeholder: null,
});

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
  const [nodeForm, setNodeForm] = useState<NodeFormState>(emptyNodeForm);
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

  const maxLevelNumber = useMemo(() => {
    const fromLevels = levels.map((l) => l.levelNumber);
    const fromNodes = nodes.map((n) => n.levelNumber);
    return Math.max(1, ...fromLevels, ...fromNodes, 0);
  }, [levels, nodes]);

  const createNodeMutation = useMutation(createOrganizationStructureNode, {
    onSuccess: () => {
      queryClient.invalidateQueries('organization-structure-tree');
      setNodeModalState(null);
      setNodeForm(emptyNodeForm);
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
        setNodeForm(emptyNodeForm);
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

  const openEditModal = (node: OrganizationStructureNode) => {
    setNodeModalState({ mode: 'edit', node });
    const levelSchema = getEffectiveFieldSchema(levelByNumber.get(node.levelNumber));
    setNodeForm({
      description: node.description || '',
      status: node.status,
      fieldSchema: levelSchema,
      fieldValues: createEmptyFieldValues(levelSchema, getNodeFieldValues(node)),
    });
  };

  const closeNodeModal = () => {
    setNodeModalState(null);
    setNodeForm(emptyNodeForm);
  };

  const openInlineDraft = (relation: 'root' | 'child' | 'sibling', referenceNode?: OrganizationStructureNode) => {
    const targetLevelNumber =
      relation === 'root' ? 1 : relation === 'child' ? (referenceNode?.levelNumber || 0) + 1 : referenceNode?.levelNumber || 1;
    const existingLevel = levelByNumber.get(targetLevelNumber);

    const defaultEntityType =
      relation === 'root'
        ? existingLevel?.levelLabel || ''
        : relation === 'child'
        ? existingLevel?.levelLabel || ''
        : getNodeEntityType(referenceNode);
    const normalizedType = normalizeEntityTypeSelection(defaultEntityType, targetLevelNumber);
    const fieldSchema = getEffectiveFieldSchema(existingLevel);

    setInlineDraft({
      relation,
      referenceNode,
      targetLevelNumber,
      selectedEntityType: normalizedType.selectedEntityType,
      customEntityType: normalizedType.customEntityType,
      definitionSource: existingLevel?.definitionSource || (normalizedType.selectedEntityType && normalizedType.selectedEntityType !== 'Custom' ? 'preset' : 'custom'),
      presetKey: existingLevel?.presetKey || (normalizedType.selectedEntityType && normalizedType.selectedEntityType !== 'Custom' ? slugifyFieldKey(normalizedType.selectedEntityType) : null),
      fieldSchema,
      fieldValues: createEmptyFieldValues(fieldSchema),
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

  const updateNodeFormFieldValue = (fieldKey: string, value: string) => {
    setNodeForm((prev) => ({
      ...prev,
      fieldValues: {
        ...prev.fieldValues,
        [fieldKey]: value,
      },
    }));
  };

  const updateInlineDraftSchemaField = (
    index: number,
    updates: Partial<OrganizationStructureFieldSchemaField>
  ) => {
    setInlineDraft((prev) => {
      if (!prev) {
        return prev;
      }

      let nextFieldValues: Record<string, string> | undefined;
      const nextSchema = prev.fieldSchema.map((field, currentIndex) => {
        if (currentIndex !== index) {
          return field;
        }

        const merged = { ...field, ...updates };
        const nextLabel = merged.label;

        let normalizedKey: string;
        if (field.key === 'name') {
          normalizedKey = 'name';
        } else {
          const fromLabel = slugifyFieldKey(nextLabel);
          normalizedKey = fromLabel || field.key || '';
        }

        if (field.key && field.key !== 'name' && normalizedKey && field.key !== normalizedKey) {
          nextFieldValues = nextFieldValues ?? { ...prev.fieldValues };
          if (Object.prototype.hasOwnProperty.call(nextFieldValues, field.key)) {
            nextFieldValues[normalizedKey] = nextFieldValues[field.key];
            delete nextFieldValues[field.key];
          }
        }

        return {
          ...merged,
          label: nextLabel,
          key: normalizedKey,
        };
      });

      return {
        ...prev,
        fieldSchema: nextSchema,
        ...(nextFieldValues ? { fieldValues: nextFieldValues } : {}),
      };
    });
  };

  const addInlineDraftSchemaField = () => {
    setInlineDraft((prev) =>
      prev
        ? {
            ...prev,
            fieldSchema: [...prev.fieldSchema, createBlankFieldDefinition()],
          }
        : prev
    );
  };

  const removeInlineDraftSchemaField = (index: number) => {
    setInlineDraft((prev) => {
      if (!prev) {
        return prev;
      }

      const fieldToRemove = prev.fieldSchema[index];
      const nextSchema = prev.fieldSchema.filter((_, currentIndex) => currentIndex !== index);
      const nextFieldValues = { ...prev.fieldValues };
      if (fieldToRemove?.key) {
        delete nextFieldValues[fieldToRemove.key];
      }

      return {
        ...prev,
        fieldSchema: nextSchema,
        fieldValues: nextFieldValues,
      };
    });
  };

  const handleSelectNode = (node: OrganizationStructureNode) => {
    setSelectedPathByLevel(buildSelectedPathState(node));
  };

  const handleInlineDraftSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inlineDraft) {
      return;
    }

    const entityLabel = getDraftEntityLabel(inlineDraft);
    if (!entityLabel) {
      toast.error('Select or define the entity section type');
      return;
    }

    const existingLevel = levelByNumber.get(inlineDraft.targetLevelNumber);
    const normalizedFieldSchema = inlineDraft.fieldSchema.map((field) => {
      const normalizedKey = slugifyFieldKey(field.key || field.label);
      return {
        ...field,
        id: field.id || normalizedKey,
        key: normalizedKey,
        label: field.label.trim(),
        options:
          field.type === 'select' && field.options
            ? field.options.map((option) => option.trim()).filter((option) => !!option)
            : undefined,
      };
    });
    const fieldSchemaError = validateFieldSchemaDraft(normalizedFieldSchema);
    if (!existingLevel && fieldSchemaError) {
      toast.error(fieldSchemaError);
      return;
    }

    const fieldValues = serializeFieldValues(normalizedFieldSchema, inlineDraft.fieldValues);

    await createNodeMutation.mutateAsync({
      relation: inlineDraft.relation,
      referenceNodeId: inlineDraft.referenceNode?.id,
      name: typeof fieldValues.name === 'string' ? String(fieldValues.name) : undefined,
      code: typeof fieldValues.code === 'string' ? String(fieldValues.code).toUpperCase() : undefined,
      description: inlineDraft.description.trim() || undefined,
      status: inlineDraft.status,
      createLevelLabel: existingLevel ? undefined : entityLabel,
      createLevelDefinitionSource: existingLevel ? undefined : inlineDraft.definitionSource,
      createLevelPresetKey: existingLevel ? undefined : inlineDraft.presetKey,
      createLevelFieldSchema: existingLevel ? undefined : normalizedFieldSchema,
      fieldValues,
    });

    setInlineDraft(null);
  };

  const handleSubmitNode = async (event: React.FormEvent) => {
    event.preventDefault();
    const serializedFieldValues = serializeFieldValues(nodeForm.fieldSchema, nodeForm.fieldValues);

    if (nodeModalState?.mode === 'create') {
      await createNodeMutation.mutateAsync({
        relation: nodeModalState.relation,
        referenceNodeId: nodeModalState.referenceNode?.id,
        name: typeof serializedFieldValues.name === 'string' ? String(serializedFieldValues.name) : undefined,
        code: typeof serializedFieldValues.code === 'string' ? String(serializedFieldValues.code).toUpperCase() : undefined,
        description: nodeForm.description,
        status: nodeForm.status,
        fieldValues: serializedFieldValues,
      });
      return;
    }

    if (nodeModalState?.mode === 'edit') {
      await updateNodeMutation.mutateAsync({
        id: nodeModalState.node.id,
        data: {
          name: typeof serializedFieldValues.name === 'string' ? String(serializedFieldValues.name) : undefined,
          code: typeof serializedFieldValues.code === 'string' ? String(serializedFieldValues.code).toUpperCase() : undefined,
          description: nodeForm.description,
          status: nodeForm.status,
          fieldValues: serializedFieldValues,
        },
      });
    }
  };

  const handleArchiveNode = (node: OrganizationStructureNode) => {
    if (window.confirm(`Archive "${node.name}"? Archived nodes stay visible to admins but are hidden from operations.`)) {
      archiveNodeMutation.mutate(node.id);
    }
  };

  function renderInlineDraftForm(indentPx: number): React.ReactNode {
    if (!inlineDraft) return null;
    return (
      <OrganizationStructureInlineDraftForm
        indentPx={indentPx}
        inlineDraft={inlineDraft}
        draftLevelNumber={inlineDraft.targetLevelNumber}
        existingLevel={levelByNumber.get(inlineDraft.targetLevelNumber)}
        draftEntityLabel={getDraftEntityLabel(inlineDraft)}
        entityTypeOptions={getEntityTypeOptionsForLevel(inlineDraft.targetLevelNumber)}
        slugifyFieldKey={slugifyFieldKey}
        onClose={closeInlineDraft}
        onSubmit={handleInlineDraftSubmit}
        setInlineDraft={setInlineDraft}
        addInlineDraftSchemaField={addInlineDraftSchemaField}
        removeInlineDraftSchemaField={removeInlineDraftSchemaField}
        updateInlineDraftSchemaField={updateInlineDraftSchemaField}
        updateInlineDraftFieldValue={updateInlineDraftFieldValue}
      />
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-none px-2 py-3 pb-6 sm:px-3 md:px-4 md:py-4">
        {treeQuery.isLoading ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
            Loading hierarchy…
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
                  Create root
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
                    title="Edit selected node (all fields)"
                    onClick={() => selectedNode && openEditModal(selectedNode)}
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
                  levelByNumber={levelByNumber}
                  levelThemePalette={levelThemePalette}
                  selectedNode={selectedNode}
                  onSelectNode={handleSelectNode}
                  getNodeEntityType={getNodeEntityType}
                  getEffectiveFieldSchema={getEffectiveFieldSchema}
                  getNodeFieldValues={getNodeFieldValues}
                  serializeFieldValues={serializeFieldValues}
                  openInlineDraft={openInlineDraft}
                  onArchiveNode={handleArchiveNode}
                  onOpenFullEdit={openEditModal}
                  onUpdateNode={(id, data) => updateNodeMutation.mutateAsync({ id, data })}
                  inlineDraft={inlineDraft}
                  chartInlineDraft={(_box) => renderInlineDraftForm(0)}
                  maxLevelNumber={maxLevelNumber}
                />
              </>
            ) : null}
          </>
        )}
      </div>

      {nodeModalState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {nodeModalState.mode === 'edit'
                    ? `Edit ${nodeModalState.node.levelLabel}`
                    : nodeModalState.relation === 'root'
                    ? 'Create Root Entity'
                    : nodeModalState.relation === 'child'
                    ? 'Add Child Node'
                    : 'Add Sibling'}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {nodeModalState.mode === 'edit'
                    ? nodeModalState.node.pathDisplay
                    : nodeModalState.referenceNode?.pathDisplay || 'Root hierarchy creation'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeNodeModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleSubmitNode}>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-main">Entity Section</label>
                <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-text-main dark:border-slate-600 dark:bg-slate-900">
                  {nodeModalState.mode === 'edit' ? nodeModalState.node.levelLabel : 'New section'}
                </div>
              </div>

              <div className="space-y-3">
                {nodeForm.fieldSchema.map((field) => (
                  <div key={field.id}>
                    <label className="mb-1 block text-sm font-medium text-text-main">
                      {field.label}
                      {field.required ? ' *' : ''}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={nodeForm.fieldValues[field.key] || ''}
                        onChange={(event) => updateNodeFormFieldValue(field.key, event.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-text-main dark:border-slate-600 dark:bg-slate-900"
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={nodeForm.fieldValues[field.key] || ''}
                        onChange={(event) => updateNodeFormFieldValue(field.key, event.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-text-main dark:border-slate-600 dark:bg-slate-900"
                      >
                        <option value="">Select {field.label}</option>
                        {(field.options || []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        value={nodeForm.fieldValues[field.key] || ''}
                        onChange={(event) =>
                          updateNodeFormFieldValue(
                            field.key,
                            field.key === 'code' ? event.target.value.toUpperCase() : event.target.value
                          )
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-text-main dark:border-slate-600 dark:bg-slate-900"
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-main">Description</label>
                <textarea
                  value={nodeForm.description}
                  onChange={(event) => setNodeForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-text-main dark:border-slate-600 dark:bg-slate-900"
                  placeholder="Optional description or operational notes"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-text-main">Status</label>
                <select
                  value={nodeForm.status}
                  onChange={(event) =>
                    setNodeForm((prev) => ({
                      ...prev,
                      status: event.target.value as NodeFormState['status'],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-text-main dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  {nodeModalState.mode === 'edit' ? <option value="archived">Archived</option> : null}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeNodeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-text-main hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createNodeMutation.isLoading || updateNodeMutation.isLoading}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
                >
                  {nodeModalState.mode === 'edit' ? 'Save Changes' : 'Create Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
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

