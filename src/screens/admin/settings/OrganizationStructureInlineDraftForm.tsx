import React, { useMemo } from 'react';
import {
  OrganizationStructureLevel,
  OrganizationStructureNode,
} from '../../../services/settingsService';
import {
  buildSectionPickerOptions,
  CATALOG_SECTION_PREFIX,
  getEntityTypeOptionsForLevelRecord,
  getOrgLevelDefinitionByHeader,
  getOrgRootStageSectionTemplates,
  ORG_LEVEL_DEFINITIONS,
  NEW_LEVEL_SELECT_VALUE,
  stageColumnLabel,
} from './organizationStructureEntityTypes';

export type InlineDraftState = {
  relation: 'root' | 'child' | 'sibling';
  referenceNode?: OrganizationStructureNode;
  selectedLevelId: string;
  newSectionTemplate: string;
  selectedEntityType: string;
  customEntityType: string;
  definitionSource: 'custom' | 'preset';
  presetKey?: string | null;
  fieldValues: Record<string, string>;
  description: string;
  status: 'active' | 'inactive';
};

type Props = {
  /** When true, renders as a centered dialog instead of inline in the chart. */
  asModal?: boolean;
  inlineDraft: InlineDraftState;
  computedStageOrder: number;
  computedStageHint: string;
  allLevels: OrganizationStructureLevel[];
  slugifyFieldKey: (value: string) => string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  setInlineDraft: React.Dispatch<React.SetStateAction<InlineDraftState | null>>;
  updateInlineDraftFieldValue: (fieldKey: string, value: string) => void;
};

const inputClass =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

function RelationBadge({ relation }: { relation: InlineDraftState['relation'] }) {
  if (relation === 'root') {
    return (
      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
        Root
      </span>
    );
  }
  if (relation === 'sibling') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
        <span className="material-symbols-outlined text-[14px]">add</span>
        Sibling
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
      <span className="material-symbols-outlined text-[14px]">subdirectory_arrow_right</span>
      Child
    </span>
  );
}

