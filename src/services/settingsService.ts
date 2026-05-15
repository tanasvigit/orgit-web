import api from './api';

// Departments
export const getDepartments = async () => {
  const response = await api.get('/admin/departments');
  return response.data;
};

export const createDepartment = async (data: { name: string; description?: string }) => {
  const response = await api.post('/admin/departments', data);
  return response.data;
};

export const updateDepartment = async (id: string, data: { name: string; description?: string }) => {
  const response = await api.put(`/admin/departments/${id}`, data);
  return response.data;
};

export const deleteDepartment = async (id: string) => {
  const response = await api.delete(`/admin/departments/${id}`);
  return response.data;
};

// Designations
export const getDesignations = async () => {
  const response = await api.get('/admin/designations');
  return response.data;
};

export const createDesignation = async (data: { name: string; description?: string; level?: string }) => {
  const response = await api.post('/admin/designations', data);
  return response.data;
};

export const updateDesignation = async (id: string, data: { name: string; description?: string; level?: string }) => {
  const response = await api.put(`/admin/designations/${id}`, data);
  return response.data;
};

export const deleteDesignation = async (id: string) => {
  const response = await api.delete(`/admin/designations/${id}`);
  return response.data;
};

// Reminder Configuration
export const getReminderConfig = async () => {
  const response = await api.get('/admin/settings/reminder');
  return response.data;
};

export const updateReminderConfig = async (data: {
  dueSoonDays?: number;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  reminderIntervals?: number[];
}) => {
  const response = await api.put('/admin/settings/reminder', data);
  return response.data;
};

// Auto Escalation Configuration
export const getAutoEscalationConfig = async () => {
  const response = await api.get('/admin/settings/auto-escalation');
  return response.data;
};

export const updateAutoEscalationConfig = async (data: {
  enabled?: boolean;
  unacceptedHours?: number;
  overdueDays?: number;
  missedRecurrenceEnabled?: boolean;
}) => {
  const response = await api.put('/admin/settings/auto-escalation', data);
  return response.data;
};

// Recurring Task Settings
export const getRecurringTaskSettings = async () => {
  const response = await api.get('/admin/settings/recurring-tasks');
  return response.data;
};

export const updateRecurringTaskSettings = async (data: {
  defaultFrequencies?: string[];
  autoCalculateDueDate?: boolean;
  escalationEnabled?: boolean;
}) => {
  const response = await api.put('/admin/settings/recurring-tasks', data);
  return response.data;
};

// Reporting Hierarchy
export const getReportingHierarchy = async () => {
  const response = await api.get('/organization/hierarchy');
  return response.data;
};

export const updateReportingHierarchy = async (data: any) => {
  const response = await api.put('/organization/hierarchy', data);
  return response.data;
};

export interface OrganizationStructureLevel {
  id: string;
  organizationId: string;
  levelNumber: number;
  levelKey: string;
  levelLabel: string;
  definitionSource: 'custom' | 'preset';
  presetKey?: string | null;
  fieldSchemaJson: OrganizationStructureFieldSchemaField[];
  isSystemRequired: boolean;
  isActive: boolean;
}

export interface OrganizationStructureFieldSchemaField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'pincode';
  required: boolean;
  options?: string[];
  placeholder?: string | null;
}

export interface OrganizationStructureNodePathItem {
  id: string;
  name: string;
  code?: string | null;
  levelNumber: number;
  levelKey: string;
  levelLabel: string;
  status: 'active' | 'inactive' | 'archived';
}

export interface OrganizationStructureNode {
  id: string;
  organizationId: string;
  levelId: string;
  levelNumber: number;
  levelKey: string;
  levelLabel: string;
  parentNodeId?: string | null;
  parentName?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  displayOrder: number;
  status: 'active' | 'inactive' | 'archived';
  isActive: boolean;
  metaJson?: Record<string, unknown>;
  fieldValues?: Record<string, unknown>;
  path: OrganizationStructureNodePathItem[];
  pathDisplay: string;
  pathCodes: Array<string | null | undefined>;
  pathIds: string[];
  hasChildren: boolean;
  childrenCount: number;
}

