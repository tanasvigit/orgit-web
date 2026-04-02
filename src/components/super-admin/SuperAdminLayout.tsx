import React, { useRef } from 'react';
import { SuperAdminSidebar } from './SuperAdminSidebar';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = (props) => {
  const { children } = props;
  const sidebarToggleRef = useRef<(() => void) | undefined>(undefined);

  return (
    <div className="flex h-screen overflow-hidden bg-super-admin-background-light dark:bg-super-admin-background-dark">
      <SuperAdminSidebar onToggleRef={sidebarToggleRef} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-super-admin-background-light dark:bg-super-admin-background-dark">
          {children}
        </div>
      </main>
    </div>
  );
};

