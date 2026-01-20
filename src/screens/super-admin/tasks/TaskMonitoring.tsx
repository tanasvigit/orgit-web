import React from 'react';
import { useQuery } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import api from '../../../services/api';

export const TaskMonitoring: React.FC = () => {
  const { data: stats, isLoading } = useQuery(
    'taskMonitoring',
    () => api.get('/super-admin/tasks/statistics').then((res) => res.data.data)
  );

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">Loading...</div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout
      breadcrumbs={[{ label: 'Task Monitoring' }]}
      showSearch
      searchPlaceholder="Search tasks..."
    >
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Task Monitoring</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">Cross-organization task analytics</p>
        </div>

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Organizations</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalOrganizations || 0}</p>
            </div>
            <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalTasks || 0}</p>
            </div>
            <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Tasks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.taskStats?.activeTasks || 0}</p>
            </div>
            <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Overdue Tasks</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.taskStats?.overdueTasks || 0}</p>
            </div>
          </div>
        )}

        {stats?.organizationStats && stats.organizationStats.length > 0 && (
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Organization Task Breakdown</h3>
            <div className="space-y-2">
              {stats.organizationStats.map((org: any) => (
                <div key={org.organizationId} className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                  <p className="font-medium text-gray-900 dark:text-white">{org.organizationName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total: {org.totalTasks} | Active: {org.activeTasks} | Overdue: {org.overdueTasks}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
};

