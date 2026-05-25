import {
  DEFAULT_EMPLOYEE_PERMISSIONS,
  EmployeePermissions,
  parsePermissions,
} from '../screens/admin/employees/employeeMasterTypes';

export type AppModule = 'Messaging' | 'Dashboard' | 'Tasks' | 'Documents';

export function bypassEmployeePermissions(role: string | undefined): boolean {
  return role === 'super_admin' || role === 'admin';
}

export function hasModuleAccess(permissions: EmployeePermissions, module: AppModule): boolean {
  const modules = permissions.moduleAccess || [];
  if (modules.some((m) => String(m).toLowerCase() === 'all')) return true;
  return modules.some((m) => String(m).toLowerCase() === module.toLowerCase());
}

export function getEffectivePermissions(
  role: string | undefined,
  raw: unknown
): EmployeePermissions {
  if (bypassEmployeePermissions(role)) {
    return parsePermissions({
      moduleAccess: ['All'],
      rights: { create: true, edit: true, delete: true, approve: true, view: true },
      taskRights: {
        createTask: true,
        assignTask: true,
        reassignTask: true,
        closeTask: true,
        escalateTask: true,
        viewTeamTasks: true,
      },
      workflowRoles: DEFAULT_EMPLOYEE_PERMISSIONS.workflowRoles,
      documentRights: {
        upload: true,
        edit: true,
        approve: true,
        reject: true,
        download: true,
        view: true,
      },
    });
  }
  return parsePermissions(raw);
}

export function firstAllowedModulePath(
  role: string | undefined,
  raw: unknown
): string {
  const perms = getEffectivePermissions(role, raw);
  const order: { module: AppModule; path: string }[] = [
    { module: 'Dashboard', path: '/dashboard' },
    { module: 'Messaging', path: '/messages' },
    { module: 'Tasks', path: '/tasks' },
    { module: 'Documents', path: '/documents' },
  ];
  for (const item of order) {
    if (hasModuleAccess(perms, item.module)) return item.path;
  }
  return '/dashboard';
}
