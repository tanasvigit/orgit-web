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

export function getActiveLevelsFromL2(levels: OrganizationStructureLevel[]): OrganizationStructureLevel[] {
  return [...levels]
    .filter((l) => l.levelNumber > 1 && l.isActive !== false)
    .sort((a, b) => a.levelNumber - b.levelNumber);
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
  node: OrganizationStructureNode
): string {
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
  const levels = getActiveLevelsFromL2(tree.levels);
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
