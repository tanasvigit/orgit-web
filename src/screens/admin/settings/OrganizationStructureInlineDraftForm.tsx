import React from 'react';
import {
  OrganizationStructureLevel,
  OrganizationStructureNode,
} from '../../../services/settingsService';
import { OrgLevelDefinition } from './organizationStructureEntityTypes';

export type InlineDraftState = {
  relation: 'root' | 'child' | 'sibling';
  referenceNode?: OrganizationStructureNode;
  /** Section name (Group, Entity, Region, …) — not a fixed chart column index. */
  selectedSection: string;
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
  levelDefinition: OrgLevelDefinition | undefined;
  levelPickerOptions: readonly OrgLevelDefinition[];
  showLevelPicker: boolean;
  draftSummaryLabel: string;
  fieldOptions: readonly string[];
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
  levelDefinition,
  levelPickerOptions,
  showLevelPicker,
  draftSummaryLabel,
  fieldOptions,
  slugifyFieldKey,
  onClose,
  onSubmit,
  setInlineDraft,
  updateInlineDraftFieldValue,
}: Props) {
  const inChart = indentPx === 0;
  const levelTypeLabel =
    existingLevel?.levelLabel || levelDefinition?.headerCategory || 'Section';
  const sectionReady = Boolean(inlineDraft.selectedSection.trim());
  const fieldReady = sectionReady && Boolean(inlineDraft.selectedEntityType);
  const nameCodeDisabled = !fieldReady;

  const handleSectionChange = (headerCategory: string) => {
    setInlineDraft((prev) =>
      prev
        ? {
            ...prev,
            selectedSection: headerCategory,
            selectedEntityType: '',
            customEntityType: '',
            definitionSource: 'preset',
            presetKey: headerCategory ? slugifyFieldKey(headerCategory) : null,
          }
        : prev
    );
  };

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
              ? 'Create Group'
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
          {showLevelPicker ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
              <label className="text-[10px] uppercase tracking-wide text-gray-400">Section *</label>
              <select
                value={inlineDraft.selectedSection}
                onChange={(event) => handleSectionChange(event.target.value)}
                className="mt-1 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold text-gray-900 outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              >
                <option value="">Select section</option>
                {levelPickerOptions.map((def) => (
                  <option key={def.headerCategory} value={def.headerCategory}>
                    {def.headerCategory}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
              <label className="text-[10px] uppercase tracking-wide text-gray-400">Section</label>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{levelTypeLabel}</p>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Field *</label>
            <select
              value={inlineDraft.selectedEntityType || ''}
              onChange={(event) =>
                setInlineDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        selectedEntityType: event.target.value,
                        customEntityType: '',
                        definitionSource:
                          event.target.value && event.target.value !== 'Custom' ? 'preset' : 'custom',
                      }
                    : prev
                )
              }
              disabled={showLevelPicker && !sectionReady}
              className="mt-1 max-h-28 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-sm font-semibold text-gray-900 outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            >
              <option value="">{showLevelPicker && !sectionReady ? 'Select section first' : 'Select field'}</option>
              {fieldOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {inlineDraft.selectedEntityType === 'Custom' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/40">
              <label className="text-[10px] uppercase tracking-wide text-gray-400">Custom field *</label>
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
                        }
                      : prev
                  )
                }
                className="mt-1 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none dark:text-white"
                placeholder="Custom field name"
              />
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Name *</label>
            <input
              type="text"
              required
              disabled={nameCodeDisabled}
              value={inlineDraft.fieldValues.name || ''}
              onChange={(event) => updateInlineDraftFieldValue('name', event.target.value)}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none disabled:opacity-50 dark:text-white"
              placeholder={nameCodeDisabled ? 'Select a field first' : 'Name'}
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <label className="text-[10px] uppercase tracking-wide text-gray-400">Code</label>
            <input
              type="text"
              disabled={nameCodeDisabled}
              value={inlineDraft.fieldValues.code || ''}
              onChange={(event) => updateInlineDraftFieldValue('code', event.target.value.toUpperCase())}
              className="mt-1 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none disabled:opacity-50 dark:text-white"
              placeholder={nameCodeDisabled ? 'Select a field first' : 'Code'}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-tight text-gray-400">
            {draftSummaryLabel || levelTypeLabel}
          </p>
          <button
            type="submit"
            disabled={!sectionReady || !fieldReady}
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
