import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  OrganizationStructureFieldSchemaField,
  OrganizationStructureLevel,
  OrganizationStructureNode,
} from '../../../services/settingsService';
import type { InlineDraftState } from './OrganizationStructureInlineDraftForm';
import {
  getEntityTypeOptionsForLevel,
  normalizeEntityTypeSelection,
} from './organizationStructureEntityTypes';

/** Horizontal org-chart layout — compact so ~5 levels fit typical content width (~1000px). */
export const CHART = {
  COL_W: 196,
  CARD_W: 186,
  /** Minimum card height in CSS; layout reserves at least CARD_SLOT_H per row. */
  CARD_H: 162,
  /** Default vertical slot per node; layout remeasures real card height after paint. */
  CARD_SLOT_H: 248,
  GAP_Y: 16,
  ROOT_GAP_Y: 18,
  PAD_TOP: 10,
} as const;

export type ChartPosition = {
  col: number;
  cardTop: number;
  centerY: number;
};

/** Matches `sortStructureNodes` in OrganisationStructureScreen (displayOrder, then name). */
function sortNodesForChartLayout(list: OrganizationStructureNode[]): OrganizationStructureNode[] {
  return [...list].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

function computeSubtreeHeights(
  nodeId: string,
  childrenByParentId: Map<string, OrganizationStructureNode[]>,
  memo: Map<string, number>,
  slotH: number
): number {
  if (memo.has(nodeId)) return memo.get(nodeId)!;
  const kids = childrenByParentId.get(nodeId) || [];
  if (kids.length === 0) {
    memo.set(nodeId, slotH);
    return slotH;
  }
  let sum = 0;
  kids.forEach((k, i) => {
    sum += computeSubtreeHeights(k.id, childrenByParentId, memo, slotH);
    if (i < kids.length - 1) sum += CHART.GAP_Y;
  });
  const h = Math.max(slotH, sum);
  memo.set(nodeId, h);
  return h;
}

function layoutSubtree(
  nodeId: string,
  col: number,
  y0: number,
  allocated: number,
  childrenByParentId: Map<string, OrganizationStructureNode[]>,
  subtreeHeights: Map<string, number>,
  positions: Map<string, ChartPosition>,
  slotH: number
): void {
  const kids = childrenByParentId.get(nodeId) || [];
  if (kids.length === 0) {
    const cardTop = y0 + (allocated - slotH) / 2;
    const centerY = y0 + allocated / 2;
    positions.set(nodeId, { col, cardTop, centerY });
    return;
  }
  let inner = 0;
  kids.forEach((k, i) => {
    inner += (subtreeHeights.get(k.id) || slotH) + (i < kids.length - 1 ? CHART.GAP_Y : 0);
  });
  let y = y0 + (allocated - inner) / 2;
  kids.forEach((k) => {
    const h = subtreeHeights.get(k.id) || slotH;
    layoutSubtree(k.id, col + 1, y, h, childrenByParentId, subtreeHeights, positions, slotH);
    y += h + CHART.GAP_Y;
  });
  const first = positions.get(kids[0].id)!;
  const last = positions.get(kids[kids.length - 1].id)!;
  const centerY = (first.centerY + last.centerY) / 2;
  const cardTop = centerY - slotH / 2;
  positions.set(nodeId, { col, cardTop, centerY });
}

function buildPositions(
  rootTreeNodes: OrganizationStructureNode[],
  childrenByParentId: Map<string, OrganizationStructureNode[]>,
  slotH: number
): { positions: Map<string, ChartPosition>; totalHeight: number } {
  const positions = new Map<string, ChartPosition>();
  const subtreeHeights = new Map<string, number>();
  rootTreeNodes.forEach((r) => computeSubtreeHeights(r.id, childrenByParentId, subtreeHeights, slotH));

  let yCursor = CHART.PAD_TOP;
  rootTreeNodes.forEach((root) => {
    const h = subtreeHeights.get(root.id) || slotH;
    layoutSubtree(root.id, 0, yCursor, h, childrenByParentId, subtreeHeights, positions, slotH);
    yCursor += h + CHART.ROOT_GAP_Y;
  });

  const totalHeight = Math.max(
    yCursor + CHART.PAD_TOP,
    CHART.PAD_TOP + slotH + CHART.PAD_TOP
  );
  return { positions, totalHeight };
}

/** Stack nodes by level when tree layout did not assign a position. */
function buildFallbackPositions(nodes: OrganizationStructureNode[], slotH: number): Map<string, ChartPosition> {
  const byLevel = new Map<number, OrganizationStructureNode[]>();
  for (const node of nodes) {
    if (!byLevel.has(node.levelNumber)) byLevel.set(node.levelNumber, []);
    byLevel.get(node.levelNumber)!.push(node);
  }
  const fallback = new Map<string, ChartPosition>();
  for (const [levelNum, list] of byLevel.entries()) {
    const sorted = [...list].sort((a, b) => a.displayOrder - b.displayOrder || (a.name || '').localeCompare(b.name || ''));
    sorted.forEach((node, index) => {
      const cardTop = CHART.PAD_TOP + index * (slotH + CHART.GAP_Y);
      fallback.set(node.id, {
        col: levelNum - 1,
        cardTop,
        centerY: cardTop + slotH / 2,
      });
    });
  }
  return fallback;
}

type LevelTheme = {
  column: string;
  header: string;
};

type OrgChartNodeCardProps = {
  node: OrganizationStructureNode;
  left: number;
  top: number;
  slotH: number;
  selected: boolean;
  theme: LevelTheme;
  levelSchema: OrganizationStructureFieldSchemaField[];
  getNodeEntityType: (node?: OrganizationStructureNode | null) => string;
  getNodeFieldValues: (node?: OrganizationStructureNode | null) => Record<string, unknown>;
  serializeFieldValues: (
    schema: OrganizationStructureFieldSchemaField[],
    fieldValues: Record<string, string>
  ) => Record<string, unknown>;
  onSelect: () => void;
  onAddSibling: () => void;
  onAddChild: () => void;
  onArchive: () => void;
  onOpenFullEdit: () => void;
  onPatch: (
    data: {
      name?: string;
      code?: string | null;
      metaJson?: Record<string, unknown>;
      fieldValues?: Record<string, unknown>;
    }
  ) => Promise<void>;
  disableSibling: boolean;
  isSaving: boolean;
};

function OrgChartNodeCard({
  node,
  left,
  top,
  slotH,
  selected,
  theme,
  levelSchema,
  getNodeEntityType,
  getNodeFieldValues,
  serializeFieldValues,
  onSelect,
  onAddSibling,
  onAddChild,
  onArchive,
  onOpenFullEdit,
  onPatch,
  disableSibling,
  isSaving,
}: OrgChartNodeCardProps) {
  const rawFv = getNodeFieldValues(node);
  const initialName = String(rawFv.name ?? node.name ?? '');
  const initialCode = String(rawFv.code ?? node.code ?? '');

  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);
  const entityTypeOptions = useMemo(
    () => getEntityTypeOptionsForLevel(node.levelNumber),
    [node.levelNumber]
  );
  const et = getNodeEntityType(node);
  const norm = normalizeEntityTypeSelection(et, node.levelNumber);
  const [selectedType, setSelectedType] = useState(norm.selectedEntityType);
  const [customType, setCustomType] = useState(norm.customEntityType);

  useEffect(() => {
    setName(String(rawFv.name ?? node.name ?? ''));
    setCode(String(rawFv.code ?? node.code ?? ''));
    const n2 = normalizeEntityTypeSelection(getNodeEntityType(node), node.levelNumber);
    setSelectedType(n2.selectedEntityType);
    setCustomType(n2.customEntityType);
  }, [node.id, node.name, node.code, node.levelLabel, node.levelNumber, node.fieldValues, getNodeEntityType]);

  const entityLabel =
    selectedType === 'Custom' ? customType.trim() : selectedType.trim();

  const flushSave = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    const fvSource = getNodeFieldValues(node);
    const baseMeta =
      node.metaJson && typeof node.metaJson === 'object' ? { ...(node.metaJson as Record<string, unknown>) } : {};
    baseMeta.entityType = entityLabel || node.levelLabel;

    const fvStrings: Record<string, string> = {};
    for (const f of levelSchema) {
      const v =
        f.key === 'name' ? trimmedName : f.key === 'code' ? trimmedCode : String(fvSource[f.key] ?? '');
      fvStrings[f.key] = v;
    }
    const fieldValues = serializeFieldValues(levelSchema, fvStrings);

    await onPatch({
      name: trimmedName || undefined,
      code: trimmedCode || null,
      metaJson: baseMeta,
      fieldValues,
    });
  }, [name, code, entityLabel, node, levelSchema, getNodeFieldValues, onPatch, serializeFieldValues]);

  const hasExtraSchemaFields = levelSchema.some((f) => f.key !== 'name' && f.key !== 'code');

  const archived = node.status === 'archived';

  return (
    <div
      className={`absolute z-[2] flex flex-col rounded-lg border bg-white shadow-sm transition-shadow dark:bg-slate-800 ${
        selected
          ? 'border-primary ring-1 ring-primary/25'
          : 'border-slate-200 dark:border-slate-600'
      } ${archived ? 'opacity-60' : ''}`}
      data-org-chart-card
      style={{
        left,
        top,
        width: CHART.CARD_W,
        height: slotH,
        minHeight: slotH,
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest('input, select, button, textarea')) return;
        onSelect();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={`rounded-t-lg border-b px-1.5 py-1 ${theme.header}`}>
        <div className="flex items-center justify-between gap-0.5">
          <span className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {node.levelLabel}
          </span>
          <div className="flex shrink-0 items-center gap-0">
            {hasExtraSchemaFields ? (
              <button
                type="button"
                title="All fields"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFullEdit();
                }}
                className="rounded p-0.5 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/40"
              >
                <span className="material-symbols-outlined text-[14px]">tune</span>
              </button>
            ) : null}
            <button
              type="button"
              title="Archive"
              disabled={node.levelNumber === 1}
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="rounded p-0.5 text-amber-600 hover:bg-white/60 disabled:opacity-30 dark:hover:bg-slate-900/40"
            >
              <span className="material-symbols-outlined text-[14px]">archive</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-1.5">
        <div>
          <label className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Type</label>
          <select
            value={selectedType || ''}
            onChange={async (e) => {
              const v = e.target.value;
              setSelectedType(v);
              const nextLabel = v === 'Custom' ? customType.trim() : v.trim();
              const baseMeta =
                node.metaJson && typeof node.metaJson === 'object'
                  ? { ...(node.metaJson as Record<string, unknown>) }
                  : {};
              baseMeta.entityType = nextLabel || node.levelLabel;
              await onPatch({ metaJson: baseMeta });
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-medium text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="">—</option>
            {entityTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {selectedType === 'Custom' ? (
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              onBlur={async () => {
                const baseMeta =
                  node.metaJson && typeof node.metaJson === 'object'
                    ? { ...(node.metaJson as Record<string, unknown>) }
                    : {};
                baseMeta.entityType = customType.trim() || node.levelLabel;
                await onPatch({ metaJson: baseMeta });
              }}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-0.5 text-[11px] dark:border-slate-600 dark:bg-slate-900"
              placeholder="Custom type"
            />
          ) : null}
        </div>

        <div>
          <label className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void flushSave()}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 text-[11px] font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onBlur={() => void flushSave()}
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div
          className="mt-auto flex items-center justify-end gap-1 pt-0.5"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Add sibling (same level)"
            disabled={disableSibling}
            onClick={onAddSibling}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
          <button
            type="button"
            title="Add child (next level)"
            onClick={onAddChild}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
        </div>
        {isSaving ? (
          <p className="text-[9px] text-slate-400">Saving…</p>
        ) : null}
      </div>
    </div>
  );
}

