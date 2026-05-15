import { useMemo } from 'react';
import type {
  OrganizationStructureLevel,
  OrganizationStructureNode,
  OrganizationStructureTree,
} from '../services/settingsService';

const DEFAULT_SCHEMA = [
  { id: 'name', key: 'name', label: 'Name', type: 'text' as const, required: true },
  { id: 'code', key: 'code', label: 'Code', type: 'text' as const, required: false },
];

export function getLevelSchema(
  levels: OrganizationStructureLevel[],
  levelNumber: number
) {
  const level = levels.find((l) => l.levelNumber === levelNumber);
  if (level?.fieldSchemaJson?.length) {
    return level.fieldSchemaJson;
  }
  return DEFAULT_SCHEMA;
}

export function getNodeById(nodes: OrganizationStructureNode[], nodeId: string) {
  return nodes.find((n) => n.id === nodeId) ?? null;
}

export function useOrgStructureLevelSchema(
  tree: OrganizationStructureTree | null | undefined,
  nodeId: string | null | undefined
) {
  return useMemo(() => {
    if (!tree || !nodeId) {
      return { node: null as OrganizationStructureNode | null, schema: DEFAULT_SCHEMA, levelNumber: 0 };
    }
    const node = getNodeById(tree.nodes, nodeId);
    if (!node) {
      return { node: null, schema: DEFAULT_SCHEMA, levelNumber: 0 };
    }
    return {
      node,
      schema: getLevelSchema(tree.levels, node.levelNumber),
      levelNumber: node.levelNumber,
    };
  }, [tree, nodeId]);
}
