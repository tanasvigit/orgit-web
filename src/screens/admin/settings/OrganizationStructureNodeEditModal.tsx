import { useMemo, useState } from 'react';
import {
  OrganizationStructureFieldSchemaField,
  OrganizationStructureNode,
} from '../../../services/settingsService';
import { getEntityTypeOptionsForLevel, normalizeEntityTypeSelection } from './organizationStructureEntityTypes';
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
  getNodeEntityType: (node?: OrganizationStructureNode | null) => string;
  getNodeFieldValues: (node?: OrganizationStructureNode | null) => Record<string, unknown>;
  onClose: () => void;
  onSubmit: (form: NodeEditFormState) => void;
  isSaving: boolean;
};

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
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{field.label}</p>
        <p className="mt-0.5 text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">
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
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          placeholder={field.placeholder || undefined}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {label}
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
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
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        placeholder={field.placeholder || undefined}
      />
    </div>
  );
}

export function OrganizationStructureNodeEditModal({
  node,
  initialMode,
  parentName,
  getNodeEntityType,
  getNodeFieldValues,
  onClose,
  onSubmit,
  isSaving,
}: Props) {
  const [panelMode, setPanelMode] = useState<NodeModalPanelMode>(initialMode);
  const readOnly = panelMode === 'view';

  const entityNorm = normalizeEntityTypeSelection(getNodeEntityType(node), node.levelNumber);
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
      : form.selectedEntityType.trim() || ' ';

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      fieldValues: { ...prev.fieldValues, [key]: value },
    }));
  };

  const addCustomField = () => {
    const id = `custom_${Date.now()}`;
    const key = `custom_${form.customFieldSchema.length + 1}`;
    setForm((prev) => ({
      ...prev,
      customFieldSchema: [
        ...prev.customFieldSchema,
        { id, key, label: 'Custom field', type: 'text', required: false },
      ],
      fieldValues: { ...prev.fieldValues, [key]: '' },
    }));
  };

  const updateCustomFieldDef = (index: number, updates: Partial<OrganizationStructureFieldSchemaField>) => {
    setForm((prev) => {
      const next = [...prev.customFieldSchema];
      const current = next[index];
      if (!current) return prev;
      const merged = { ...current, ...updates };
      if (updates.label && !updates.key) {
        const slug = updates.label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        if (slug && slug !== current.key) {
          const nextFv = { ...prev.fieldValues };
          if (Object.prototype.hasOwnProperty.call(nextFv, current.key)) {
            nextFv[slug] = nextFv[current.key];
            delete nextFv[current.key];
          }
          merged.key = slug;
        }
      }
      next[index] = merged;
      return { ...prev, customFieldSchema: next };
    });
  };

  const removeCustomField = (index: number) => {
    setForm((prev) => {
      const removed = prev.customFieldSchema[index];
      const nextSchema = prev.customFieldSchema.filter((_, i) => i !== index);
      const nextFv = { ...prev.fieldValues };
      if (removed?.key) delete nextFv[removed.key];
      return { ...prev, customFieldSchema: nextSchema, fieldValues: nextFv };
    });
  };

  const entityTypeOptions = getEntityTypeOptionsForLevel(node.levelNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {readOnly ? 'View' : 'Edit'} {node.levelLabel}
              </h3>
              <div
                className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold dark:border-slate-600"
                role="tablist"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={readOnly}
                  onClick={() => setPanelMode('view')}
                  className={`rounded-md px-3 py-1.5 transition-colors ${
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
                  className={`rounded-md px-3 py-1.5 transition-colors ${
                    !readOnly
                      ? 'bg-primary text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Edit
                </button>
              </div>
            </div>
            <p className="mt-1 truncate text-sm text-slate-500">{node.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
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
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Section type</label>
                {readOnly ? (
                  <p className="text-sm text-slate-900 dark:text-slate-100">{entityTypeLabel}</p>
                ) : (
                  <select
                    value={form.selectedEntityType}
                    onChange={(e) => setForm((p) => ({ ...p, selectedEntityType: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value=""></option>
                    {entityTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {!readOnly && form.selectedEntityType === 'Custom' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">Custom type</label>
                  <input
                    type="text"
                    value={form.customEntityType}
                    onChange={(e) => setForm((p) => ({ ...p, customEntityType: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
              ) : null}
              {readOnly && form.selectedEntityType === 'Custom' && form.customEntityType.trim() ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Custom type</p>
                  <p className="mt-0.5 text-sm text-slate-900 dark:text-slate-100">{form.customEntityType.trim()}</p>
                </div>
              ) : null}
              {parentName ? (
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-500">Parent org unit</label>
                  <p className="text-sm text-slate-900 dark:text-slate-100">{parentName}</p>
                </div>
              ) : null}
            </div>

            {Array.from(grouped.entries()).map(([category, fields]) => (
              <section key={category}>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-primary">{category}</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <FieldRow
                      key={field.id || field.key}
                      field={field}
                      value={form.fieldValues[field.key] ?? ''}
                      readOnly={readOnly}
                      onChange={readOnly ? undefined : (v) => updateField(field.key, v)}
                    />
                  ))}
                </div>
              </section>
            ))}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Custom fields</h4>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    + Add custom field
                  </button>
                ) : null}
              </div>
              {form.customFieldSchema.length === 0 ? (
                <p className="text-sm text-slate-500">No custom fields.</p>
              ) : readOnly ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {form.customFieldSchema.map((def) => (
                    <FieldRow
                      key={def.id}
                      field={def}
                      value={form.fieldValues[def.key] ?? ''}
                      readOnly
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {form.customFieldSchema.map((def, index) => (
                    <div
                      key={def.id}
                      className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-600"
                    >
                      <div className="mb-2 grid gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          value={def.label}
                          onChange={(e) => updateCustomFieldDef(index, { label: e.target.value })}
                          placeholder="Field label"
                          className="rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                        />
                        <select
                          value={def.type}
                          onChange={(e) =>
                            updateCustomFieldDef(index, {
                              type: e.target.value as OrganizationStructureFieldSchemaField['type'],
                            })
                          }
                          className="rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
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
                        onChange={(v) => updateField(def.key, v)}
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomField(index)}
                        className="mt-2 text-xs text-red-600 hover:underline"
                      >
                        Remove field
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div>
              <label className="mb-1 block text-sm font-medium">Operational notes</label>
              {readOnly ? (
                <p className="text-sm text-slate-900 whitespace-pre-wrap dark:text-slate-100">
                  {displayValue(form.description)}
                </p>
              ) : (
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Node status</label>
              {readOnly ? (
                <p className="text-sm capitalize text-slate-900 dark:text-slate-100">{form.status}</p>
              ) : (
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as NodeEditFormState['status'],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              )}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
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
                disabled={isSaving}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {isSaving ? 'Savingâ€¦' : 'Save changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}