export type OrganizationStructureHorizontalChartProps = {
  title: string;
  levels: OrganizationStructureLevel[];
  nodes: OrganizationStructureNode[];
  rootTreeNodes: OrganizationStructureNode[];
  childrenByParentId: Map<string, OrganizationStructureNode[]>;
  levelByNumber: Map<number, OrganizationStructureLevel>;
  levelThemePalette: LevelTheme[];
  selectedNode: OrganizationStructureNode | null;
  onSelectNode: (node: OrganizationStructureNode) => void;
  getNodeEntityType: (node?: OrganizationStructureNode | null) => string;
  getEffectiveFieldSchema: (level?: OrganizationStructureLevel | null) => OrganizationStructureFieldSchemaField[];
  getNodeFieldValues: (node?: OrganizationStructureNode | null) => Record<string, unknown>;
  serializeFieldValues: (
    schema: OrganizationStructureFieldSchemaField[],
    fieldValues: Record<string, string>
  ) => Record<string, unknown>;
  openInlineDraft: (relation: 'root' | 'child' | 'sibling', referenceNode?: OrganizationStructureNode) => void;
  onArchiveNode: (node: OrganizationStructureNode) => void;
  onOpenFullEdit: (node: OrganizationStructureNode) => void;
  onUpdateNode: (
    id: string,
    data: {
      name?: string;
      code?: string | null;
      metaJson?: Record<string, unknown>;
      fieldValues?: Record<string, unknown>;
    }
  ) => Promise<unknown>;
  /** When set, chart positions the draft card near the reference node. */
  inlineDraft: InlineDraftState | null;
  chartInlineDraft: (box: { top: number; left: number }) => React.ReactNode;
  maxLevelNumber: number;
  /** When false, hides the title + legend row above the chart (tree only). @default true */
  showChartIntro?: boolean;
};

