import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  OrganizationStructureLevel,
  OrganizationStructureNode,
} from '../../../services/settingsService';
import type { InlineDraftState } from './OrganizationStructureInlineDraftForm';

/** Horizontal org-chart layout — compact so ~5 levels fit typical content width (~1000px). */
export const CHART = {
  COL_W: 168,
  CARD_W: 158,
  /** Inline create form is wider than node cards so fields are not clipped. */
  DRAFT_W: 228,
  DRAFT_MIN_H: 236,
  /** Minimum card height; layout remeasures after paint. */
  CARD_H: 88,
  /** Default vertical slot per node (compact name + code only). */
  CARD_SLOT_H: 102,
  GAP_Y: 12,
  ROOT_GAP_Y: 14,
  PAD_TOP: 8,
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

/** Stack nodes by section column when tree layout did not assign a position. */
function buildFallbackPositions(
  nodes: OrganizationStructureNode[],
  slotH: number,
  levelNumberToColumn: Map<number, number>
): Map<string, ChartPosition> {
  const byLevel = new Map<number, OrganizationStructureNode[]>();
  for (const node of nodes) {
    if (!byLevel.has(node.levelNumber)) byLevel.set(node.levelNumber, []);
    byLevel.get(node.levelNumber)!.push(node);
  }
  const fallback = new Map<string, ChartPosition>();
  for (const [levelNum, list] of byLevel.entries()) {
    const col = levelNumberToColumn.get(levelNum) ?? 0;
    const sorted = [...list].sort((a, b) => a.displayOrder - b.displayOrder || (a.name || '').localeCompare(b.name || ''));
    sorted.forEach((node, index) => {
      const cardTop = CHART.PAD_TOP + index * (slotH + CHART.GAP_Y);
      fallback.set(node.id, {
        col,
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
  getNodeFieldValues: (node?: OrganizationStructureNode | null) => Record<string, unknown>;
  getNodeEntityType: (node?: OrganizationStructureNode | null) => string;
  onSelect: () => void;
  onAddSibling: () => void;
  onAddChild: () => void;
  onOpenView: () => void;
  onOpenEdit: () => void;
  disableSibling: boolean;
};

function OrgChartNodeCard({
  node,
  left,
  top,
  slotH,
  selected,
  theme,
  getNodeFieldValues,
  getNodeEntityType,
  onSelect,
  onAddSibling,
  onAddChild,
  onOpenView,
  onOpenEdit,
  disableSibling,
}: OrgChartNodeCardProps) {
  const rawFv = getNodeFieldValues(node);
  const displayName = String(rawFv.name ?? node.name ?? '').trim() || '—';
  const displayCode = String(rawFv.code ?? node.code ?? '').trim() || '—';
  const rawField = getNodeEntityType(node).trim();
  const sectionLabel = (node.levelLabel || '').trim();
  const displayField =
    rawField && (!sectionLabel || rawField.toLowerCase() !== sectionLabel.toLowerCase()) ? rawField : '';
  const archived = node.status === 'archived';

  return (
    <div
      className={`absolute z-[2] flex flex-col rounded-md border bg-white shadow-sm transition-shadow dark:bg-slate-800 ${
        selected
          ? 'border-primary ring-1 ring-primary/25'
          : 'border-slate-200 dark:border-slate-600'
      } ${archived ? 'opacity-60' : ''}`}
      data-org-chart-card
      style={{
        left,
        top,
        width: CHART.CARD_W,
        minHeight: Math.max(CHART.CARD_H, slotH),
        height: 'auto',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        const el = e.target as HTMLElement;
        if (el.closest('button')) return;
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
      <div className={`shrink-0 rounded-t-md border-b px-1 py-0.5 ${theme.header}`}>
        <div className="flex items-center justify-between gap-0.5">
          <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            {node.levelLabel}
          </span>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              title="View"
              onClick={(e) => {
                e.stopPropagation();
                onOpenView();
              }}
              className="rounded p-0.5 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/40"
            >
              <span className="material-symbols-outlined text-[15px]">visibility</span>
            </button>
            <button
              type="button"
              title="Edit"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEdit();
              }}
              className="rounded p-0.5 text-slate-500 hover:bg-white/60 dark:hover:bg-slate-900/40"
            >
              <span className="material-symbols-outlined text-[15px]">edit</span>
            </button>
          </div>
        </div>
      </div>

      <div
        className="relative flex min-h-[58px] flex-1 cursor-pointer flex-col px-2 pb-7 pt-1.5"
        onClick={(e) => {
          e.stopPropagation();
          onOpenView();
        }}
        role="presentation"
      >
        {displayField ? (
          <p className="truncate text-[11px] font-semibold leading-snug text-primary dark:text-primary-300">
            {displayField}
          </p>
        ) : null}
        <p
          className={`line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900 dark:text-white ${
            displayField ? 'mt-0.5' : ''
          }`}
        >
          {displayName}
        </p>
        <p className="mt-0.5 truncate font-mono text-[12px] text-slate-600 dark:text-slate-300">{displayCode}</p>

        <button
          type="button"
          title="Add sibling"
          disabled={disableSibling}
          onClick={(e) => {
            e.stopPropagation();
            onAddSibling();
          }}
          className="absolute bottom-1 left-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-600"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
        <button
          type="button"
          title="Add child"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          className="absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
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
  levelThemePalette: LevelTheme[];
  selectedNode: OrganizationStructureNode | null;
  onSelectNode: (node: OrganizationStructureNode) => void;
  getNodeFieldValues: (node?: OrganizationStructureNode | null) => Record<string, unknown>;
  getNodeEntityType: (node?: OrganizationStructureNode | null) => string;
  openInlineDraft: (relation: 'root' | 'child' | 'sibling', referenceNode?: OrganizationStructureNode) => void;
  onOpenNodeView: (node: OrganizationStructureNode) => void;
  onOpenNodeEdit: (node: OrganizationStructureNode) => void;
  /** When set, chart positions the draft card near the reference node. */
  inlineDraft: InlineDraftState | null;
  chartInlineDraft: (box: { top: number; left: number }) => React.ReactNode;
  orderedLevels: OrganizationStructureLevel[];
  columnCount: number;
  /** When false, hides the title + legend row above the chart (tree only). @default true */
  showChartIntro?: boolean;
};

export function OrganizationStructureHorizontalChart({
  title,
  levels: _levels,
  nodes,
  rootTreeNodes,
  childrenByParentId,
  levelThemePalette,
  selectedNode,
  onSelectNode,
  getNodeFieldValues,
  getNodeEntityType,
  openInlineDraft,
  onOpenNodeView,
  onOpenNodeEdit,
  inlineDraft,
  chartInlineDraft,
  orderedLevels,
  columnCount,
  showChartIntro = true,
}: OrganizationStructureHorizontalChartProps) {
  const chartBodyRef = React.useRef<HTMLDivElement>(null);
  const [cardSlotH, setCardSlotH] = useState<number>(CHART.CARD_SLOT_H);

  const measureCardSlots = useCallback(() => {
    const body = chartBodyRef.current;
    if (!body) return;
    const cards = body.querySelectorAll<HTMLElement>('[data-org-chart-card]');
    let max: number = CHART.CARD_SLOT_H;
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

  const levelNumberToColumn = useMemo(() => {
    const map = new Map<number, number>();
    orderedLevels.forEach((level, index) => {
      map.set(level.levelNumber, index);
    });
    return map;
  }, [orderedLevels]);

  const sectionColumnIndex = useCallback(
    (sectionLabel?: string, levelNumber?: number) => {
      if (levelNumber !== undefined && levelNumberToColumn.has(levelNumber)) {
        return levelNumberToColumn.get(levelNumber)!;
      }
      const normalized = String(sectionLabel || '').trim().toLowerCase();
      if (!normalized) {
        return 0;
      }
      const existing = orderedLevels.find((level) => level.levelLabel.trim().toLowerCase() === normalized);
      if (existing) {
        return levelNumberToColumn.get(existing.levelNumber) ?? 0;
      }
      return orderedLevels.length;
    },
    [levelNumberToColumn, orderedLevels]
  );

  const fallbackPositions = useMemo(
    () => buildFallbackPositions(nodes, cardSlotH, levelNumberToColumn),
    [nodes, cardSlotH, levelNumberToColumn]
  );

  const positions = useMemo(() => {
    const merged = new Map(treePositions);
    for (const node of nodes) {
      if (!merged.has(node.id) && fallbackPositions.has(node.id)) {
        merged.set(node.id, fallbackPositions.get(node.id)!);
      }
    }
    return merged;
  }, [treePositions, nodes, fallbackPositions]);

  const resolvedColumnCount = Math.max(1, columnCount);

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
      const col = sectionColumnIndex(inlineDraft.selectedSection);
      return { top: CHART.PAD_TOP, left: colLeft(col) };
    }
    const refPos = positions.get(ref.id);
    if (inlineDraft.relation === 'sibling') {
      const c = sectionColumnIndex(ref.levelLabel, ref.levelNumber);
      const top = (refPos?.cardTop ?? CHART.PAD_TOP) + cardSlotH + CHART.GAP_Y;
      return { top, left: colLeft(c) };
    }
    const childCol = sectionColumnIndex(inlineDraft.selectedSection);
    const top = (refPos?.cardTop ?? CHART.PAD_TOP) + cardSlotH + CHART.GAP_Y;
    const colStart = childCol * CHART.COL_W;
    const centeredLeft = colStart + Math.max(0, (CHART.COL_W - CHART.DRAFT_W) / 2);
    return { top, left: centeredLeft };
  }, [inlineDraft, positions, cardSlotH, sectionColumnIndex]);

  const chartWidth = resolvedColumnCount * CHART.COL_W;

  const chartBodyHeight = useMemo(() => {
    let bottom = CHART.PAD_TOP + cardSlotH;
    for (const p of positions.values()) {
      bottom = Math.max(bottom, p.cardTop + cardSlotH);
    }
    if (draftPlacement) {
      bottom = Math.max(bottom, draftPlacement.top + CHART.DRAFT_MIN_H + CHART.GAP_Y);
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
        <div className="max-w-full overflow-x-auto overflow-y-visible pb-2">
          <div className="relative" style={{ width: chartWidth }}>
          {Array.from({ length: resolvedColumnCount }, (_, i) => {
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
            {Array.from({ length: resolvedColumnCount }, (_, i) => {
              const theme = levelThemePalette[i % levelThemePalette.length];
              const level = orderedLevels[i];
              const draftSection =
                inlineDraft?.relation === 'child' ? inlineDraft.selectedSection.trim() : '';
              const columnLabel =
                level?.levelLabel ||
                (i === orderedLevels.length && draftSection ? draftSection : '') ||
                'Section';
              return (
                <div
                  key={`hdr-${i}`}
                  title={columnLabel}
                  className={`flex h-10 shrink-0 items-center border-r border-slate-200 px-1.5 dark:border-slate-700 ${theme.header}`}
                  style={{ width: CHART.COL_W }}
                >
                  <span className="truncate text-[10px] font-bold leading-tight text-slate-800 dark:text-slate-100">
                    {columnLabel}
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
              const col = levelNumberToColumn.get(node.levelNumber) ?? 0;
              const left = col * CHART.COL_W + (CHART.COL_W - CHART.CARD_W) / 2;
              const top = pos.cardTop;
              const theme = levelThemePalette[col % levelThemePalette.length];
              return (
                <OrgChartNodeCard
                  key={node.id}
                  node={node}
                  left={left}
                  top={top}
                  slotH={cardSlotH}
                  selected={selectedNode?.id === node.id}
                  theme={theme}
                  getNodeFieldValues={getNodeFieldValues}
                  getNodeEntityType={getNodeEntityType}
                  onSelect={() => onSelectNode(node)}
                  onAddSibling={() => openInlineDraft('sibling', node)}
                  onAddChild={() => openInlineDraft('child', node)}
                  onOpenView={() => onOpenNodeView(node)}
                  onOpenEdit={() => onOpenNodeEdit(node)}
                  disableSibling={node.levelNumber === 1}
                />
              );
            })}

            {draftPlacement ? (
              <div
                data-org-chart-draft
                className="absolute z-30"
                style={{
                  top: draftPlacement.top,
                  left: draftPlacement.left,
                  width: CHART.DRAFT_W,
                  minHeight: CHART.DRAFT_MIN_H,
                }}
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
