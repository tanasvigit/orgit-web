import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { showLogoutConfirm } from '../../utils/logoutConfirm';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const ORGIT_LOGO_SRC = '/orgit-logo.png?v=3';

const navItems: NavItem[] = [
  { path: '/super-admin', icon: 'grid_view', label: 'Dashboard' },
  { path: '/super-admin/organizations', icon: 'domain', label: 'Organisations' },
  { path: '/super-admin/users', icon: 'people', label: 'Users' },
  { path: '/super-admin/document-templates', icon: 'description', label: 'Document Templates' },
  // { path: '/super-admin/compliance', icon: 'verified_user', label: 'Compliance Management' },
];

interface SuperAdminSidebarProps {
  onToggleRef?: React.MutableRefObject<(() => void) | undefined>;
}

export const SuperAdminSidebar: React.FC<SuperAdminSidebarProps> = ({ onToggleRef }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggle = useCallback(() => {
    // On mobile, toggle mobile menu
    if (window.innerWidth < 768) {
      setIsMobileOpen(prev => !prev);
      return;
    }
    // On desktop, toggle collapse
    setIsCollapsed(prev => !prev);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileOpen && window.innerWidth < 768) {
        const target = event.target as HTMLElement;
        if (!target.closest('aside') && !target.closest('button[aria-label*="Sidebar"]')) {
          setIsMobileOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobileOpen && window.innerWidth < 768) {
      setIsMobileOpen(false);
    }
  }, [location.pathname]);

  // Expose toggle function via ref
  useEffect(() => {
    if (onToggleRef) {
      onToggleRef.current = handleToggle;
    }
  }, [onToggleRef, handleToggle]);

  const sidebarContent = (
    <>
      {/* Desktop Header */}
      <div className={`hidden md:flex h-20 items-center border-b border-super-admin-border-light dark:border-super-admin-border-dark relative ${
        isCollapsed ? 'px-4 justify-center' : 'px-6'
      }`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? '' : ''}`}>
          <img
            src={ORGIT_LOGO_SRC}
            alt="ORGIT"
            className={`shrink-0 object-contain ${isCollapsed ? 'h-9 w-9' : 'h-11 w-11'}`}
          />
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
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileOpen(false);
                }
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group min-w-0 min-h-[44px] ${
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
      <div className={`shrink-0 p-4 border-t border-super-admin-border-light dark:border-super-admin-border-dark space-y-2 ${isCollapsed ? 'px-2' : ''}`}>
        <div
          className={`flex items-center gap-3 p-2 rounded-lg bg-gray-50/80 dark:bg-slate-800/50 ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
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
        <button
          type="button"
          onClick={() => {
            navigate('/profile');
            if (window.innerWidth < 768) setIsMobileOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-[44px] ${
            isCollapsed ? 'justify-center flex-col gap-0.5 py-2' : 'justify-start'
          } ${
            location.pathname === '/profile'
              ? 'bg-super-admin-primary text-white shadow-md'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
          title={isCollapsed ? 'Profile' : undefined}
        >
          <span className="material-symbols-outlined text-[22px] shrink-0">person</span>
          {isCollapsed ? (
            <span className="text-[9px] leading-tight text-center whitespace-nowrap">Profile</span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-left font-medium text-sm">Profile</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            showLogoutConfirm(toast, logout, navigate, {
              onAfterConfirm: () => {
                if (window.innerWidth < 768) setIsMobileOpen(false);
              },
            });
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors min-h-[44px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 ${
            isCollapsed ? 'justify-center flex-col gap-0.5 py-2' : 'justify-start'
          }`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <span className="material-symbols-outlined text-[22px] shrink-0">logout</span>
          {isCollapsed ? (
            <span className="text-[9px] leading-tight text-center whitespace-nowrap">Logout</span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-left font-medium text-sm">Logout</span>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex relative bg-super-admin-surface-light dark:bg-super-admin-surface-dark border-r border-super-admin-border-light dark:border-super-admin-border-dark flex-shrink-0 flex flex-col transition-all duration-300 z-20 overflow-visible ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('a,button,input,textarea,select,label,[role="button"]')) return;
          handleToggle();
        }}
      >
        {sidebarContent}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className="absolute top-1/2 right-0 z-30 flex h-9 w-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border-2 border-super-admin-primary bg-super-admin-primary text-white shadow-lg shadow-super-admin-primary/40 ring-4 ring-super-admin-primary/20 transition-all hover:scale-105 hover:bg-super-admin-primary/90 hover:shadow-xl hover:shadow-super-admin-primary/50"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-symbols-outlined text-xl font-bold leading-none">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:hidden flex flex-col bg-super-admin-surface-light dark:bg-super-admin-surface-dark border-r border-super-admin-border-light dark:border-super-admin-border-dark shadow-xl transition-transform duration-300 w-72 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between h-20 px-4 border-b border-super-admin-border-light dark:border-super-admin-border-dark shrink-0">
          <div className="flex items-center gap-3">
            <img src={ORGIT_LOGO_SRC} alt="ORGIT" className="h-10 w-10 shrink-0 object-contain" />
            <div className="flex flex-col min-w-0">
              <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white leading-none truncate">ORGIT</h1>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Enterprise Admin</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
};

