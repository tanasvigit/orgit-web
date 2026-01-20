import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const location = useLocation();

  // Helper to determine active state
  const isActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true;
    if (path !== '/dashboard' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navItems = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    { path: '/messages', icon: 'chat_bubble', label: 'Chat', badge: 4 },
    { path: '/tasks', icon: 'check_circle', label: 'Task' },
    { path: '/documents', icon: 'description', label: 'Document' },
    { path: '/compliance', icon: 'policy', label: 'Compliance' },
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
                <span
                  className={`material-symbols-outlined transition-colors ${active ? 'text-primary filled' : 'text-gray-400 dark:text-gray-500 group-hover:text-primary'}`}
                  style={active ? { fontVariationSettings: '"FILL" 1, "wght" 700' } : {}}
                >
                  {item.icon}
                </span>
                {item.badge && (
                  <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
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
