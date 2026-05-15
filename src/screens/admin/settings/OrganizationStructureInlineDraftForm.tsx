import React from 'react';
import {
  OrganizationStructureFieldSchemaField,
  OrganizationStructureLevel,
  OrganizationStructureNode,
} from '../../../services/settingsService';

export type InlineDraftState = {
  relation: 'root' | 'child' | 'sibling';
  referenceNode?: OrganizationStructureNode;
  targetLevelNumber: number;
  selectedEntityType: string;
  customEntityType: string;
  definitionSource: 'custom' | 'preset';
  presetKey?: string | null;
  fieldSchema: OrganizationStructureFieldSchemaField[];
  fieldValues: Record<string, string>;
  description: string;
  status: 'active' | 'inactive';
};

type Props = {
  indentPx: number;
  inlineDraft: InlineDraftState;
  draftLevelNumber: number;
  existingLevel: OrganizationStructureLevel | undefined;
  draftEntityLabel: string;
  entityTypeOptions: readonly string[];
  slugifyFieldKey: (value: string) => string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  setInlineDraft: React.Dispatch<React.SetStateAction<InlineDraftState | null>>;
  addInlineDraftSchemaField: () => void;
  removeInlineDraftSchemaField: (index: number) => void;
  updateInlineDraftSchemaField: (index: number, updates: Partial<OrganizationStructureFieldSchemaField>) => void;
  updateInlineDraftFieldValue: (fieldKey: string, value: string) => void;
};

export function OrganizationStructureInlineDraftForm({
  indentPx,
  inlineDraft,
  draftLevelNumber,
  existingLevel,
  draftEntityLabel,
  entityTypeOptions,
  slugifyFieldKey,
  onClose,
  onSubmit,
  setInlineDraft,
  addInlineDraftSchemaField,
  removeInlineDraftSchemaField,
  updateInlineDraftSchemaField,
  updateInlineDraftFieldValue,
}: Props) {
  return (
    <div className="mb-2 border-l-2 border-primary/50 pl-2" style={{ marginLeft: indentPx }}>
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-primary/30 bg-white p-2 shadow-sm ring-1 ring-primary/15 dark:border-primary/40 dark:bg-slate-800"
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <p className="text-xs font-semibold leading-tight text-gray-900 dark:text-white">
            {inlineDraft.relation === 'root'
              ? 'Create section 1'
              : inlineDraft.relation === 'sibling'
                ? 'New sibling'
                : 'New child'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Section</label>
            <select
              value={inlineDraft.selectedEntityType || ''}
              onChange={(event) =>
                setInlineDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        selectedEntityType: event.target.value,
                        definitionSource:
                          event.target.value && event.target.value !== 'Custom' ? 'preset' : 'custom',
                        presetKey:
                          event.target.value && event.target.value !== 'Custom'
                            ? slugifyFieldKey(event.target.value)
                            : null,
                      }
                    : prev
                )
              }
              disabled={Boolean(existingLevel)}
              className="mt-1 w-full bg-transparent text-xs font-semibold text-gray-900 outline-none dark:text-white"
            >
              <option value="">Select section type</option>
              {entityTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {inlineDraft.selectedEntityType === 'Custom' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
              <label className="text-[10px] uppercase tracking-wide text-gray-400">Custom</label>
              <input
                type="text"
                required
                value={inlineDraft.customEntityType}
                onChange={(event) =>
                  setInlineDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          customEntityType: event.target.value,
                          definitionSource: 'custom',
                          presetKey: null,
                        }
                      : prev
                  )
                }
                disabled={Boolean(existingLevel)}
                className="mt-1 w-full bg-transparent text-xs font-semibold text-gray-900 outline-none dark:text-white"
                placeholder={`Define entity section ${draftLevelNumber}`}
              />
            </div>
          ) : null}

          {!existingLevel ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="mb-2 flex items-center justify-between gap-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fields</p>
                <button
                  type="button"
                  onClick={addInlineDraftSchemaField}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add field
                </button>
              </div>

              <div className="space-y-2">
                {inlineDraft.fieldSchema.map((field, fieldIndex) => (
                  <div key={field.id} className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wide text-gray-400">Label</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={(event) =>
                            updateInlineDraftSchemaField(fieldIndex, { label: event.target.value })
                          }
                          className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-gray-900 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                          placeholder="Field label"
                        />
                      </div>
                      <label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) =>
                            updateInlineDraftSchemaField(fieldIndex, { required: event.target.checked })
                          }
                        />
                        Required
                      </label>
                    </div>

                    {field.key !== 'name' ? (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeInlineDraftSchemaField(fieldIndex)}
                          className="rounded-full border border-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-gray-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-400">
              This section already exists. Its field setup will be reused for this node.
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900/40">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Values</p>
            <div className="space-y-2">
              {inlineDraft.fieldSchema.map((field) => (
                <div
                  key={`${field.id}-value`}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  <label className="text-[10px] uppercase tracking-wide text-gray-400">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={inlineDraft.fieldValues[field.key] || ''}
                      onChange={(event) => updateInlineDraftFieldValue(field.key, event.target.value)}
                      rows={2}
                      className="mt-1 w-full bg-transparent text-xs font-semibold text-gray-900 outline-none dark:text-white"
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={inlineDraft.fieldValues[field.key] || ''}
                      onChange={(event) => updateInlineDraftFieldValue(field.key, event.target.value)}
                      className="mt-1 w-full bg-transparent text-xs font-semibold text-gray-900 outline-none dark:text-white"
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
                      value={inlineDraft.fieldValues[field.key] || ''}
                      onChange={(event) =>
                        updateInlineDraftFieldValue(
                          field.key,
                          field.key === 'code' ? event.target.value.toUpperCase() : event.target.value
                        )
                      }
                      className="mt-1 w-full bg-transparent text-xs font-semibold text-gray-900 outline-none dark:text-white"
                      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] leading-tight text-gray-400">
            {draftEntityLabel ? draftEntityLabel : `Section ${draftLevelNumber}`}
          </p>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
