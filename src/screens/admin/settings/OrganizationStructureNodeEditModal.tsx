import { useMemo, useState } from 'react';
import {
  OrganizationStructureFieldSchemaField,
  OrganizationStructureNode,
} from '../../../services/settingsService';
import {
  getEntityTypeOptionsForLevelRecord,
  normalizeEntityTypeSelection,
  stageColumnLabel,
} from './organizationStructureEntityTypes';
import {
  buildEditFieldList,
  groupFieldsByCategory,
  parseCustomFieldSchemaFromMeta,
  type ExtendedFieldDef,
} from './organizationStructureExtendedFieldCatalog';

export type NodeEditFormState = {
  description: string;
  status: 'active' | 'inactive' | 'archived';
  selectedEntityType: string;
  customEntityType: string;
  fieldValues: Record<string, string>;
  customFieldSchema: OrganizationStructureFieldSchemaField[];
};

export type NodeModalPanelMode = 'view' | 'edit';

type Props = {
  node: OrganizationStructureNode;
  initialMode: NodeModalPanelMode;
  parentName?: string | null;
  descendantCount?: number;
  getNodeEntityType: (node?: OrganizationStructureNode | null) => string;
  getNodeFieldValues: (node?: OrganizationStructureNode | null) => Record<string, unknown>;
  onClose: () => void;
  onSubmit: (form: NodeEditFormState) => void;
  onDelete?: () => void;
  isSaving: boolean;
  isDeleting?: boolean;
};

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

function toFieldValues(
  fields: ExtendedFieldDef[],
  source: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const raw = source[field.key];
    out[field.key] = raw === undefined || raw === null ? '' : String(raw);
  }
  return out;
}

function displayValue(value: string): string {
  const trimmed = value.trim();
  return trimmed || '\u2014';
}

function FieldRow({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: OrganizationStructureFieldSchemaField;
  value: string;
  readOnly: boolean;
  onChange?: (value: string) => void;
}) {
  const label = (
    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
      {field.label}
      {!readOnly && field.required ? <span className="text-red-500"> *</span> : null}
    </label>
  );

  if (readOnly) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{field.label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">
          {displayValue(value)}
        </p>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {label}
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder={field.placeholder || undefined}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {label}
        <select value={value} onChange={(e) => onChange?.(e.target.value)} className={inputClass}>
          <option value=""></option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) =>
          onChange?.(
            field.key === 'code' || field.key === 'pan' ? e.target.value.toUpperCase() : e.target.value
          )
        }
        className={field.key === 'code' ? `${inputClass} font-mono` : inputClass}
        placeholder={field.placeholder || undefined}
      />
    </div>
  );
}

