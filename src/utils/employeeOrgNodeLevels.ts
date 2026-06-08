import type {
  OrganizationStructureLevel,
  OrganizationStructureNode,
  OrganizationStructureTree,
} from '../services/settingsService';

export const EMPLOYEE_ORG_NODE_BY_LEVEL_KEY = 'orgNodeByLevel';

/** Section label (e.g. Entity, Region) → organisation node id */
export type OrgNodeByLevel = Record<string, string>;

export function getSectionStorageKey(level: OrganizationStructureLevel): string {
  return level.levelLabel.trim();
}

export function getActiveLevelsFromL2(
  levelsOrTree: OrganizationStructureLevel[] | OrganizationStructureTree
): OrganizationStructureLevel[] {
  if (!Array.isArray(levelsOrTree) && levelsOrTree?.nodes) {
    return getAssignmentSectionsFromTree(levelsOrTree);
  }
  return [...levelsOrTree]
    .filter((l) => l.levelNumber > 1 && l.isActive !== false)
    .sort((a, b) => a.levelNumber - b.levelNumber);
}

/** Active org nodes under the organisation root (excludes the root node itself). */
export function getActiveNodesUnderRoot(
  tree: OrganizationStructureTree | null | undefined
): OrganizationStructureNode[] {
  const rootNodeId = tree?.rootNode?.id;
  if (!tree || !rootNodeId) return [];
  return (tree.nodes ?? []).filter((n) => {
    if (!n?.id || n.status === 'archived') return false;
    if (n.id === rootNodeId || !n.parentNodeId) return false;
    const pathIds = n.pathIds || [];
    return pathIds.includes(rootNodeId);
  });
}

/**
 * Sections to show on employee assignment — only labels that have at least one node on the org chart.
 * (Not every section row in the DB catalog.)
 */
export function getAssignmentSectionsFromTree(
  tree: OrganizationStructureTree | null | undefined,
  currentValue?: OrgNodeByLevel
): OrganizationStructureLevel[] {
  const rootNodeId = tree?.rootNode?.id;
  if (!tree || !rootNodeId) return [];

  const levels = tree.levels ?? [];
  const levelByLabel = new Map(
    levels.map((l) => [l.levelLabel.trim().toLowerCase(), l])
  );

  const sectionByKey = new Map<
    string,
    { level: OrganizationStructureLevel; sortKey: number }
  >();

  const addSection = (node: OrganizationStructureNode) => {
    const label = (node.levelLabel || '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    const matched = levelByLabel.get(key);
    const level: OrganizationStructureLevel =
      matched ||
      ({
        id: node.levelId,
        organizationId: node.organizationId,
        levelNumber: node.levelNumber,
        levelKey: node.levelKey,
        levelLabel: label,
        definitionSource: 'custom',
        fieldSchemaJson: [],
        isSystemRequired: false,
        isActive: true,
      } as OrganizationStructureLevel);
    const sortKey = node.stageOrder ?? node.levelNumber ?? 999;
    const prev = sectionByKey.get(key);
    if (!prev || sortKey < prev.sortKey) {
      sectionByKey.set(key, { level, sortKey });
    }
  };

  for (const node of getActiveNodesUnderRoot(tree)) {
    addSection(node);
  }

  if (currentValue) {
    for (const nodeId of Object.values(currentValue)) {
      if (!nodeId?.trim()) continue;
      const node = tree.nodes.find((n) => n.id === nodeId);
      if (node) addSection(node);
    }
  }

  return Array.from(sectionByKey.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.level);
}

/** Convert legacy numeric keys (2, 3, …) to section labels when levels are known. */
export function normalizeOrgNodeByLevel(
  raw: OrgNodeByLevel,
  levels: OrganizationStructureLevel[]
): OrgNodeByLevel {
  const levelByNumber = new Map(levels.map((l) => [l.levelNumber, l]));
  const out: OrgNodeByLevel = {};

  for (const [key, nodeId] of Object.entries(raw)) {
    if (!nodeId?.trim()) continue;
    const asNumber = Number(key);
    if (Number.isFinite(asNumber) && levelByNumber.has(asNumber)) {
      out[getSectionStorageKey(levelByNumber.get(asNumber)!)] = nodeId.trim();
    } else {
      out[key.trim()] = nodeId.trim();
    }
  }
  return out;
}

export function lookupOrgNodeId(
  orgNodeByLevel: OrgNodeByLevel,
  level: OrganizationStructureLevel
): string | undefined {
  const labelKey = getSectionStorageKey(level);
  return orgNodeByLevel[labelKey] || orgNodeByLevel[String(level.levelNumber)];
}

export function getNodesForSection(
  nodes: OrganizationStructureNode[],
  sectionLabel: string,
  rootNodeId: string | null | undefined
): OrganizationStructureNode[] {
  if (!rootNodeId) return [];
  const normalizedSection = sectionLabel.trim().toLowerCase();

  return nodes
    .filter((n) => {
      if (n.status === 'archived' || n.status === 'inactive') return false;
      if ((n.levelLabel || '').trim().toLowerCase() !== normalizedSection) return false;
      const pathIds = n.pathIds || [];
      return pathIds.includes(rootNodeId);
    })
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

export function deriveOrgNodeByLevelFromPrimary(
  tree: OrganizationStructureTree | null | undefined,
  primaryNodeId: string | null | undefined
): OrgNodeByLevel {
  if (!tree || !primaryNodeId) return {};
  const node = tree.nodes.find((n) => n.id === primaryNodeId);
  if (!node) return {};

  const levelByNumber = new Map(tree.levels.map((l) => [l.levelNumber, l]));
  const out: OrgNodeByLevel = {};

  for (const item of node.path || []) {
    if (item.levelNumber > 1) {
      const level = levelByNumber.get(item.levelNumber);
      const key = level ? getSectionStorageKey(level) : String(item.levelNumber);
      out[key] = item.id;
    }
  }
  if (node.levelNumber > 1) {
    const level = levelByNumber.get(node.levelNumber);
    const key = level ? getSectionStorageKey(level) : String(node.levelNumber);
    out[key] = node.id;
  }
  return out;
}

export function extractOrgNodeByLevel(
  orgFieldValues: Record<string, unknown> | null | undefined
): OrgNodeByLevel {
  if (!orgFieldValues) return {};
  const raw = orgFieldValues[EMPLOYEE_ORG_NODE_BY_LEVEL_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: OrgNodeByLevel = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      out[key.trim()] = value.trim();
    }
  }
  return out;
}

export function getDeepestSelectedNodeId(
  orgNodeByLevel: OrgNodeByLevel,
  levelsFromL2: OrganizationStructureLevel[]
): string | null {
  if (levelsFromL2.length === 0) return null;
  for (let i = levelsFromL2.length - 1; i >= 0; i -= 1) {
    const id = lookupOrgNodeId(orgNodeByLevel, levelsFromL2[i]);
    if (id) return id;
  }
  return null;
}

export function buildEmployeeOrgFieldValuesPayload(
  orgNodeByLevel: OrgNodeByLevel,
  extraFieldValues: Record<string, string>
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...extraFieldValues };
  if (Object.keys(orgNodeByLevel).length > 0) {
    payload[EMPLOYEE_ORG_NODE_BY_LEVEL_KEY] = orgNodeByLevel;
  }
  return payload;
}