export function OrganizationStructureInlineDraftForm({
  asModal = true,
  inlineDraft,
  computedStageOrder,
  computedStageHint,
  allLevels,
  slugifyFieldKey,
  onClose,
  onSubmit,
  setInlineDraft,
  updateInlineDraftFieldValue,
}: Props) {
  const isRoot = inlineDraft.relation === 'root';
  const isNewLevel = inlineDraft.selectedLevelId === NEW_LEVEL_SELECT_VALUE;

  const sectionPickerOptions = useMemo(
    () =>
      buildSectionPickerOptions(
        allLevels,
        isRoot ? getOrgRootStageSectionTemplates() : ORG_LEVEL_DEFINITIONS
      ),
    [isRoot, allLevels]
  );

  const newSectionTemplates = isRoot ? getOrgRootStageSectionTemplates() : ORG_LEVEL_DEFINITIONS;

  const sectionSelectValue = useMemo(() => {
    if (inlineDraft.selectedLevelId === NEW_LEVEL_SELECT_VALUE && inlineDraft.newSectionTemplate.trim()) {
      const catalogValue = `${CATALOG_SECTION_PREFIX}${inlineDraft.newSectionTemplate.trim()}`;
      if (sectionPickerOptions.some((option) => option.value === catalogValue)) {
        return catalogValue;
      }
      return NEW_LEVEL_SELECT_VALUE;
    }
    return inlineDraft.selectedLevelId;
  }, [inlineDraft.selectedLevelId, inlineDraft.newSectionTemplate, sectionPickerOptions]);

  const selectedLevel = useMemo(
    () => allLevels.find((level) => level.id === inlineDraft.selectedLevelId),
    [allLevels, inlineDraft.selectedLevelId]
  );

  const selectedCatalogDef = useMemo(() => {
    if (!inlineDraft.newSectionTemplate.trim()) {
      return undefined;
    }
    return getOrgLevelDefinitionByHeader(inlineDraft.newSectionTemplate);
  }, [inlineDraft.newSectionTemplate]);

  const fieldOptions = useMemo(() => {
    if ((isNewLevel || sectionSelectValue.startsWith(CATALOG_SECTION_PREFIX)) && inlineDraft.newSectionTemplate) {
      const def =
        selectedCatalogDef ||
        newSectionTemplates.find((item) => item.headerCategory === inlineDraft.newSectionTemplate);
      return def?.fieldValues || [];
    }
    return getEntityTypeOptionsForLevelRecord(selectedLevel);
  }, [
    isNewLevel,
    sectionSelectValue,
    inlineDraft.newSectionTemplate,
    newSectionTemplates,
    selectedLevel,
    selectedCatalogDef,
  ]);

  const levelReady = Boolean(inlineDraft.selectedLevelId);
  /** Picked from catalog in the main dropdown (creates level on save) — no second template field. */
  const usesCatalogSection =
    sectionSelectValue.startsWith(CATALOG_SECTION_PREFIX) ||
    (isNewLevel &&
      Boolean(inlineDraft.newSectionTemplate.trim()) &&
      newSectionTemplates.some((def) => def.headerCategory === inlineDraft.newSectionTemplate.trim()));
  /** Only when user chose "Custom section (not in list)". */
  const isCustomSectionFlow = isNewLevel && !usesCatalogSection;
  const newSectionReady = !isNewLevel || usesCatalogSection || Boolean(inlineDraft.newSectionTemplate.trim());
  const fieldReady = Boolean(inlineDraft.selectedEntityType);
  const nameReady = Boolean(inlineDraft.fieldValues.name?.trim());

  const title =
    isRoot ? 'Create root node' : inlineDraft.relation === 'sibling' ? 'Add sibling node' : 'Add child node';

  const formBody = (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/50">
          <RelationBadge relation={inlineDraft.relation} />
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {stageColumnLabel(computedStageOrder)}
          </span>
          {!isRoot && computedStageHint ? (
            <span className="w-full text-xs text-slate-500 dark:text-slate-400">{computedStageHint}</span>
          ) : null}
        </div>

        <div>
          <label className={labelClass}>Section *</label>
          <select
            value={sectionSelectValue}
            onChange={(event) => {
              const value = event.target.value;
              if (value.startsWith(CATALOG_SECTION_PREFIX)) {
                const header = value.slice(CATALOG_SECTION_PREFIX.length);
                setInlineDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        selectedLevelId: NEW_LEVEL_SELECT_VALUE,
                        newSectionTemplate: header,
                        selectedEntityType: '',
                        customEntityType: '',
                        definitionSource: 'preset',
                        presetKey: slugifyFieldKey(header),
                      }
                    : prev
                );
                return;
              }
              const level = allLevels.find((item) => item.id === value);
              setInlineDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      selectedLevelId: value,
                      newSectionTemplate:
                        value === NEW_LEVEL_SELECT_VALUE ? prev.newSectionTemplate : '',
                      selectedEntityType: '',
                      customEntityType: '',
                      definitionSource: level ? 'preset' : prev.definitionSource,
                      presetKey: level ? slugifyFieldKey(level.levelLabel) : prev.presetKey,
                    }
                  : prev
              );
            }}
            className={inputClass}
          >
            <option value="">Select section</option>
            {sectionPickerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value={NEW_LEVEL_SELECT_VALUE}>Custom section (not in list)…</option>
          </select>
          {usesCatalogSection && inlineDraft.newSectionTemplate.trim() ? (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              New section type: <span className="font-medium text-slate-700 dark:text-slate-300">{inlineDraft.newSectionTemplate}</span>
            </p>
          ) : null}
        </div>

        {isCustomSectionFlow ? (
          <div>
            <label className={labelClass}>Custom section type *</label>
            <select
              value={inlineDraft.newSectionTemplate}
              onChange={(event) =>
                setInlineDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        newSectionTemplate: event.target.value,
                        selectedEntityType: '',
                        customEntityType: '',
                        definitionSource: 'preset',
                        presetKey: event.target.value ? slugifyFieldKey(event.target.value) : null,
                      }
                    : prev
                )
              }
              className={inputClass}
            >
              <option value="">Select custom section type</option>
              {newSectionTemplates.map((def) => (
                <option key={def.headerCategory} value={def.headerCategory}>
                  {def.headerCategory}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Entity field *</label>
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
            disabled={!levelReady || !newSectionReady}
            className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="">
              {!levelReady || !newSectionReady ? 'Choose section first' : 'Select entity field'}
            </option>
            {fieldOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {inlineDraft.selectedEntityType === 'Custom' ? (
          <div>
            <label className={labelClass}>Custom field name *</label>
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
              className={inputClass}
              placeholder="e.g. Product Line"
            />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Entity name *</label>
            <input
              type="text"
              required
              disabled={!fieldReady}
              value={inlineDraft.fieldValues.name || ''}
              onChange={(event) => updateInlineDraftFieldValue('name', event.target.value)}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-50`}
              placeholder="Display name"
            />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input
              type="text"
              disabled={!fieldReady}
              value={inlineDraft.fieldValues.code || ''}
              onChange={(event) => updateInlineDraftFieldValue('code', event.target.value.toUpperCase())}
              className={`${inputClass} font-mono disabled:cursor-not-allowed disabled:opacity-50`}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!levelReady || !newSectionReady || !fieldReady || !nameReady}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save node
        </button>
      </div>
    </form>
  );

  if (asModal) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-node-create-title"
      >
        <div className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
            <div className="min-w-0">
              <h2 id="org-node-create-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Pick section once, then entity field and name. Stage follows child or sibling link.
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
          {formBody}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-white p-3 shadow-md dark:bg-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      {formBody}
    </div>
  );
}
