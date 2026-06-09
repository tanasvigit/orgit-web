import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { BulkMasterUploadPanel } from '../../components/admin/BulkMasterUploadPanel';
import AnimatedList from '../../components/shared/AnimatedList';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  // Show All Settings when user is admin OR when on admin settings route (/admin/settings)
  const isAdmin = user?.role === 'admin' || location.pathname === '/admin/settings';

  const commonSettings = [
    { 
      icon: 'person', 
      title: 'Profile', 
      subtitle: 'Update your profile details', 
      screen: '/settings/profile',
      color: 'blue'
    },
    { 
      icon: 'lock', 
      title: 'Change Password', 
      subtitle: 'Update your password', 
      screen: '/settings/change-password',
      color: 'red'
    },
    {
      icon: 'tune',
      title: 'User configuration',
      subtitle: 'Default task timelines (start, target, due) and auto-escalation trigger for new tasks',
      screen: isAdmin ? '/admin/settings/user-config' : '/settings/user-config',
      color: 'indigo'
    },
  ];

  // Admin settings: organisation hierarchy and downstream mappings on one web screen.
  const adminSettingsCards = [
    {
      icon: 'account_tree',
      title: 'Organisation Structure',
      subtitle: 'Define all hierarchy levels, sections, and nodes in one place on web',
      screen: '/admin/settings/organisation-structure',
      color: 'indigo',
    },
    {
      icon: 'group',
      title: 'Employees',
      subtitle: 'Map employees and reporting using the defined organization structure',
      screen: '/admin/users',
      color: 'blue',
    },
    { 
      icon: 'list_alt', 
      title: 'Service List', 
      subtitle: 'RECURRING TASK TITLE/SERVICE LIST, FREQUENCY, TASK ROLL OUT, ONE TIME TASK LIST', 
      screen: '/admin/services',
      color: 'teal'
    },
    { 
      icon: 'groups', 
      title: 'Client List', 
      subtitle: 'Assign clients to org units and manage service coverage', 
      screen: '/admin/entities',
      color: 'pink'
    },
    {
      icon: 'tune',
      title: 'User configuration',
      subtitle: 'User roles, permissions, and module access',
      screen: '/admin/settings/user-config',
      color: 'orange',
    },
    { 
      icon: 'settings', 
      title: 'Automation & Configurations', 
      subtitle: 'Reminder configuration & auto escalation rules', 
      screen: '/admin/settings/reminder-config',
      color: 'cyan'
    },
  ];

  const getColorClasses = (color: string) => {
    // Used to theme just the icon/accent; list rows themselves stay minimal (no cards)
    const colors: Record<string, { iconBg: string; iconRing: string }> = {
      blue: {
        iconBg: 'bg-blue-500',
        iconRing: 'ring-blue-100 dark:ring-blue-900/40',
      },
      red: {
        iconBg: 'bg-red-500',
        iconRing: 'ring-red-100 dark:ring-red-900/40',
      },
      purple: {
        iconBg: 'bg-purple-500',
        iconRing: 'ring-purple-100 dark:ring-purple-900/40',
      },
      green: {
        iconBg: 'bg-green-500',
        iconRing: 'ring-green-100 dark:ring-green-900/40',
      },
      orange: {
        iconBg: 'bg-orange-500',
        iconRing: 'ring-orange-100 dark:ring-orange-900/40',
      },
      indigo: {
        iconBg: 'bg-indigo-500',
        iconRing: 'ring-indigo-100 dark:ring-indigo-900/40',
      },
      teal: {
        iconBg: 'bg-teal-500',
        iconRing: 'ring-teal-100 dark:ring-teal-900/40',
      },
      pink: {
        iconBg: 'bg-pink-500',
        iconRing: 'ring-pink-100 dark:ring-pink-900/40',
      },
      cyan: {
        iconBg: 'bg-cyan-500',
        iconRing: 'ring-cyan-100 dark:ring-cyan-900/40',
      },
    };
    return colors[color] || colors.blue;
  };

  const SettingCard = ({ icon, title, subtitle, screen, color = 'blue' }: { 
    icon: string; 
    title: string; 
    subtitle: string; 
    screen: string;
    color?: string;
  }) => {
    const colorClasses = getColorClasses(color);
    return (
      <button
        onClick={() => {
          console.log('Navigating to:', screen);
          navigate(screen);
        }}
        className="w-full flex items-center gap-4 px-2 py-3 md:px-3 rounded-lg text-left group transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <div className={`w-10 h-10 ${colorClasses.iconBg} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ${colorClasses.iconRing} group-hover:scale-105 transition-transform`}>
          <span className="material-icons-outlined text-white text-xl">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base mb-0.5 group-hover:text-primary dark:group-hover:text-primary/80 transition-colors">
            {title}
          </h3>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
            {subtitle}
          </p>
        </div>
        <span className="material-icons-outlined text-gray-400 group-hover:text-primary dark:group-hover:text-primary/80 transition-colors flex-shrink-0 text-base md:text-lg">
          chevron_right
        </span>
      </button>
    );
  };

  // Prepare items for AnimatedList
  const allSettingsItems = isAdmin 
    ? [...commonSettings, ...adminSettingsCards]
    : commonSettings;

  const handleSettingSelect = (_item: any, index: number) => {
    const selectedItem = allSettingsItems[index];
    if (selectedItem) {
      navigate(selectedItem.screen);
    }
  };

  const content = (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-y-auto">
      <div className="max-w-6xl mx-auto w-full p-6 md:p-8">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                  <span className="material-icons-outlined text-white text-2xl">settings</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Settings
                </h1>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed">
                Manage your account settings and preferences. Admins can download the unified{' '}
                <strong className="text-primary">OrgIt Master Bulk</strong> workbook for organisation structure,
                services, clients, employees, and tasks.
              </p>
            </div>
            {isAdmin && (
              <div className="flex shrink-0 self-start sm:self-center">
                <BulkMasterUploadPanel />
              </div>
            )}
          </div>
        </div>

        {/* Settings List with AnimatedList */}
        <div className="space-y-6">
          {/* General Settings Section */}
          {!isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">General Settings</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl bg-white/60 dark:bg-slate-900/40 border border-gray-200 dark:border-gray-800">
                {commonSettings.map((item, index) => (
                  <div key={index} className="first:border-t-0">
                    <SettingCard {...item} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Settings with AnimatedList */}
          {isAdmin && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/60 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  All Settings
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({allSettingsItems.length} items)
                </span>
              </div>
              
              <AnimatedList
                items={allSettingsItems.map((item, index) => (
                  <SettingCard key={index} {...item} />
                ))}
                onItemSelect={handleSettingSelect}
                showGradients={false}
                enableArrowNavigation={true}
                displayScrollbar={true}
                className="w-full rounded-xl bg-white/60 dark:bg-slate-900/40 border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800"
                itemClassName="transition-transform"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <EmployeeLayout>{content}</EmployeeLayout>;
};
