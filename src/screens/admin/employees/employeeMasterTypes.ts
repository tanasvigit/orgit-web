export type EmployeeRights = {
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  view: boolean;
};

export type EmployeeTaskRights = {
  createTask: boolean;
  assignTask: boolean;
  reassignTask: boolean;
  closeTask: boolean;
  escalateTask: boolean;
  viewTeamTasks: boolean;
};

export type EmployeeWorkflowRoles = {
  preparedBy: boolean;
  reviewedBy: boolean;
  approvedBy: boolean;
  verifiedBy: boolean;
  escalation: boolean;
};

export type EmployeeDocumentRights = {
  upload: boolean;
  edit: boolean;
  approve: boolean;
  reject: boolean;
  download: boolean;
  view: boolean;
};

export type EmployeePermissions = {
  moduleAccess: string[];
  rights: EmployeeRights;
  taskRights: EmployeeTaskRights;
  workflowRoles: EmployeeWorkflowRoles;
  documentRights: EmployeeDocumentRights;
};

export type EmployeeNotificationSettings = {
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  taskReminders: boolean;
  escalationAlerts: boolean;
};

export const EMPLOYMENT_TYPE_OPTIONS = ['Permanent', 'Contract'] as const;
export const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;
export const MODULE_ACCESS_OPTIONS = ['All', 'Messaging', 'Dashboard', 'Tasks', 'Documents'] as const;

export const DEFAULT_EMPLOYEE_PERMISSIONS: EmployeePermissions = {
  moduleAccess: ['Tasks', 'Messaging'],
  rights: { create: false, edit: true, delete: false, approve: false, view: true },
  taskRights: {
    createTask: false,
    assignTask: false,
    reassignTask: false,
    closeTask: true,
    escalateTask: false,
    viewTeamTasks: true,
  },
  workflowRoles: {
    preparedBy: true,
    reviewedBy: false,
    approvedBy: false,
    verifiedBy: false,
    escalation: false,
  },
  documentRights: {
    upload: false,
    edit: false,
    approve: false,
    reject: false,
    download: true,
    view: true,
  },
};

export const DEFAULT_NOTIFICATION_SETTINGS: EmployeeNotificationSettings = {
  inApp: true,
  email: true,
  whatsapp: false,
  taskReminders: true,
  escalationAlerts: true,
};

export function parsePermissions(raw: unknown): EmployeePermissions {
  if (!raw || typeof raw !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_EMPLOYEE_PERMISSIONS));
  }
  const p = raw as EmployeePermissions;
  return {
    moduleAccess: Array.isArray(p.moduleAccess) ? p.moduleAccess : DEFAULT_EMPLOYEE_PERMISSIONS.moduleAccess,
    rights: { ...DEFAULT_EMPLOYEE_PERMISSIONS.rights, ...p.rights },
    taskRights: { ...DEFAULT_EMPLOYEE_PERMISSIONS.taskRights, ...p.taskRights },
    workflowRoles: { ...DEFAULT_EMPLOYEE_PERMISSIONS.workflowRoles, ...p.workflowRoles },
    documentRights: { ...DEFAULT_EMPLOYEE_PERMISSIONS.documentRights, ...p.documentRights },
  };
}

export function parseNotifications(raw: unknown): EmployeeNotificationSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...(raw as EmployeeNotificationSettings) };
}

export type EmployeeMasterFormState = {
  employeeCode: string;
  name: string;
  mobile: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  panNumber: string;
  dateOfJoining: string;
  employmentType: string;
  status: string;
  designation: string;
  reportingTo: string;
  workLocationNodeId: string;
  orgNodeByLevel: Record<string, string>;
  secondaryOrgNodeIds: string[];
  permissions: EmployeePermissions;
  notifications: EmployeeNotificationSettings;
  password: string;
};

export function buildInitialMasterForm(employee?: Record<string, unknown> | null): EmployeeMasterFormState {
  const perms = parsePermissions(employee?.employeePermissions ?? employee?.employee_permissions);
  const notif = parseNotifications(employee?.notificationSettings ?? employee?.notification_settings);
  return {
    employeeCode: String(employee?.employeeCode ?? employee?.employee_code ?? ''),
    name: String(employee?.name ?? ''),
    mobile: String(employee?.mobile ?? ''),
    email: String(employee?.email ?? ''),
    dateOfBirth: String(employee?.dateOfBirth ?? employee?.date_of_birth ?? '').slice(0, 10),
    gender: String(employee?.gender ?? ''),
    address: String(employee?.address ?? ''),
    panNumber: String(employee?.panNumber ?? employee?.pan_number ?? ''),
    dateOfJoining: String(employee?.dateOfJoining ?? employee?.date_of_joining ?? '').slice(0, 10),
    employmentType: String(employee?.employmentType ?? employee?.employment_type ?? 'Permanent'),
    status: employee?.status === 'inactive' ? 'inactive' : 'active',
    designation: String(employee?.designation ?? ''),
    reportingTo: String(employee?.reportingTo ?? employee?.reporting_to ?? ''),
    workLocationNodeId: String(
      employee?.workLocationNodeId ?? employee?.work_location_node_id ?? ''
    ),
    orgNodeByLevel: {},
    secondaryOrgNodeIds: Array.isArray(employee?.secondaryOrgNodeIds)
      ? (employee?.secondaryOrgNodeIds as string[])
      : Array.isArray(employee?.secondary_org_node_ids)
        ? (employee?.secondary_org_node_ids as string[])
        : [],
    permissions: perms,
    notifications: notif,
    password: '',
  };
}
