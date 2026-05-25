import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  AppModule,
  bypassEmployeePermissions,
  getEffectivePermissions,
  hasModuleAccess,
} from '../utils/employeePermissionUtils';
import type { EmployeePermissions } from '../screens/admin/employees/employeeMasterTypes';

export function useEmployeePermissions() {
  const { user } = useAuth();

  const permissions = useMemo(
    () => getEffectivePermissions(user?.role, user?.employeePermissions),
    [user?.role, user?.employeePermissions]
  );

  const bypass = bypassEmployeePermissions(user?.role);

  return useMemo(() => {
    const canAccessModule = (module: AppModule) =>
      bypass || hasModuleAccess(permissions, module);

    const can = (check: (p: EmployeePermissions) => boolean) => bypass || check(permissions);

    return {
      bypass,
      permissions,
      canAccessModule,
      canCreate: () => can((p) => !!p.rights?.create),
      canEdit: () => can((p) => !!p.rights?.edit),
      canDelete: () => can((p) => !!p.rights?.delete),
      canApprove: () => can((p) => !!p.rights?.approve),
      canView: () => can((p) => !!p.rights?.view),
      canCreateTask: () => can((p) => !!p.taskRights?.createTask),
      canAssignTask: () => can((p) => !!p.taskRights?.assignTask),
      canReassignTask: () => can((p) => !!p.taskRights?.reassignTask),
      canCloseTask: () => can((p) => !!p.taskRights?.closeTask),
      canEscalateTask: () => can((p) => !!p.taskRights?.escalateTask),
      canViewTeamTasks: () => can((p) => !!p.taskRights?.viewTeamTasks),
      canUploadDocument: () => can((p) => !!p.documentRights?.upload),
      canEditDocument: () => can((p) => !!p.documentRights?.edit),
      canDownloadDocument: () => can((p) => !!p.documentRights?.download),
      canViewDocument: () => can((p) => !!p.documentRights?.view),
    };
  }, [bypass, permissions]);
}
