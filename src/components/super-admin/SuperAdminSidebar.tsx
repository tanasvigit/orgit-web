import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/super-admin', icon: 'grid_view', label: 'Dashboard' },
  { path: '/super-admin/organizations', icon: 'domain', label: 'Organisations' },
  { path: '/super-admin/users', icon: 'people', label: 'Users' },
  { path: '/super-admin/document-templates', icon: 'description', label: 'Document Templates' },
  { path: '/super-admin/compliance', icon: 'verified_user', label: 'Compliance Management' },
];

interface SuperAdminSidebarProps {
  onToggleRef?: React.MutableRefObject<(() => void) | undefined>;
}

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({ onToggleRef }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggle = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Expose toggle function via ref
  useEffect(() => {
    if (onToggleRef) {
      onToggleRef.current = handleToggle;
    }
  }, [onToggleRef, handleToggle]);

  return (
    <aside
      className={`bg-super-admin-surface-light dark:bg-super-admin-surface-dark border-r border-super-admin-border-light dark:border-super-admin-border-dark flex-shrink-0 flex flex-col transition-all duration-300 z-20 overflow-visible ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className={`h-20 flex items-center border-b border-super-admin-border-light dark:border-super-admin-border-dark relative ${
        isCollapsed ? 'px-4 justify-center' : 'px-6'
      }`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? '' : ''}`}>
          <div className="bg-super-admin-primary text-white p-2 rounded-lg shadow-sm shrink-0">
            <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white leading-none truncate">ORGIT</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Enterprise Admin</span>
            </div>
          )}
        </div>
        {/* Removed Toggle Button - now in Navbar */}
      </div>
      <nav className={`flex-1 overflow-y-auto overflow-x-visible py-6 space-y-1 ${isCollapsed ? 'px-3' : 'px-4'}`}>
        {navItems.map((item) => {
          // Special handling for Dashboard - only active when exactly /super-admin or /super-admin/
          let isActive: boolean;
          if (item.path === '/super-admin') {
            isActive = location.pathname === '/super-admin' || location.pathname === '/super-admin/';
          } else {
            isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          }
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group min-w-0 ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-super-admin-primary text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
              title={isCollapsed ? item.label : item.label}
            >
              <span
                className={`material-symbols-outlined shrink-0 text-[22px] ${
                  isActive
                    ? ''
                    : 'text-gray-400 group-hover:text-super-admin-primary dark:group-hover:text-white transition-colors'
                }`}
              >
                {item.icon}
              </span>
              {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap overflow-visible flex-shrink-0">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className={`p-4 border-t border-super-admin-border-light dark:border-super-admin-border-dark ${isCollapsed ? 'px-2' : ''}`}>
        <div className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer transition-colors ${
          isCollapsed ? 'justify-center' : ''
        }`}>
          {user?.profilePhotoUrl ? (
            <img
              alt={user.name}
              className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-600 shrink-0"
              src={user.profilePhotoUrl}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-super-admin-primary flex items-center justify-center text-white font-semibold shrink-0">
              {user?.name.charAt(0).toUpperCase() || 'A'}
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name || 'Super Admin'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Super Admin</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

