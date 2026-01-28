import React from 'react';
import { useQuery } from 'react-query';
import { SuperAdminLayout } from '../../components/super-admin/SuperAdminLayout';
import { superAdminService } from '../../services/superAdminService';

export const Dashboard: React.FC = () => {
  const { data: dashboardData, isLoading } = useQuery(
    'superAdminDashboard',
    () => superAdminService.getDashboardStats().then((res) => res.data.data)
  );

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-super-admin-primary">Loading...</div>
        </div>
      </SuperAdminLayout>
    );
  }

  const stats = dashboardData || {
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalUsers: 0,
    activeUsers: 0,
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    recentActivity: [],
  };

  const statCards = [
    { label: 'Total Organizations', value: stats.totalOrganizations, icon: 'domain', bgColor: 'bg-blue-100 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-400' },
    { label: 'Active Organizations', value: stats.activeOrganizations, icon: 'check_circle', bgColor: 'bg-green-100 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400' },
    { label: 'Total Users', value: stats.totalUsers, icon: 'people', bgColor: 'bg-purple-100 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-400' },
    { label: 'Active Users', value: stats.activeUsers, icon: 'person_check', bgColor: 'bg-indigo-100 dark:bg-indigo-900/20', iconColor: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Tasks', value: stats.totalTasks, icon: 'task', bgColor: 'bg-orange-100 dark:bg-orange-900/20', iconColor: 'text-orange-600 dark:text-orange-400' },
    { label: 'Active Tasks', value: stats.activeTasks, icon: 'play_circle', bgColor: 'bg-yellow-100 dark:bg-yellow-900/20', iconColor: 'text-yellow-600 dark:text-yellow-400' },
    { label: 'Completed Tasks', value: stats.completedTasks, icon: 'done_all', bgColor: 'bg-green-100 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-400' },
    { label: 'Overdue Tasks', value: stats.overdueTasks, icon: 'warning', bgColor: 'bg-red-100 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <SuperAdminLayout breadcrumbs={[{ label: 'Dashboard' }]}>
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Super Admin Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
            Platform-level overview and statistics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${card.bgColor} shrink-0 p-2.5 box-border`}>
                  <span className={`material-symbols-outlined text-base ${card.iconColor} leading-none block`}>
                    {card.icon}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((activity: any, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                    <span className="material-symbols-outlined text-gray-400">
                      {activity.type === 'organization_created' ? 'domain' :
                       activity.type === 'user_registered' ? 'person_add' : 'task'}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 dark:text-white">{activity.description}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
              )}
            </div>
          </div>

          <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <a
                href="/super-admin/organizations"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-super-admin-primary">domain</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Manage Organizations</span>
              </a>
              <a
                href="/super-admin/document-templates"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-super-admin-primary">description</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Manage Document Templates</span>
              </a>
              {/* <a
                href="/super-admin/compliance"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="material-symbols-outlined text-super-admin-primary">verified_user</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Manage Compliance</span>
              </a> */}
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
};

