import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/admin', icon: 'grid_view', label: 'Dashboard' },
  { path: '/admin/messages', icon: 'chat', label: 'Messaging' },
  { path: '/admin/tasks', icon: 'check_circle', label: 'Task Management' },
  { path: '/admin/documents', icon: 'description', label: 'Document Management' },
  { path: '/admin/compliance', icon: 'verified_user', label: 'Compliance Management' },
  { path: '/admin/users', icon: 'group', label: 'Employees' },
];

export const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(
    location.pathname.startsWith('/admin/configuration') || 
    (location.pathname.startsWith('/admin/settings') && 
     !location.pathname.startsWith('/admin/settings/departments') &&
     !location.pathname.startsWith('/admin/settings/designations') &&
     !location.pathname.startsWith('/admin/settings/reporting-hierarchy') &&
     location.pathname !== '/admin/settings/organisation-structure')
  );

  return (
    <aside
      className={`hidden md:flex flex-col bg-white border-r border-slate-200 h-full font-body shrink-0 z-20 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className={`p-6 pb-2 shrink-0 relative ${isCollapsed ? 'px-4' : ''}`}>
        <div className={`flex items-center gap-3 mb-8 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="bg-primary p-2 rounded-lg text-white shadow-lg shadow-primary/20 shrink-0">
            <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 text-lg font-extrabold tracking-tight leading-none truncate">ORGIT</h1>
              <span className="text-[10px] text-slate-500 font-medium">Enterprise Admin</span>
            </div>
          )}
        </div>
        {/* Toggle Button - Top Right */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-slate-50 transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span
            className={`material-icons-outlined text-lg transition-transform duration-300 ${
              isCollapsed ? '' : 'rotate-180'
            }`}
          >
            chevron_left
          </span>
        </button>
      </div>
      <nav className={`flex-1 overflow-y-auto overflow-x-visible pb-2 flex flex-col gap-1 ${isCollapsed ? 'px-3' : 'px-6'}`}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group min-w-0 ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={isCollapsed ? item.label : item.label}
            >
              <span
                className={`material-symbols-outlined text-[22px] shrink-0 ${
                  isActive
                    ? ''
                    : 'text-slate-400 group-hover:text-slate-600 transition-colors'
                }`}
              >
                {item.icon}
              </span>
              {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap overflow-visible flex-shrink-0">{item.label}</span>}
            </Link>
          );
        })}
        <Link
          to="/admin/entity-master"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group min-w-0 ${
            isCollapsed ? 'justify-center' : ''
          } ${
            location.pathname === '/admin/entity-master' || location.pathname.startsWith('/admin/entity-master/')
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
          title={isCollapsed ? 'Entity Master Data' : 'Entity Master Data'}
        >
          <span
            className={`material-symbols-outlined text-[22px] shrink-0 ${
              location.pathname === '/admin/entity-master' || location.pathname.startsWith('/admin/entity-master/')
                ? ''
                : 'text-slate-400 group-hover:text-slate-600 transition-colors'
            }`}
          >
            domain
          </span>
          {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap overflow-visible flex-shrink-0">Entity Master Data</span>}
        </Link>
        <Link
          to="/admin/settings/organisation-structure"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group min-w-0 ${
            isCollapsed ? 'justify-center' : ''
          } ${
            location.pathname === '/admin/settings/organisation-structure' ||
            location.pathname.startsWith('/admin/settings/departments') ||
            location.pathname.startsWith('/admin/settings/designations') ||
            location.pathname.startsWith('/admin/settings/reporting-hierarchy')
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
          title={isCollapsed ? 'Organisation Structure' : 'Organisation Structure'}
        >
          <span
            className={`material-symbols-outlined text-[22px] shrink-0 ${
              location.pathname === '/admin/settings/organisation-structure' ||
              location.pathname.startsWith('/admin/settings/departments') ||
              location.pathname.startsWith('/admin/settings/designations') ||
              location.pathname.startsWith('/admin/settings/reporting-hierarchy')
                ? ''
                : 'text-slate-400 group-hover:text-slate-600 transition-colors'
            }`}
          >
            account_tree
          </span>
          {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap overflow-visible flex-shrink-0">Organisation Structure</span>}
        </Link>
        {!isCollapsed && (
          <>
            <div className="px-3 pt-6 pb-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">System</p>
            </div>
            <button
              onClick={() => setConfigExpanded(!configExpanded)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group min-w-0 ${
                location.pathname.startsWith('/admin/configuration') || 
                (location.pathname.startsWith('/admin/settings') && 
                 !location.pathname.startsWith('/admin/settings/departments') &&
                 !location.pathname.startsWith('/admin/settings/designations') &&
                 !location.pathname.startsWith('/admin/settings/reporting-hierarchy'))
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[22px] shrink-0 ${
                  location.pathname.startsWith('/admin/configuration') || 
                  (location.pathname.startsWith('/admin/settings') && 
                   !location.pathname.startsWith('/admin/settings/departments') &&
                   !location.pathname.startsWith('/admin/settings/designations') &&
                   !location.pathname.startsWith('/admin/settings/reporting-hierarchy'))
                    ? ''
                    : 'text-slate-400 group-hover:text-slate-600 transition-colors'
                }`}
              >
                settings
              </span>
              <span className="font-medium text-sm whitespace-nowrap overflow-visible flex-shrink-0">Settings (Admin Configurations)</span>
              <span
                className={`material-symbols-outlined text-sm ml-auto transition-transform shrink-0 ${
                  configExpanded ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>
            {configExpanded && (
              <div className="pl-[11px] space-y-1 pt-1">
                <Link
                  to="/admin/settings/reminder-config"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors pl-11 ${
                    location.pathname === '/admin/settings/reminder-config'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-sm">Reminder Config</span>
                </Link>
                <Link
                  to="/admin/configuration/notifications"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors pl-11 ${
                    location.pathname === '/admin/configuration/notifications'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-sm">Notifications</span>
                </Link>
                <Link
                  to="/admin/configuration/auto-escalation"
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors pl-11 ${
                    location.pathname === '/admin/configuration/auto-escalation'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-medium text-sm">Auto Escalation</span>
                </Link>
              </div>
            )}
          </>
        )}
        {isCollapsed && (
          <>
            <Link
              to="/admin/settings/organisation-structure"
              className={`flex items-center justify-center px-3 py-2.5 rounded-lg transition-colors ${
                location.pathname === '/admin/settings/organisation-structure' ||
                location.pathname.startsWith('/admin/settings/departments') ||
                location.pathname.startsWith('/admin/settings/designations') ||
                location.pathname.startsWith('/admin/settings/reporting-hierarchy')
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Organisation Structure"
            >
              <span className="material-symbols-outlined text-[22px]">account_tree</span>
            </Link>
            <Link
              to="/admin/settings/reminder-config"
              className={`flex items-center justify-center px-3 py-2.5 rounded-lg transition-colors ${
                location.pathname === '/admin/settings/reminder-config'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title="Reminder Config"
            >
              <span className="material-symbols-outlined text-[22px]">notifications_active</span>
            </Link>
          </>
        )}
      </nav>
      <div className={`shrink-0 p-4 border-t border-slate-100 ${isCollapsed ? 'px-2' : ''}`}>
        <Link
          to="/profile"
          className={`flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-100 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title={isCollapsed ? user?.name || 'Admin' : ''}
        >
          {user?.profilePhotoUrl ? (
            <div
              className="size-9 rounded-full bg-cover bg-center border border-slate-200 shrink-0"
              style={{ backgroundImage: `url(${user.profilePhotoUrl})` }}
            />
          ) : (
            <div className="size-9 rounded-full bg-primary flex items-center justify-center text-white font-bold border border-slate-200 shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
          )}
          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{user?.name || 'Admin'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@orgit.com'}</p>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
};

