import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { path: '/messages', icon: 'chat_bubble', label: 'Messages' },
  { path: '/tasks', icon: 'check_circle', label: 'Tasks' },
  { path: '/documents', icon: 'description', label: 'Documents' },
  { path: '/compliance', icon: 'verified_user', label: 'Compliance' },
];

export const EmployeeSidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={`hidden md:flex flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark shadow-sm z-20 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`p-6 pb-4 shrink-0 border-b border-border-light dark:border-border-dark relative ${isCollapsed ? 'px-4' : ''}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-secondary dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-dark">
              {user?.profilePhotoUrl ? (
                <img
                  alt="User Avatar"
                  className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 object-cover"
                  src={user.profilePhotoUrl}
                />
              ) : (
                <span className="text-primary text-xl font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 dark:text-white text-lg font-extrabold tracking-tight leading-none truncate">
                ORGIT
              </h1>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">Employee Portal</span>
            </div>
          )}
        </div>
        {/* Toggle Button - Top Right */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10 transition-colors"
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                isCollapsed ? 'justify-center' : ''
              } ${
                active
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <span className={`material-icons-outlined text-2xl shrink-0 ${active ? '' : 'group-hover:text-primary'}`}>
                {item.icon}
              </span>
              {!isCollapsed && (
                <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
              )}
              {item.path === '/messages' && (
                <span className={`absolute w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 ${
                  isCollapsed ? 'top-2 right-2' : 'top-2 right-3'
                }`}></span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className={`shrink-0 p-4 border-t border-border-light dark:border-border-dark space-y-2 ${isCollapsed ? 'px-2' : ''}`}>
        <button
          onClick={() => navigate('/profile')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            isCollapsed ? 'justify-center' : ''
          } ${
            location.pathname === '/profile'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
          }`}
          title={isCollapsed ? 'Profile' : ''}
        >
          <span className="material-icons-outlined text-2xl shrink-0">person</span>
          {!isCollapsed && <span className="font-medium text-sm">Profile</span>}
        </button>
        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            isCollapsed ? 'justify-center' : ''
          } ${
            location.pathname === '/settings' || location.pathname.startsWith('/settings/')
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
          }`}
          title={isCollapsed ? 'Settings' : ''}
        >
          <span className="material-icons-outlined text-2xl shrink-0">settings</span>
          {!isCollapsed && <span className="font-medium text-sm">Settings</span>}
        </button>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            isCollapsed ? 'justify-center' : ''
          } text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <span className="material-icons-outlined text-2xl shrink-0">logout</span>
          {!isCollapsed && <span className="font-medium text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
};