export interface OrganizationStructureTree {
  levels: OrganizationStructureLevel[];
  nodes: OrganizationStructureNode[];
  rootNode: OrganizationStructureNode | null;
  summary: {
    totalLevels: number;
    totalNodes: number;
    activeNodes: number;
    archivedNodes: number;
    hasRootGroup: boolean;
  };
}

export interface OrganizationStructureOperationalOptions {
  levels: OrganizationStructureLevel[];
  nodes: OrganizationStructureNode[];
  groupedByLevel: Array<{
    levelNumber: number;
    levelKey: string;
    levelLabel: string;
    nodes: Array<{
      id: string;
      name: string;
      code?: string | null;
      pathDisplay: string;
      parentNodeId?: string | null;
      levelNumber: number;
      levelKey: string;
      levelLabel: string;
    }>;
  }>;
}

export interface OrganizationStructureLegacyMapping {
  id: string;
  legacyType: string;
  legacyId?: string | null;
  legacyName: string;
  status: string;
  orgStructureNodeId: string;
  nodeName?: string;
  nodeCode?: string;
  nodeLevelLabel?: string;
}

export interface OrganizationStructureRollup {
  nodeId: string;
  name: string;
  code?: string | null;
  levelLabel: string;
  levelKey: string;
  levelNumber: number;
  pathDisplay: string;
  directTaskCount: number;
  rollupTaskCount: number;
  directEmployeeCount: number;
  rollupEmployeeCount: number;
  status: 'active' | 'inactive' | 'archived';
}

export const getOrganizationStructureTree = async (params?: {
  includeArchived?: boolean;
  includeInactive?: boolean;
}) => {
  const response = await api.get('/organization-structure/tree', { params });
  return response.data;
};

export const getOrganizationStructureLevels = async () => {
  const response = await api.get('/organization-structure/levels');
  return response.data;
};

export const getOrganizationStructureOperationalOptions = async () => {
  const response = await api.get('/organization-structure/operational-options');
  return response.data;
};

export const createOrganizationStructureNode = async (data: {
  relation: 'root' | 'child' | 'sibling';
  referenceNodeId?: string;
  name?: string;
  code?: string | null;
  description?: string;
  status?: 'active' | 'inactive' | 'archived';
  createLevelLabel?: string;
  createLevelDefinitionSource?: 'custom' | 'preset';
  createLevelPresetKey?: string | null;
  createLevelFieldSchema?: OrganizationStructureFieldSchemaField[];
  metaJson?: Record<string, unknown>;
  fieldValues?: Record<string, unknown>;
}) => {
  const response = await api.post('/organization-structure/nodes', data);
  return response.data;
};

export const updateOrganizationStructureNode = async (
  id: string,
  data: {
    name?: string;
    code?: string | null;
    description?: string | null;
    status?: 'active' | 'inactive' | 'archived';
    metaJson?: Record<string, unknown>;
    fieldValues?: Record<string, unknown>;
  }
) => {
  const response = await api.put(`/organization-structure/nodes/${id}`, data);
  return response.data;
};

export const updateOrganizationStructureLevel = async (
  id: string,
  data: {
    levelLabel?: string;
    definitionSource?: 'custom' | 'preset';
    presetKey?: string | null;
    fieldSchemaJson?: OrganizationStructureFieldSchemaField[];
    isActive?: boolean;
  }
) => {
  const response = await api.put(`/organization-structure/levels/${id}`, data);
  return response.data;
};

export const archiveOrganizationStructureNode = async (id: string) => {
  const response = await api.patch(`/organization-structure/nodes/${id}/archive`);
  return response.data;
};

export const deleteOrganizationStructureNode = async (id: string) => {
  const response = await api.delete(`/organization-structure/nodes/${id}`);
  return response.data;
};

export const getOrganizationStructureReportingRollups = async () => {
  const response = await api.get('/organization-structure/reporting/rollups');
  return response.data;
};

