/** Predefined field values per org-structure level (L1–L11). */
export const LEVEL_ENTITY_TYPE_OPTIONS: Record<number, readonly string[]> = {
  1: [
    'Group',
    'Enterprise',
    'Corporate Group',
    'Global Group',
    'Business Group',
    'Conglomerate',
    'Custom',
  ],
  2: [
    'Holding Company',
    'Company',
    'Subsidiary',
    'Associate Company',
    'Joint Venture',
    'LLP',
    'Partnership Firm',
    'Proprietorship',
    'Trust',
    'Society',
    'Foundation',
    'NGO',
    'Foreign Entity',
    'Branch Entity',
    'SPV',
    'Section 8 Company',
    'Custom',
  ],
  3: [
    'Region',
    'Country',
    'State',
    'Zone',
    'Territory',
    'Cluster',
    'Area',
    'Circle',
    'District',
    'Market',
    'Geography',
    'Custom',
  ],
  4: [
    'Business Unit',
    'Strategic Business Unit (SBU)',
    'Division',
    'Vertical',
    'Service Line',
    'Product Line',
    'Shared Services',
    'Functional Unit',
    'Custom',
  ],
  5: [
    'Registered Office',
    'Corporate Office',
    'Head Office',
    'Branch',
    'Warehouse',
    'Depot',
    'Delivery Center',
    'Retail Store',
    'Service Center',
    'Project Site',
    'Plant',
    'Factory',
    'Yard',
    'Facility',
    'Delivery Hub',
    'Custom',
  ],
  6: ['Department', 'Section', 'Team', 'Custom'],
  7: ['Project', 'Program', 'Custom'],
  8: ['Production Unit', 'Manufacturing Unit', 'Custom'],
  9: ['Distribution Centre', 'Logistics Hub', 'Storage Facility', 'Custom'],
  10: ['Cost Centre', 'Profit Centre', 'Budget Unit', 'Expense Unit', 'Revenue Unit', 'Custom'],
  11: ['Custom Unit', 'Custom'],
};

export type OrgLevelDefinition = {
  levelNumber: number;
  headerCategory: string;
  fieldValues: readonly string[];
};

const MAX_DEFINED_LEVEL = 11;

/** Header categories and field values aligned to the org hierarchy spreadsheet. */
export const ORG_LEVEL_DEFINITIONS: readonly OrgLevelDefinition[] = [
  { levelNumber: 1, headerCategory: 'Group', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[1] },
  { levelNumber: 2, headerCategory: 'Entity', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[2] },
  { levelNumber: 3, headerCategory: 'Region', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[3] },
  { levelNumber: 4, headerCategory: 'Business Unit', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[4] },
  { levelNumber: 5, headerCategory: 'Location', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[5] },
  { levelNumber: 6, headerCategory: 'Department', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[6] },
  { levelNumber: 7, headerCategory: 'Project', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[7] },
  { levelNumber: 8, headerCategory: 'Manufacturing Unit', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[8] },
  { levelNumber: 9, headerCategory: 'Warehouse / Distribution', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[9] },
  { levelNumber: 10, headerCategory: 'Financial Unit', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[10] },
  { levelNumber: 11, headerCategory: 'Custom Unit', fieldValues: LEVEL_ENTITY_TYPE_OPTIONS[11] },
];

export function getOrgLevelDefinition(levelNumber?: number): OrgLevelDefinition | undefined {
  if (!levelNumber || levelNumber < 1 || levelNumber > MAX_DEFINED_LEVEL) {
    return undefined;
  }
  return ORG_LEVEL_DEFINITIONS.find((def) => def.levelNumber === levelNumber);
}

export function getOrgLevelDefinitionByHeader(headerCategory?: string): OrgLevelDefinition | undefined {
  const normalized = String(headerCategory || '').trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  return ORG_LEVEL_DEFINITIONS.find((def) => def.headerCategory.toLowerCase() === normalized);
}

/** All sections available when adding a child after Group (names only, not ordered slots). */
export function getOrgLevelChoicesForChild(): readonly OrgLevelDefinition[] {
  return ORG_LEVEL_DEFINITIONS.filter((def) => def.levelNumber >= 2);
}

export function getEntityTypeOptionsForLevel(levelNumber?: number): readonly string[] {
  if (!levelNumber) {
    return [];
  }
  return LEVEL_ENTITY_TYPE_OPTIONS[levelNumber] || [];
}

export function getEntityTypeOptionsForSection(headerCategory?: string): readonly string[] {
  const def = getOrgLevelDefinitionByHeader(headerCategory);
  return def?.fieldValues || [];
}

export function normalizeEntityTypeSelection(rawType: string, sectionOrLevel?: string | number) {
  const normalized = rawType.trim();
  if (!normalized) {
    return {
      selectedEntityType: '',
      customEntityType: '',
    };
  }

  const options =
    typeof sectionOrLevel === 'string'
      ? getEntityTypeOptionsForSection(sectionOrLevel)
      : getEntityTypeOptionsForLevel(sectionOrLevel);
  if (options.includes(normalized)) {
    return {
      selectedEntityType: normalized,
      customEntityType: '',
    };
  }

  return {
    selectedEntityType: 'Custom',
    customEntityType: normalized,
  };
}