export function getEntityTypeFromNode(
  tree: OrganizationStructureTree | null | undefined,
  nodeId: string | null | undefined
): string {
  if (!tree || !nodeId) return '';
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) return '';
  const raw =
    node.metaJson && typeof node.metaJson.entityType === 'string'
      ? String(node.metaJson.entityType).trim()
      : '';
  return raw || node.levelLabel || '';
}

export function formatOrgNodeOptionLabel(
  tree: OrganizationStructureTree | null | undefined,
  node: OrganizationStructureNode | null | undefined
): string {
  if (!node?.id || !node.name) return '';
  const fieldType = getEntityTypeFromNode(tree, node.id);
  const section = (node.levelLabel || '').trim();
  if (fieldType && section && fieldType.toLowerCase() !== section.toLowerCase()) {
    return `${node.name} (${fieldType})`;
  }
  return node.name;
}

export function formatOrgNodeByLevelSummary(
  tree: OrganizationStructureTree | null | undefined,
  orgNodeByLevel: OrgNodeByLevel
): string {
  if (!tree) return '';
  const levels = getAssignmentSectionsFromTree(tree, orgNodeByLevel);
  const parts: string[] = [];
  for (const level of levels) {
    const nodeId = lookupOrgNodeId(orgNodeByLevel, level);
    if (!nodeId) continue;
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node?.name) {
      parts.push(formatOrgNodeOptionLabel(tree, node));
    }
  }
  return parts.join(' / ');
}

