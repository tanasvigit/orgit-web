import type {
  OrganizationStructureLevel,
  OrganizationStructureNode,
  OrganizationStructureTree,
} from '../services/settingsService';

export const EMPLOYEE_ORG_NODE_BY_LEVEL_KEY = 'orgNodeByLevel';

export type OrgNodeByLevel = Record<string, string>;

export function getActiveLevelsFromL2(levels: OrganizationStructureLevel[]): OrganizationStructureLevel[] {
  return [...levels]
    .filter((l) => l.levelNumber > 1 && l.isActive !== false)
    .sort((a, b) => a.levelNumber - b.levelNumber);
}

export function getParentNodeIdForLevel(
  levelNumber: number,
  orgNodeByLevel: OrgNodeByLevel,
  rootNodeId: string | null | undefined
): string | null {
  if (levelNumber <= 2) {
    return rootNodeId || null;
  }
  return orgNodeByLevel[String(levelNumber - 1)] || null;
}

export function getNodesAtLevel(
  nodes: OrganizationStructureNode[],
  levelNumber: number,
  parentNodeId: string | null
): OrganizationStructureNode[] {
  if (!parentNodeId) return [];
  return nodes
    .filter(
      (n) =>
        n.levelNumber === levelNumber &&
        n.status !== 'archived' &&
        n.parentNodeId === parentNodeId
    )
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

export function deriveOrgNodeByLevelFromPrimary(
  tree: OrganizationStructureTree | null | undefined,
  primaryNodeId: string | null | undefined
): OrgNodeByLevel {
  if (!tree || !primaryNodeId) return {};
  const node = tree.nodes.find((n) => n.id === primaryNodeId);
  if (!node) return {};

  const out: OrgNodeByLevel = {};
  for (const item of node.path || []) {
    if (item.levelNumber > 1) {
      out[String(item.levelNumber)] = item.id;
    }
  }
  if (node.levelNumber > 1) {
    out[String(node.levelNumber)] = node.id;
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
      out[key] = value.trim();
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
    const id = orgNodeByLevel[String(levelsFromL2[i].levelNumber)];
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

export function formatOrgNodeByLevelSummary(
  tree: OrganizationStructureTree | null | undefined,
  orgNodeByLevel: OrgNodeByLevel
): string {
  if (!tree) return '';
  const levels = getActiveLevelsFromL2(tree.levels);
  const parts: string[] = [];
  for (const level of levels) {
    const nodeId = orgNodeByLevel[String(level.levelNumber)];
    if (!nodeId) continue;
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node?.name) parts.push(node.name);
  }
  return parts.join(' / ');
}
