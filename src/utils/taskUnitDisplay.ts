/** Parse task unit label from API task row (org_structure_path JSON or legacy columns). */

export function formatOrgStructureSegmentLabel(
  segment: Record<string, unknown> | string | null | undefined
): string {
  if (segment == null) return '';
  if (typeof segment === 'string') return segment.trim();

  const name = String(segment.name ?? '').trim();
  const levelLabel = String(segment.levelLabel ?? segment.level_label ?? '').trim();
  const code = String(segment.code ?? '').trim();
  const base = levelLabel && name ? `${levelLabel}: ${name}` : name || levelLabel;
  if (!base) return '';
  return code ? `${base} [${code}]` : base;
}

function parseOrgPathSegments(path: unknown): Array<Record<string, unknown> | string> {
  if (path == null) return [];

  if (typeof path === 'string') {
    const trimmed = path.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return parseOrgPathSegments(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }

  if (Array.isArray(path)) {
    return path.filter((segment) => segment != null) as Array<Record<string, unknown> | string>;
  }

  if (typeof path === 'object') {
    const record = path as Record<string, unknown>;
    if (Array.isArray(record.path)) {
      return parseOrgPathSegments(record.path);
    }
  }

  return [];
}

/** Selected org unit label (same as task create dropdown), not full hierarchy path. */
export function deriveTaskUnitFromOrgPath(path: unknown): string | null {
  const segments = parseOrgPathSegments(path);
  if (segments.length === 0) return null;
  const label = formatOrgStructureSegmentLabel(segments[segments.length - 1]);
  return label || null;
}

/** Full hierarchy path. */
export function deriveOrgStructurePathDisplay(path: unknown): string | null {
  if (path == null) return null;

  if (typeof path === 'string') {
    const trimmed = path.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return deriveOrgStructurePathDisplay(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (Array.isArray(path)) {
    const names = path
      .map((segment) => {
        if (segment == null) return '';
        if (typeof segment === 'string') return segment.trim();
        if (typeof segment === 'object') {
          const record = segment as Record<string, unknown>;
          const name = record.name ?? record.label ?? record.title;
          return typeof name === 'string' ? name.trim() : '';
        }
        return '';
      })
      .filter(Boolean);
    if (names.length > 0) return names.join(' > ');
  }

  if (typeof path === 'object') {
    const record = path as Record<string, unknown>;
    const display = record.pathDisplay ?? record.display;
    if (typeof display === 'string' && display.trim()) return display.trim();
  }

  return null;
}

function normalizeLegacyTaskUnitString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes(' > ')) return trimmed;
  const parts = trimmed.split(' > ').map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

export function resolveTaskUnitLabel(taskLike: Record<string, unknown> | null | undefined): string | null {
  if (!taskLike) return null;

  const fromPath = deriveTaskUnitFromOrgPath(taskLike.org_structure_path ?? taskLike.orgStructurePath);
  if (fromPath) return fromPath;

  for (const key of [
    'task_unit',
    'taskUnit',
    'task_unit_name',
    'taskUnitName',
    'org_structure_path_display',
    'orgStructurePathDisplay',
  ]) {
    const value = taskLike[key];
    if (typeof value === 'string' && value.trim()) {
      const normalized = normalizeLegacyTaskUnitString(value);
      if (key.includes('path_display') || key.includes('PathDisplay')) {
        if (normalized.includes(' > ')) {
          return normalizeLegacyTaskUnitString(normalized);
        }
      }
      return normalized;
    }
  }

  return null;
}

const UNIT_PREFERENCE_MAP: Record<string, { label: string; keys: string[] }> = {
  cost_centre: {
    label: 'Cost centre',
    keys: ['cost_centre_name', 'costCentreName', 'cost_center_name', 'costCenterName', 'cost_centre', 'costCentre'],
  },
  department: { label: 'Department', keys: ['department_name', 'departmentName', 'department'] },
  depot: { label: 'Depot', keys: ['depot_name', 'depotName', 'depot'] },
  branch: { label: 'Branch', keys: ['branch_name', 'branchName', 'branch'] },
  entity: { label: 'Entity', keys: ['entity_name', 'entityName', 'client_name', 'clientName'] },
  warehouse: { label: 'Warehouse', keys: ['warehouse_name', 'warehouseName', 'warehouse'] },
  project: { label: 'Project', keys: ['project_name', 'projectName', 'project'] },
  factory: { label: 'Factory', keys: ['factory_name', 'factoryName', 'factory'] },
  org_unit: {
    label: 'Organization unit',
    keys: ['task_unit', 'taskUnit', 'org_structure_path', 'orgStructurePath'],
  },
};

/** Resolve unit label for dashboards (preference + org_structure_path JSON). */
export function resolveTaskUnitForPreference(
  taskLike: Record<string, unknown> | null | undefined,
  preference: string
): string | null {
  const prefKey = preference === 'org_node' ? 'org_unit' : preference;
  const chosen = UNIT_PREFERENCE_MAP[prefKey] || UNIT_PREFERENCE_MAP.org_unit;

  if (prefKey === 'org_unit') {
    return resolveTaskUnitLabel(taskLike);
  }

  const lookupKeys = [...chosen.keys, 'task_unit', 'taskUnit', 'task_unit_name', 'taskUnitName'];
  const stringValue = lookupKeys.map((k) => taskLike?.[k]).find((v) => typeof v === 'string' && v.trim());
  if (stringValue) return String(stringValue).trim();
  return resolveTaskUnitLabel(taskLike);
}

export function resolveTaskUnitCardFields(
  taskLike: Record<string, unknown> | null | undefined,
  preference: string
): { unitType: string; unitName: string } {
  const prefKey = preference === 'org_node' ? 'org_unit' : preference;
  const chosen = UNIT_PREFERENCE_MAP[prefKey] || UNIT_PREFERENCE_MAP.org_unit;
  const unitName = resolveTaskUnitForPreference(taskLike, preference) || '-';
  return { unitType: chosen.label, unitName };
}