export function sortStructureNodes(list: OrganizationStructureNode[]): OrganizationStructureNode[] {
  return [...list].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

export function buildChildrenByParentId(
  nodes: OrganizationStructureNode[]
): Map<string, OrganizationStructureNode[]> {
  const map = new Map<string, OrganizationStructureNode[]>();
  for (const n of nodes) {
    const key = n.parentNodeId ? String(n.parentNodeId) : '__root__';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  for (const [k, arr] of map.entries()) {
    map.set(k, sortStructureNodes(arr));
  }
  return map;
}

/** Checked ids for the tree UI (includes ancestors of mapped units). */
export function getCheckedOrgNodeIdsForTree(
  orgNodeByLevel: OrgNodeByLevel,
  secondaryOrgNodeIds: string[],
  tree: OrganizationStructureTree | null | undefined
): Set<string> {
  const set = new Set<string>();
  const addWithAncestors = (nodeId: string) => {
    if (!nodeId || !tree) return;
    set.add(nodeId);
    const node = tree.nodes.find((n) => n.id === nodeId);
    for (const aid of node?.pathIds ?? []) {
      if (aid) set.add(aid);
    }
  };
  for (const id of Object.values(orgNodeByLevel)) addWithAncestors(id);
  for (const id of secondaryOrgNodeIds) addWithAncestors(id);
  return set;
}

function hasSelectedDescendant(
  ancestorId: string,
  selected: Set<string>,
  tree: OrganizationStructureTree
): boolean {
  for (const id of selected) {
    if (id === ancestorId) continue;
    const node = tree.nodes.find((n) => n.id === id);
    if (node?.pathIds?.includes(ancestorId)) return true;
  }
  return false;
}

export function toggleOrgStructureNodeSelection(
  nodeId: string,
  checked: boolean,
  selected: Set<string>,
  tree: OrganizationStructureTree
): Set<string> {
  const node = tree.nodes.find((n) => n.id === nodeId);
  if (!node) return selected;

  const next = new Set(selected);
  if (checked) {
    next.add(nodeId);
    for (const aid of node.pathIds ?? []) {
      if (aid) next.add(aid);
    }
    return next;
  }

  next.delete(nodeId);
  for (const aid of [...(node.pathIds ?? [])].reverse()) {
    if (aid && !hasSelectedDescendant(aid, next, tree)) {
      next.delete(aid);
    }
  }
  return next;
}

export function pickPrimaryOrgNodeId(
  selectedIds: Iterable<string>,
  tree: OrganizationStructureTree | null | undefined
): string | null {
  if (!tree) return null;
  const rootId = tree.rootNode?.id;
  let best: OrganizationStructureNode | null = null;

  for (const id of selectedIds) {
    const node = tree.nodes.find((n) => n.id === id);
    if (!node || node.status === 'archived' || node.id === rootId) continue;
    if (!best) {
      best = node;
      continue;
    }
    if (node.levelNumber > best.levelNumber) {
      best = node;
    } else if (
      node.levelNumber === best.levelNumber &&
      (node.pathIds?.length ?? 0) > (best.pathIds?.length ?? 0)
    ) {
      best = node;
    }
  }
  return best?.id ?? null;
}

export function syncOrgMappingFromSelectedIds(
  selectedIds: Iterable<string>,
  tree: OrganizationStructureTree | null | undefined
): { orgNodeByLevel: OrgNodeByLevel; secondaryOrgNodeIds: string[] } {
  if (!tree) {
    return { orgNodeByLevel: {}, secondaryOrgNodeIds: [] };
  }

  const rootId = tree.rootNode?.id;
  const selected = new Set(selectedIds);
  const primaryId = pickPrimaryOrgNodeId(selected, tree);
  const orgNodeByLevel = primaryId
    ? normalizeOrgNodeByLevel(deriveOrgNodeByLevelFromPrimary(tree, primaryId), tree.levels)
    : {};

  const primaryPath = new Set(tree.nodes.find((n) => n.id === primaryId)?.pathIds ?? []);
  const secondaryOrgNodeIds: string[] = [];

  for (const id of selected) {
    if (!id || id === primaryId || id === rootId) continue;
    if (primaryPath.has(id)) continue;
    const node = tree.nodes.find((n) => n.id === id);
    if (node && node.status !== 'archived') {
      secondaryOrgNodeIds.push(id);
    }
  }

  return { orgNodeByLevel, secondaryOrgNodeIds };
}

export function formatMappedOrgNodesSummary(
  tree: OrganizationStructureTree | null | undefined,
  orgNodeByLevel: OrgNodeByLevel,
  secondaryOrgNodeIds: string[]
): string {
  const primary = formatOrgNodeByLevelSummary(tree, orgNodeByLevel);
  const secondaryLabels = secondaryOrgNodeIds
    .map((id) => {
      const node = tree?.nodes.find((n) => n.id === id);
      return node ? formatOrgNodeOptionLabel(tree, node) : '';
    })
    .filter(Boolean);

  if (primary && secondaryLabels.length > 0) {
    return `${primary} + ${secondaryLabels.length} more`;
  }
  if (primary) return primary;
  if (secondaryLabels.length > 0) {
    return secondaryLabels.slice(0, 2).join(', ') + (secondaryLabels.length > 2 ? '…' : '');
  }
  return '';
}
