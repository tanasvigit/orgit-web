import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEmployeePermissions } from '../../hooks/useEmployeePermissions';
import { AppModule, firstAllowedModulePath } from '../../utils/employeePermissionUtils';

type Props = {
  module: AppModule;
  children: React.ReactNode;
};

export const ModuleAccessRoute: React.FC<Props> = ({ module, children }) => {
  const { user, isLoading } = useAuth();
  const { canAccessModule } = useEmployeePermissions();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessModule(module)) {
    const fallback = firstAllowedModulePath(user.role, user.employeePermissions);
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};
