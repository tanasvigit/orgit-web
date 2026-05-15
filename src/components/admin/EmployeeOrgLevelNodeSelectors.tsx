import React, { useMemo } from 'react';
import type { OrganizationStructureTree } from '../../services/settingsService';
import {
  formatOrgNodeOptionLabel,
  getActiveLevelsFromL2,
  getNodesForSection,
  getSectionStorageKey,
  normalizeOrgNodeByLevel,
  type OrgNodeByLevel,
} from '../../utils/employeeOrgNodeLevels';

type Props = {
  tree: OrganizationStructureTree | null | undefined;
  value: OrgNodeByLevel;
  onChange: (next: OrgNodeByLevel) => void;
  disabled?: boolean;
};

export function EmployeeOrgLevelNodeSelectors({ tree, value, onChange, disabled = false }: Props) {
  const levels = useMemo(() => getActiveLevelsFromL2(tree?.levels ?? []), [tree?.levels]);
  const nodes = tree?.nodes ?? [];
  const rootNodeId = tree?.rootNode?.id;

  const normalizedValue = useMemo(
    () => normalizeOrgNodeByLevel(value, tree?.levels ?? []),
    [value, tree?.levels]
  );

  if (!tree?.summary?.hasRootGroup) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Complete Org Definition first — create the Group, then add sections (Entity, Region, etc.).
      </p>
    );
  }

  if (levels.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No organisation sections are defined yet. Add sections in Org Definition.
      </p>
    );
  }

  const handleSectionChange = (level: (typeof levels)[0], nodeId: string) => {
    const key = getSectionStorageKey(level);
    const next: OrgNodeByLevel = { ...normalizedValue, [key]: nodeId };
    if (!nodeId) {
      delete next[key];
    }
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Organisation assignment
      </p>
      {levels.map((level) => {
        const sectionKey = getSectionStorageKey(level);
        const options = getNodesForSection(nodes, level.levelLabel, rootNodeId);
        const selectedId = normalizedValue[sectionKey] || '';

        return (
          <div key={level.id}>
            <label className="mb-1 block text-sm font-medium text-text-main">{level.levelLabel} *</label>
            <select
              required
              disabled={disabled || !rootNodeId}
              value={selectedId}
              onChange={(e) => handleSectionChange(level, e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-text-main disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="">
                {options.length === 0
                  ? `No nodes in ${level.levelLabel} — add in Org Definition`
                  : `Select ${level.levelLabel}`}
              </option>
              {options.map((node) => (
                <option key={node.id} value={node.id}>
                  {formatOrgNodeOptionLabel(tree, node)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
