import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OrganizationStructureNode,
  OrganizationStructureTree,
} from '../../services/settingsService';
import { useClickOutside } from '../../hooks/useClickOutside';
import {
  buildChildrenByParentId,
  formatMappedOrgNodesSummary,
  formatOrgNodeOptionLabel,
  getCheckedOrgNodeIdsForTree,
  sortStructureNodes,
  syncOrgMappingFromSelectedIds,
  toggleOrgStructureNodeSelection,
  type OrgNodeByLevel,
} from '../../utils/employeeOrgNodeLevels';

type Props = {
  tree: OrganizationStructureTree | null | undefined;
  orgNodeByLevel: OrgNodeByLevel;
  secondaryOrgNodeIds: string[];
  onChange: (patch: { orgNodeByLevel: OrgNodeByLevel; secondaryOrgNodeIds: string[] }) => void;
  disabled?: boolean;
};

function TreeNodeRow({
  node,
  depth,
  tree,
  childrenByParentId,
  checkedIds,
  expandedIds,
  onToggleExpand,
  onToggleCheck,
  disabled,
}: {
  node: OrganizationStructureNode;
  depth: number;
  tree: OrganizationStructureTree;
  childrenByParentId: Map<string, OrganizationStructureNode[]>;
  checkedIds: Set<string>;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleCheck: (id: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const children = childrenByParentId.get(node.id) || [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isRoot = node.id === tree.rootNode?.id;
  const isCheckable = !isRoot && node.status === 'active';
  const isChecked = checkedIds.has(node.id);

  return (
    <div className="min-w-0">
      <div
        className="flex min-w-0 items-center gap-1.5 rounded-md py-1 pr-1 hover:bg-slate-50 dark:hover:bg-slate-800/60"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-700"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span
              className={`material-symbols-outlined text-[18px] transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            >
              chevron_right
            </span>
          </button>
        ) : (
          <span className="inline-block h-6 w-6 shrink-0" aria-hidden />
        )}

        {isCheckable ? (
          <input
            type="checkbox"
            className="shrink-0 rounded border-slate-300"
            checked={isChecked}
            disabled={disabled}
            onChange={(e) => onToggleCheck(node.id, e.target.checked)}
          />
        ) : (
          <span className="inline-block h-4 w-4 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className={`truncate text-sm ${
                isRoot ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-text-main'
              }`}
            >
              {formatOrgNodeOptionLabel(tree, node) || node.name}
            </span>
            {node.levelLabel && !isRoot ? (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {node.levelLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {hasChildren && isExpanded ? (
        <div className="border-l border-slate-200 ml-3 dark:border-slate-600">
          {children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              tree={tree}
              childrenByParentId={childrenByParentId}
              checkedIds={checkedIds}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onToggleCheck={onToggleCheck}
              disabled={disabled}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OrgStructureCheckboxTreeSelect({
  tree,
  orgNodeByLevel,
  secondaryOrgNodeIds,
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const checkedIds = useMemo(
    () => getCheckedOrgNodeIdsForTree(orgNodeByLevel, secondaryOrgNodeIds, tree),
    [orgNodeByLevel, secondaryOrgNodeIds, tree]
  );

  const childrenByParentId = useMemo(
    () => buildChildrenByParentId(tree?.nodes ?? []),
    [tree?.nodes]
  );

  const rootTreeNodes = useMemo(() => {
    if (!tree) return [];
    const fromRootKey = sortStructureNodes(childrenByParentId.get('__root__') || []);
    if (fromRootKey.length > 0) return fromRootKey;
    if (tree.rootNode) return [tree.rootNode];
    return sortStructureNodes((tree.nodes ?? []).filter((n) => n.levelNumber === 1));
  }, [childrenByParentId, tree]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!tree?.nodes?.length) return;
    const ids = new Set<string>();
    for (const n of tree.nodes) {
      if (n.hasChildren || (childrenByParentId.get(n.id)?.length ?? 0) > 0) {
        ids.add(n.id);
      }
    }
    if (tree.rootNode?.id) ids.add(tree.rootNode.id);
    setExpandedIds(ids);
  }, [tree, childrenByParentId]);

  const closePanel = useCallback(() => setOpen(false), []);
  useClickOutside(panelRef, closePanel, open);

  const summary = formatMappedOrgNodesSummary(tree, orgNodeByLevel, secondaryOrgNodeIds);

  const handleToggleCheck = (nodeId: string, checked: boolean) => {
    if (!tree) return;
    const next = toggleOrgStructureNodeSelection(nodeId, checked, checkedIds, tree);
    onChange(syncOrgMappingFromSelectedIds(next, tree));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!(tree?.summary?.hasRootNode || tree?.summary?.hasRootGroup)) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Complete Org Definition first — create the Group, then add sections (Entity, Region, etc.).
      </p>
    );
  }

  const hasAssignableChildren =
    (tree.rootNode && (childrenByParentId.get(tree.rootNode.id)?.length ?? 0) > 0) ||
    rootTreeNodes.some((n) => n.id !== tree.rootNode?.id);

  if (!hasAssignableChildren) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        No org units below the root yet. In Org Definition, add child nodes, then assign employees here.
      </p>
    );
  }

  return (
    <div ref={panelRef} className="relative">
      <label className="mb-1 block text-sm font-medium text-text-main">Org units *</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-text-main disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800"
      >
        <span className={`min-w-0 flex-1 truncate ${summary ? '' : 'text-slate-400'}`}>
          {summary || 'Select org units from structure'}
        </span>
        <span
          className={`material-symbols-outlined shrink-0 text-slate-500 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900">
          <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
            Expand sections like your org chart. Checking a unit also selects its parent path. Primary
            assignment uses the deepest selected unit.
          </p>
          <div className="max-h-64 overflow-y-auto p-2">
            {rootTreeNodes.map((node) => (
              <TreeNodeRow
                key={node.id}
                node={node}
                depth={0}
                tree={tree}
                childrenByParentId={childrenByParentId}
                checkedIds={checkedIds}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onToggleCheck={handleToggleCheck}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
