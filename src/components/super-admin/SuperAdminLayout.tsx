import React from 'react';
import { SuperAdminSidebar } from './SuperAdminSidebar';
import { SuperAdminHeader } from './SuperAdminHeader';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({
  children,
  breadcrumbs,
  showSearch,
  searchPlaceholder,
}) => {
  return (
    <div className="flex h-screen overflow-hidden bg-super-admin-background-light dark:bg-super-admin-background-dark">
      <SuperAdminSidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <SuperAdminHeader
          breadcrumbs={breadcrumbs}
          showSearch={showSearch}
          searchPlaceholder={searchPlaceholder}
        />
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-super-admin-background-light dark:bg-super-admin-background-dark">
          {children}
        </div>
      </main>
    </div>
  );
};

