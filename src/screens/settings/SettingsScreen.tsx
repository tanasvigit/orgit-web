import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const commonSettings = [
    { icon: 'person', title: 'Profile', subtitle: 'Update your profile details', screen: '/settings/profile' },
  ];

  const adminSettings = [
    {
      section: 'Organisation Structure',
      icon: 'account-tree',
      items: [
        { icon: 'business', title: 'Entity Master Data', subtitle: 'Name, logo, address, contact', screen: '/admin/entity-master' },
        { icon: 'group', title: 'Employees', subtitle: 'Manage employees, reporting & levels', screen: '/admin/users' },
        { icon: 'domain', title: 'Departments', subtitle: 'Manage business units', screen: '/admin/settings/departments' },
        { icon: 'badge', title: 'Designations', subtitle: 'Job titles & levels', screen: '/admin/settings/designations' },
        { icon: 'account_tree', title: 'Organisation Structure', subtitle: 'Overall org structure view', screen: '/admin/settings/organisation-structure' },
      ],
    },
    {
      section: 'Master Data',
      icon: 'dataset',
      items: [
        { icon: 'list_alt', title: 'Service List', subtitle: 'Recurring and one-time services', screen: '/admin/services' },
        { icon: 'groups', title: 'Entity List', subtitle: 'Clients and services provided to them', screen: '/admin/entities' },
      ],
    },
    {
      section: 'Automation & Configuration',
      icon: 'settings',
      items: [
        { icon: 'schedule', title: 'Reminder Configuration', subtitle: 'Due soon days & intervals', screen: '/admin/settings/reminder-config' },
        { icon: 'trending_up', title: 'Auto Escalation Configuration', subtitle: 'Rules for task escalation', screen: '/admin/settings/auto-escalation' },
      ],
    },
  ];

  const SettingCard = ({ icon, title, subtitle, screen }: { icon: string; title: string; subtitle: string; screen: string }) => (
    <button
      onClick={() => {
        console.log('Navigating to:', screen);
        navigate(screen);
      }}
      className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800/90 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-600/80 hover:border-primary/40 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 text-left group"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <span className="material-icons-outlined text-primary text-2xl">{icon}</span>
        </div>
        <div>
          <p className="font-semibold text-text-main-light dark:text-text-main-dark text-base mb-1">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
      </div>
      <span className="material-icons-outlined text-gray-400 group-hover:text-primary transition-colors">chevron_right</span>
    </button>
  );

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-main-light dark:text-text-main-dark mb-2">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account settings and preferences</p>
        </div>

        <div className="space-y-8">
          {/* General Settings */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-primary rounded"></div>
              <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">General Settings</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {commonSettings.map((item, index) => (
                <SettingCard key={index} {...item} />
              ))}
            </div>
          </div>

          {/* Admin Only Settings */}
          {isAdmin && adminSettings.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-primary rounded"></div>
                <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">{section.section}</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item, itemIndex) => (
                  <SettingCard key={itemIndex} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isAdmin) {
    return <AdminLayout>{content}</AdminLayout>;
  }

  return <EmployeeLayout>{content}</EmployeeLayout>;
};

