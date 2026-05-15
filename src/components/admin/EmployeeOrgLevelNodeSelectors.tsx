import React, { useMemo } from 'react';
import type { OrganizationStructureTree } from '../../services/settingsService';
import {
  getActiveLevelsFromL2,
  getNodesAtLevel,
  getParentNodeIdForLevel,
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

  if (!tree?.summary?.hasRootGroup) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Complete Org Definition first to assign employees to organisation, company, region, and other levels.
      </p>
    );
  }

  if (levels.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No levels below L1 are defined. Add organisation structure in Org Definition.
      </p>
    );
  }

  const handleLevelChange = (levelNumber: number, nodeId: string) => {
    const key = String(levelNumber);
    const next: OrgNodeByLevel = { ...value, [key]: nodeId };
    for (const level of levels) {
      if (level.levelNumber > levelNumber) {
        delete next[String(level.levelNumber)];
      }
    }
    onChange(next);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Organisation assignment (from level 2)
      </p>
      {levels.map((level) => {
        const parentId = getParentNodeIdForLevel(level.levelNumber, value, rootNodeId);
        const options = getNodesAtLevel(nodes, level.levelNumber, parentId);
        const selectedId = value[String(level.levelNumber)] || '';
        const parentMissing = level.levelNumber > 2 && !parentId;

        return (
          <div key={level.id}>
            <label className="block text-sm font-medium text-text-main mb-1">
              L{level.levelNumber} — {level.levelLabel} *
            </label>
            <select
              required
              disabled={disabled || parentMissing || (level.levelNumber === 2 && !rootNodeId)}
              value={selectedId}
              onChange={(e) => handleLevelChange(level.levelNumber, e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-text-main disabled:opacity-60"
            >
              <option value="">
                {parentMissing
                  ? `Select L${level.levelNumber - 1} first`
                  : options.length === 0
                    ? `No ${level.levelLabel} defined`
                    : `Select ${level.levelLabel}`}
              </option>
              {options.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
