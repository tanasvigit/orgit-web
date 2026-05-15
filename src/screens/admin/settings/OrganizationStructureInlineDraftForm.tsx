import React from 'react';
import {
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
  updateInlineDraftFieldValue,
}: Props) {
  const inChart = indentPx === 0;

  return (
    <div
      className={inChart ? 'w-full' : 'mb-2 border-l-2 border-primary/50 pl-2'}
      style={inChart ? undefined : { marginLeft: indentPx }}
    >
      <form
        onSubmit={onSubmit}
        className={`rounded-lg border border-primary/30 bg-white shadow-lg ring-1 ring-primary/15 dark:border-primary/40 dark:bg-slate-800 ${
          inChart ? 'p-2.5' : 'p-2 shadow-sm'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-white">
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
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Section name</label>
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
              className="mt-1 max-h-28 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold text-gray-900 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="">Select section name</option>
              {entityTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {inlineDraft.selectedEntityType === 'Custom' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
              <label className="text-[10px] uppercase tracking-wide text-gray-400">Custom name</label>
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
                className="mt-1 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none dark:text-white"
                placeholder="Custom section name"
              />
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Name *</label>
            <input
              type="text"
              required
              value={inlineDraft.fieldValues.name || ''}
              onChange={(event) => updateInlineDraftFieldValue('name', event.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none dark:text-white"
              placeholder="Name"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Code</label>
            <input
              type="text"
              value={inlineDraft.fieldValues.code || ''}
              onChange={(event) => updateInlineDraftFieldValue('code', event.target.value.toUpperCase())}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none dark:text-white"
              placeholder="Code"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-tight text-gray-400">
            {draftEntityLabel ? draftEntityLabel : `Section ${draftLevelNumber}`}
          </p>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
