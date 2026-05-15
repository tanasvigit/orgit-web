/** Predefined entity/section types per org-structure level (L1–L11). */
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

const MAX_DEFINED_LEVEL = 11;

export function getEntityTypeOptionsForLevel(levelNumber: number): readonly string[] {
  const level = Math.max(1, Math.floor(levelNumber));
  return LEVEL_ENTITY_TYPE_OPTIONS[level] ?? LEVEL_ENTITY_TYPE_OPTIONS[MAX_DEFINED_LEVEL];
}

export function normalizeEntityTypeSelection(rawType: string, levelNumber: number) {
  const normalized = rawType.trim();
  if (!normalized) {
    return {
      selectedEntityType: '',
      customEntityType: '',
    };
  }

  const options = getEntityTypeOptionsForLevel(levelNumber);
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
