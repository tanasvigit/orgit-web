import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { AppIcon } from './AppIcon';
import { NavBadge } from './NavBadge';
import type { AppIconName } from '../../constants/appIcons';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { counts } = useNotifications();

  // Helper to determine active state
  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const badgeByPath: Record<string, number> = {
    '/messages': counts.chat,
    '/tasks': counts.tasks,
    '/documents': counts.documents,
  };

  const navItems: { path: string; icon: AppIconName; label: string }[] = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/messages', icon: 'chat', label: 'Chat' },
    { path: '/tasks', icon: 'task', label: 'Task' },
    { path: '/documents', icon: 'document', label: 'Document' },
    { path: '/settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-surface-light dark:bg-background-dark border-t border-gray-200 dark:border-gray-800 pb-safe">
      <div className="flex items-center justify-around h-16 pb-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.label}
              to={item.path}
              className="flex flex-col items-center justify-center w-full h-full gap-1 pt-2 group"
            >
              <div className="relative">
                <AppIcon
                  name={item.icon}
                  variant="nav"
                  className={active ? '' : 'opacity-60 group-hover:opacity-100 transition-opacity'}
                />
                <NavBadge count={badgeByPath[item.path] ?? 0} />
              </div>
              <span className={`text-[10px] transition-colors ${active ? 'font-bold text-primary' : 'font-medium text-gray-400 dark:text-gray-500 group-hover:text-primary'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-5 w-full"></div>
    </div>
  );
};