export function OrganizationStructureHorizontalChart({
  title,
  levels,
  nodes,
  rootTreeNodes,
  childrenByParentId,
  levelByNumber,
  levelThemePalette,
  selectedNode,
  onSelectNode,
  getNodeEntityType,
  getEffectiveFieldSchema,
  getNodeFieldValues,
  serializeFieldValues,
  openInlineDraft,
  onArchiveNode,
  onOpenFullEdit,
  onUpdateNode,
  inlineDraft,
  chartInlineDraft,
  maxLevelNumber,
  showChartIntro = true,
}: OrganizationStructureHorizontalChartProps) {
  const chartBodyRef = React.useRef<HTMLDivElement>(null);
  const [cardSlotH, setCardSlotH] = useState(CHART.CARD_SLOT_H);

  const measureCardSlots = useCallback(() => {
    const body = chartBodyRef.current;
    if (!body) return;
    const cards = body.querySelectorAll<HTMLElement>('[data-org-chart-card]');
    let max = CHART.CARD_SLOT_H;
    cards.forEach((card) => {
      const h = Math.ceil(card.scrollHeight);
      if (h > 0) max = Math.max(max, h);
    });
    setCardSlotH((prev) => (Math.abs(max - prev) >= 2 ? max : prev));
  }, []);

  const layoutRootNodes = useMemo(() => {
    if (rootTreeNodes.length > 0) return rootTreeNodes;
    return sortNodesForChartLayout(nodes.filter((n) => n.levelNumber === 1));
  }, [rootTreeNodes, nodes]);

  const { positions: treePositions, totalHeight } = useMemo(
    () => buildPositions(layoutRootNodes, childrenByParentId, cardSlotH),
    [layoutRootNodes, childrenByParentId, cardSlotH]
  );

  const fallbackPositions = useMemo(() => buildFallbackPositions(nodes, cardSlotH), [nodes, cardSlotH]);

  const positions = useMemo(() => {
    const merged = new Map(treePositions);
    for (const node of nodes) {
      if (!merged.has(node.id) && fallbackPositions.has(node.id)) {
        merged.set(node.id, fallbackPositions.get(node.id)!);
      }
    }
    return merged;
  }, [treePositions, nodes, fallbackPositions]);

  const [savingId, setSavingId] = useState<string | null>(null);

  const patchNode = useCallback(
    async (
      id: string,
      data: {
        name?: string;
        code?: string | null;
        metaJson?: Record<string, unknown>;
        fieldValues?: Record<string, unknown>;
      }
    ) => {
      setSavingId(id);
      try {
        await onUpdateNode(id, data);
      } finally {
        setSavingId(null);
      }
    },
    [onUpdateNode]
  );

  const columnCount = Math.max(1, maxLevelNumber);

  const svgPaths = useMemo(() => {
    const paths: string[] = [];
    for (const n of nodes) {
      if (!n.parentNodeId) continue;
      const p = positions.get(n.parentNodeId);
      const c = positions.get(n.id);
      if (!p || !c) continue;
      const parentRight = p.col * CHART.COL_W + (CHART.COL_W + CHART.CARD_W) / 2 - 4;
      const childLeft = c.col * CHART.COL_W + (CHART.COL_W - CHART.CARD_W) / 2 + 4;
      const midX = parentRight + (childLeft - parentRight) * 0.45;
      const py = p.centerY;
      const cy = c.centerY;
      const ys = [py, cy];
      const yTop = Math.min(...ys);
      const yBot = Math.max(...ys);
      paths.push(`M ${parentRight} ${py} L ${midX} ${py} M ${midX} ${yTop} L ${midX} ${yBot} M ${midX} ${cy} L ${childLeft} ${cy}`);
    }
    return paths;
  }, [nodes, positions]);

  const draftPlacement = useMemo(() => {
    if (!inlineDraft) return null;
    const colLeft = (c: number) => c * CHART.COL_W + (CHART.COL_W - CHART.CARD_W) / 2;
    if (inlineDraft.relation === 'root') {
      return { top: CHART.PAD_TOP, left: colLeft(0) };
    }
    const ref = inlineDraft.referenceNode;
    if (!ref) {
      const col = Math.max(0, inlineDraft.targetLevelNumber - 1);
      return { top: CHART.PAD_TOP, left: colLeft(col) };
    }
    const refPos = positions.get(ref.id);
    if (inlineDraft.relation === 'sibling') {
      const c = ref.levelNumber - 1;
      const top = (refPos?.cardTop ?? CHART.PAD_TOP) + cardSlotH + CHART.GAP_Y;
      return { top, left: colLeft(c) };
    }
    const childCol = Math.max(0, inlineDraft.targetLevelNumber - 1);
    const top = (refPos?.cardTop ?? CHART.PAD_TOP) + cardSlotH + CHART.GAP_Y;
    return { top, left: colLeft(childCol) };
  }, [inlineDraft, positions, cardSlotH]);

  const chartWidth = columnCount * CHART.COL_W;

  const chartBodyHeight = useMemo(() => {
    let bottom = CHART.PAD_TOP + cardSlotH;
    for (const p of positions.values()) {
      bottom = Math.max(bottom, p.cardTop + cardSlotH);
    }
    if (draftPlacement) {
      bottom = Math.max(bottom, draftPlacement.top + cardSlotH + CHART.GAP_Y);
    }
    return Math.max(totalHeight, bottom + CHART.PAD_TOP, cardSlotH + CHART.PAD_TOP * 2);
  }, [positions, draftPlacement, totalHeight, cardSlotH]);

  useEffect(() => {
    const body = chartBodyRef.current;
    if (!body) return;
    const ro = new ResizeObserver(() => measureCardSlots());
    ro.observe(body);
    measureCardSlots();
    return () => ro.disconnect();
  }, [measureCardSlots, nodes.length]);

  useEffect(() => {
    measureCardSlots();
  }, [measureCardSlots, positions]);

  return (
    <div className="w-full min-w-0">
      {showChartIntro ? (
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
              Five levels fit across a typical screen; scroll horizontally if you have more.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[9px] leading-tight text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white">
                <span className="material-symbols-outlined text-[12px]">add</span>
              </span>
              Sibling
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                <span className="material-symbols-outlined text-[12px]">add</span>
              </span>
              Child
            </span>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="max-w-full overflow-x-auto" style={{ overflowY: 'visible' }}>
          <div className="relative" style={{ width: chartWidth }}>
          {Array.from({ length: columnCount }, (_, i) => {
            const theme = levelThemePalette[i % levelThemePalette.length];
            return (
              <div
                key={`col-bg-${i}`}
                className={`pointer-events-none absolute bottom-0 top-0 z-0 border-r border-slate-200/80 ${theme.column} dark:border-slate-700/80`}
                style={{ left: i * CHART.COL_W, width: CHART.COL_W }}
              />
            );
          })}

          <div className="relative z-[3] flex border-b border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/90">
            {Array.from({ length: columnCount }, (_, i) => {
              const theme = levelThemePalette[i % levelThemePalette.length];
              const level = levels.find((l) => l.levelNumber === i + 1);
              return (
                <div
                  key={`hdr-${i}`}
                  title={`Level ${i + 1}`}
                  className={`flex h-10 shrink-0 flex-col justify-center border-r border-slate-200 px-1.5 dark:border-slate-700 ${theme.header}`}
                  style={{ width: CHART.COL_W }}
                >
                  <span className="text-[10px] font-bold leading-tight text-slate-800 dark:text-slate-100">
                    L{i + 1}
                  </span>
                  <span className="truncate text-[9px] font-medium leading-tight text-slate-600 dark:text-slate-300">
                    {level?.levelLabel || 'Section'}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            ref={chartBodyRef}
            className="relative overflow-visible"
            style={{ minHeight: chartBodyHeight }}
          >
            <svg
              className="pointer-events-none absolute left-0 right-0 top-0 z-[1] overflow-visible"
              width={chartWidth}
              height={chartBodyHeight}
            >
              {svgPaths.map((d, idx) => (
                <path
                  key={`e-${idx}`}
                  d={d}
                  fill="none"
                  stroke="rgb(148 163 184)"
                  strokeWidth={1.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            </svg>

            {nodes.map((node) => {
              const pos = positions.get(node.id);
              if (!pos) return null;
              const col = node.levelNumber - 1;
              const left = col * CHART.COL_W + (CHART.COL_W - CHART.CARD_W) / 2;
              const top = pos.cardTop;
              const theme = levelThemePalette[col % levelThemePalette.length];
              const schema = getEffectiveFieldSchema(levelByNumber.get(node.levelNumber));

              return (
                <OrgChartNodeCard
                  key={node.id}
                  node={node}
                  left={left}
                  top={top}
                  slotH={cardSlotH}
                  selected={selectedNode?.id === node.id}
                  theme={theme}
                  levelSchema={schema}
                  getNodeEntityType={getNodeEntityType}
                  getNodeFieldValues={getNodeFieldValues}
                  serializeFieldValues={serializeFieldValues}
                  onSelect={() => onSelectNode(node)}
                  onAddSibling={() => openInlineDraft('sibling', node)}
                  onAddChild={() => openInlineDraft('child', node)}
                  onArchive={() => onArchiveNode(node)}
                  onOpenFullEdit={() => onOpenFullEdit(node)}
                  onPatch={(data) => patchNode(node.id, data)}
                  disableSibling={node.levelNumber === 1}
                  isSaving={savingId === node.id}
                />
              );
            })}

            {draftPlacement ? (
              <div
                data-org-chart-draft
                className="absolute z-20"
                style={{ top: draftPlacement.top, left: draftPlacement.left, width: CHART.CARD_W }}
              >
                {chartInlineDraft(draftPlacement)}
              </div>
            ) : null}
            <div
              aria-hidden
              className="pointer-events-none block w-full shrink-0"
              style={{ height: chartBodyHeight }}
            />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
