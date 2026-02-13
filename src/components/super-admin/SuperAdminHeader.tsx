import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface SuperAdminHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  showSearch?: boolean;
  searchPlaceholder?: string;
  onSidebarToggle?: () => void;
}

export const SuperAdminHeader: React.FC<SuperAdminHeaderProps> = ({
  breadcrumbs = [],
  showSearch = false,
  searchPlaceholder = 'Search...',
  onSidebarToggle,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Generate breadcrumbs from path if not provided
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (breadcrumbs.length > 0) return breadcrumbs;

    const paths = location.pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [{ label: 'Dashboard', path: '/super-admin' }];

    if (paths.length > 1) {
      paths.slice(1).forEach((path, index) => {
        const fullPath = '/' + paths.slice(0, index + 2).join('/');
        const label = path
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        items.push({ label, path: index < paths.length - 2 ? fullPath : undefined });
      });
    }

    return items;
  };

  const finalBreadcrumbs = getBreadcrumbs();

  return (
    <header className="h-20 bg-super-admin-surface-light dark:bg-super-admin-surface-dark flex items-center justify-between px-8 flex-shrink-0 border-b border-super-admin-border-light dark:border-super-admin-border-dark shadow-sm z-10">
      <div className="flex items-center gap-8">
        {/* Hamburger menu button */}
        {onSidebarToggle && (
          <button 
            onClick={onSidebarToggle} 
            className="text-gray-600 dark:text-gray-400 hover:text-super-admin-primary dark:hover:text-white transition-colors"
            title="Toggle sidebar"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
        <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400">
          <span className="material-symbols-outlined text-xl mr-2 text-gray-400">home</span>
          {finalBreadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-gray-900 dark:text-white">{crumb.label}</span>
              )}
              {index < finalBreadcrumbs.length - 1 && <span className="mx-2">/</span>}
            </React.Fragment>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-super-admin-primary dark:hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg border border-transparent hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
          <span className="material-symbols-outlined text-lg">help</span>
          <span>Help</span>
        </button>
        
        {/* Profile Dropdown */}
        <div className="relative z-[100]" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            {user?.profilePhotoUrl ? (
              <img
                src={user.profilePhotoUrl}
                alt={user.name || 'Super Admin'}
                className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-slate-600"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-super-admin-primary flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'S'}
              </div>
            )}
            <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-lg">expand_more</span>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-[100]">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name || 'Super Admin'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || 'superadmin@orgit.com'}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">person</span>
                  View Profile
                </button>
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                  Settings
                </button>
              </div>
              <div className="border-t border-gray-100 dark:border-slate-700 pt-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