export function OrganizationStructureNodeEditModal({
  node,
  initialMode,
  parentName,
  descendantCount = 0,
  getNodeEntityType,
  getNodeFieldValues,
  onClose,
  onSubmit,
  onDelete,
  isSaving,
  isDeleting = false,
}: Props) {
  const [panelMode, setPanelMode] = useState<NodeModalPanelMode>(initialMode);
  const readOnly = panelMode === 'view';

  const entityNorm = normalizeEntityTypeSelection(getNodeEntityType(node), node.levelLabel);
  const initialCustom = parseCustomFieldSchemaFromMeta(node.metaJson as Record<string, unknown>);
  const editFields = useMemo(() => buildEditFieldList(initialCustom), [initialCustom]);
  const fvSource = getNodeFieldValues(node);

  const [form, setForm] = useState<NodeEditFormState>(() => ({
    description: node.description || '',
    status: node.status,
    selectedEntityType: entityNorm.selectedEntityType,
    customEntityType: entityNorm.customEntityType,
    fieldValues: toFieldValues(editFields, fvSource),
    customFieldSchema: initialCustom,
  }));

  const fieldsForRender = useMemo(
    () => buildEditFieldList(form.customFieldSchema),
    [form.customFieldSchema]
  );
  const grouped = useMemo(() => groupFieldsByCategory(fieldsForRender), [fieldsForRender]);

  const entityTypeLabel =
    form.selectedEntityType === 'Custom'
      ? form.customEntityType.trim() || 'Custom'
      : form.selectedEntityType.trim() || node.entityField || node.levelLabel;

  const entityTypeOptions = getEntityTypeOptionsForLevelRecord({
    levelNumber: node.levelNumber,
    levelLabel: node.levelLabel,
  });

  const stageLabel =
    node.stageOrder != null ? stageColumnLabel(node.stageOrder) : node.stageLabel || '—';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="shrink-0 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {readOnly ? 'Node details' : 'Edit node'}
                </h2>
                <div
                  className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold dark:border-slate-600"
                  role="tablist"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={readOnly}
                    onClick={() => setPanelMode('view')}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      readOnly
                        ? 'bg-primary text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!readOnly}
                    onClick={() => setPanelMode('edit')}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      !readOnly
                        ? 'bg-primary text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    Edit
                  </button>
                </div>
              </div>
              <p className="mt-2 truncate text-base font-semibold text-slate-800 dark:text-slate-100">
                {node.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Column</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">{stageLabel}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Section</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">{node.levelLabel}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Field</dt>
              <dd className="mt-0.5 truncate font-medium text-slate-900 dark:text-white">{entityTypeLabel}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-slate-900/50">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</dt>
              <dd className="mt-0.5 capitalize font-medium text-slate-900 dark:text-white">{node.status}</dd>
            </div>
          </dl>
          {parentName ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Parent: <span className="font-medium text-slate-700 dark:text-slate-300">{parentName}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Root node (no parent)</p>
          )}
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!readOnly) {
              onSubmit(form);
            }
          }}
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
            {!readOnly ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Entity field</label>
                  <select
                    value={form.selectedEntityType}
                    onChange={(e) => setForm((p) => ({ ...p, selectedEntityType: e.target.value }))}
                    className={inputClass}
                  >
                    <option value=""></option>
                    {entityTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                {form.selectedEntityType === 'Custom' ? (
                  <div>
                    <label className={labelClass}>Custom field</label>
                    <input
                      type="text"
                      value={form.customEntityType}
                      onChange={(e) => setForm((p) => ({ ...p, customEntityType: e.target.value }))}
                      className={inputClass}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {Array.from(grouped.entries()).map(([category, fields]) => (
              <section key={category}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">{category}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <FieldRow
                      key={field.id || field.key}
                      field={field}
                      value={form.fieldValues[field.key] ?? ''}
                      readOnly={readOnly}
                      onChange={readOnly ? undefined : (v) =>
                        setForm((p) => ({
                          ...p,
                          fieldValues: { ...p.fieldValues, [field.key]: v },
                        }))
                      }
                    />
                  ))}
                </div>
              </section>
            ))}

            {!readOnly && form.customFieldSchema.length > 0 ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-primary">Custom fields</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const id = `custom_${Date.now()}`;
                      const key = `custom_${form.customFieldSchema.length + 1}`;
                      setForm((p) => ({
                        ...p,
                        customFieldSchema: [
                          ...p.customFieldSchema,
                          { id, key, label: 'Custom field', type: 'text', required: false },
                        ],
                        fieldValues: { ...p.fieldValues, [key]: '' },
                      }));
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Add field
                  </button>
                </div>
                <div className="space-y-2">
                  {form.customFieldSchema.map((def, index) => (
                    <div
                      key={def.id}
                      className="rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-600"
                    >
                      <div className="mb-2 grid gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={def.label}
                          onChange={(e) => {
                            const next = [...form.customFieldSchema];
                            const current = next[index];
                            if (!current) return;
                            next[index] = { ...current, label: e.target.value };
                            setForm((p) => ({ ...p, customFieldSchema: next }));
                          }}
                          placeholder="Label"
                          className={inputClass}
                        />
                        <select
                          value={def.type}
                          onChange={(e) => {
                            const next = [...form.customFieldSchema];
                            const current = next[index];
                            if (!current) return;
                            next[index] = {
                              ...current,
                              type: e.target.value as OrganizationStructureFieldSchemaField['type'],
                            };
                            setForm((p) => ({ ...p, customFieldSchema: next }));
                          }}
                          className={inputClass}
                        >
                          <option value="text">Text</option>
                          <option value="textarea">Long text</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="select">Dropdown</option>
                        </select>
                      </div>
                      <FieldRow
                        field={def}
                        value={form.fieldValues[def.key] ?? ''}
                        readOnly={false}
                        onChange={(v) =>
                          setForm((p) => ({
                            ...p,
                            fieldValues: { ...p.fieldValues, [def.key]: v },
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const removed = form.customFieldSchema[index];
                          const nextSchema = form.customFieldSchema.filter((_, i) => i !== index);
                          const nextFv = { ...form.fieldValues };
                          if (removed?.key) delete nextFv[removed.key];
                          setForm((p) => ({ ...p, customFieldSchema: nextSchema, fieldValues: nextFv }));
                        }}
                        className="mt-2 text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div>
              <label className={labelClass}>Notes</label>
              {readOnly ? (
                <p className="text-sm text-slate-900 whitespace-pre-wrap dark:text-slate-100">
                  {displayValue(form.description)}
                </p>
              ) : (
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className={inputClass}
                  placeholder="Optional operational notes"
                />
              )}
            </div>

            {!readOnly ? (
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as NodeEditFormState['status'],
                    }))
                  }
                  className={inputClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
            {onDelete && descendantCount > 0 ? (
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
                Deleting removes {descendantCount} descendant{descendantCount === 1 ? '' : 's'} as well.
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              {onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isSaving || isDeleting}
                  className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-600"
                >
                  Close
                </button>
                {readOnly ? (
                  <button
                    type="button"
                    onClick={() => setPanelMode('edit')}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
                  >
                    Edit
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSaving || isDeleting}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
                  >
                    {isSaving ? 'Saving…' : 'Save changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
