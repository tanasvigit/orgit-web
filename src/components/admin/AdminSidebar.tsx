import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  { path: '/admin/entity-master', icon: 'domain', label: 'Entity Master Data' },
];

const ADMIN_STORAGE_KEY = 'admin-sidebar-minimized-by-messages';
const ADMIN_STORAGE_KEY_MANUAL = 'admin-sidebar-manually-expanded';

interface AdminSidebarProps {
  onToggleRef?: React.MutableRefObject<(() => void) | null>;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onToggleRef }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Use localStorage to persist state across remounts
  const getStoredMinimizedFlag = () => {
    try {
      return localStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  };
  
  const getStoredManualExpanded = () => {
    try {
      return localStorage.getItem(ADMIN_STORAGE_KEY_MANUAL) === 'true';
    } catch {
      return false;
    }
  };
  
  const setStoredMinimizedFlag = (value: boolean) => {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, value.toString());
    } catch {}
  };
  
  const setStoredManualExpanded = (value: boolean) => {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY_MANUAL, value.toString());
    } catch {}
  };
  
  // Use refs to track state that persists across renders
  const wasManuallyExpanded = useRef(getStoredManualExpanded());
  const wasMinimizedByMessageRoute = useRef(getStoredMinimizedFlag());
  const previousPath = useRef(location.pathname);
  
  // Initialize: check localStorage and current route
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const onMessageRoute = location.pathname.startsWith('/admin/messages');
    const storedMinimized = getStoredMinimizedFlag();
    const storedManualExpanded = getStoredManualExpanded();
    
    if (onMessageRoute) {
      wasMinimizedByMessageRoute.current = true;
      setStoredMinimizedFlag(true);
      return true; // Always minimized on message route
    } else if (storedMinimized && !storedManualExpanded) {
      // Was minimized by message route and not manually expanded - keep minimized
      wasMinimizedByMessageRoute.current = true;
      wasManuallyExpanded.current = false;
      return true;
    }
    return false;
  });
  
  // Store the collapsed state in a ref to prevent unwanted resets
  const collapsedStateRef = useRef(isCollapsed);

  // Expose toggle function to parent component
  const handleToggle = useCallback(() => {
    // On mobile, toggle mobile menu
    if (window.innerWidth < 768) {
      setIsMobileOpen(prev => !prev);
      return;
    }
    // On desktop, toggle collapse
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    collapsedStateRef.current = newState;
    // Track if user manually expanded (only when expanding, not collapsing)
    if (newState === false) {
      wasManuallyExpanded.current = true;
      wasMinimizedByMessageRoute.current = false; // User manually expanded, clear the flag
      setStoredManualExpanded(true);
      setStoredMinimizedFlag(false);
    } else {
      wasManuallyExpanded.current = false;
      setStoredManualExpanded(false);
      // If user manually collapses, we don't need to track it as message-route minimized
    }
  }, [isCollapsed]);

  // Expose toggle function via ref
  useEffect(() => {
    if (onToggleRef) {
      onToggleRef.current = handleToggle;
    }
  }, [handleToggle, onToggleRef]);

  // Automatically minimize sidebar when entering message routes
  // Keep minimized state when leaving message routes (don't auto-expand)
  useEffect(() => {
    const isOnMessageRoute = location.pathname.startsWith('/admin/messages');
    const wasOnMessageRoute = previousPath.current.startsWith('/admin/messages');

    // Auto-minimize when entering message route (unless user manually expanded)
    if (isOnMessageRoute) {
      if (!wasOnMessageRoute) {
        // Just entered message route - always minimize
        setIsCollapsed(true);
        collapsedStateRef.current = true;
        wasManuallyExpanded.current = false;
        wasMinimizedByMessageRoute.current = true;
        setStoredManualExpanded(false);
        setStoredMinimizedFlag(true);
      } else if (!wasManuallyExpanded.current) {
        // Already on message route and wasn't manually expanded - ensure minimized
        setIsCollapsed(true);
        collapsedStateRef.current = true;
        wasMinimizedByMessageRoute.current = true;
        setStoredMinimizedFlag(true);
      }
    }
    
    // On EVERY route change, if it was minimized by message route, keep it minimized
    // This ensures it stays minimized when navigating to tasks, dashboard, etc.
    if (wasMinimizedByMessageRoute.current && !wasManuallyExpanded.current && !isOnMessageRoute) {
      // Always force keep minimized state - don't auto-expand
      setIsCollapsed(true);
      collapsedStateRef.current = true;
    }

    previousPath.current = location.pathname;
  }, [location.pathname]);
  
  // Enforce minimized state on every route change - this is the primary enforcement
  useEffect(() => {
    const isOnMessageRoute = location.pathname.startsWith('/admin/messages');
    
    // Always sync from localStorage first
    wasMinimizedByMessageRoute.current = getStoredMinimizedFlag();
    wasManuallyExpanded.current = getStoredManualExpanded();
    
    // If we're on message route, minimize and set flag
    if (isOnMessageRoute) {
      setIsCollapsed(true);
      collapsedStateRef.current = true;
      wasMinimizedByMessageRoute.current = true;
      wasManuallyExpanded.current = false;
      setStoredMinimizedFlag(true);
      setStoredManualExpanded(false);
    } 
    // If we're NOT on message route but flag is set and user hasn't manually expanded
    else if (wasMinimizedByMessageRoute.current && !wasManuallyExpanded.current) {
      // CRITICAL: Force minimize - this prevents any auto-expansion
      setIsCollapsed(true);
      collapsedStateRef.current = true;
    }
  }, [location.pathname]);
  
  // Additional safeguard: enforce minimized state whenever isCollapsed changes
  // This catches any state changes that might try to expand the sidebar
  useEffect(() => {
    // Sync from localStorage
    wasMinimizedByMessageRoute.current = getStoredMinimizedFlag();
    wasManuallyExpanded.current = getStoredManualExpanded();
    
    const isOnMessageRoute = location.pathname.startsWith('/admin/messages');
    
    // If flag is set and user hasn't manually expanded, FORCE minimize
    if (wasMinimizedByMessageRoute.current && !wasManuallyExpanded.current) {
      if (!isCollapsed) {
        // Sidebar is expanded but shouldn't be - force minimize
        setIsCollapsed(true);
        collapsedStateRef.current = true;
      } else {
        // Sidebar is correctly minimized - just update ref
        collapsedStateRef.current = true;
      }
    } else if (!isOnMessageRoute && wasManuallyExpanded.current) {
      // User manually expanded and we're not on message route - allow current state
      collapsedStateRef.current = isCollapsed;
    }
  }, [isCollapsed, location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileOpen && window.innerWidth < 768) {
        const target = event.target as HTMLElement;
        if (!target.closest('aside') && !target.closest('button[title="Toggle Sidebar"]')) {
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

  // Auto-open settings dropdown and highlight Settings when on SettingsScreen or any settings route
  const isSettingsActive =
    location.pathname === '/admin/settings' ||
    location.pathname === '/admin/users' || location.pathname.startsWith('/admin/users/') ||
    location.pathname === '/admin/services' || location.pathname.startsWith('/admin/services/') ||
    location.pathname === '/admin/entities' || location.pathname.startsWith('/admin/entities/') ||
    location.pathname === '/admin/settings/organisation-structure' || location.pathname.startsWith('/admin/settings/departments') ||
    location.pathname.startsWith('/admin/settings/designations') || location.pathname.startsWith('/admin/settings/reporting-hierarchy');

  useEffect(() => {
    if (isSettingsActive && !isCollapsed) {
      setIsSettingsOpen(true);
    } else if (!isSettingsActive) {
      setIsSettingsOpen(false);
    }
  }, [isSettingsActive, isCollapsed]);

  const sidebarContent = (
    <>
      {/* Desktop Header */}
      <div className={`hidden md:block p-6 pb-2 shrink-0 relative ${isCollapsed ? 'px-4' : ''}`}>
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
      </div>
      <nav className={`flex-1 overflow-y-auto overflow-x-visible pb-2 flex flex-col gap-1 ${isCollapsed ? 'px-3' : 'px-3 md:px-6'}`}>
        {navItems.map((item) => {
          // Special handling for Dashboard - only active when exactly /admin or /admin/
          let isActive: boolean;
          if (item.path === '/admin') {
            isActive = location.pathname === '/admin' || location.pathname === '/admin/';
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group min-w-0 min-h-[44px] ${
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
        
        {/* Settings: icon + label navigate; chevron toggles dropdown */}
        <div className="relative">
          <div
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group min-w-0 min-h-[44px] ${
              isCollapsed ? 'justify-center' : ''
            } ${
              isSettingsActive
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                navigate('/admin/settings');
                if (window.innerWidth < 768) setIsMobileOpen(false);
              }}
              className={`flex items-center gap-3 min-w-0 flex-1 text-left ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? 'Settings' : 'Settings'}
            >
              <span
                className={`material-symbols-outlined text-[22px] shrink-0 ${
                  isSettingsActive ? '' : 'text-slate-400 group-hover:text-slate-600 transition-colors'
                }`}
              >
                settings
              </span>
              {!isCollapsed && (
                <span className="font-medium text-sm whitespace-nowrap overflow-visible flex-shrink-0 flex-1">Settings</span>
              )}
            </button>
            {!isCollapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSettingsOpen(!isSettingsOpen);
                }}
                className="p-1 rounded hover:bg-slate-200/50 transition-colors shrink-0"
                aria-label="Toggle settings menu"
              >
                <span className={`material-symbols-outlined text-lg shrink-0 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
            )}
          </div>

          {/* Dropdown Menu */}
          {!isCollapsed && isSettingsOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-200 pl-4">
              <Link
                to="/admin/users"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group min-w-0 min-h-[40px] ${
                  location.pathname === '/admin/users' || location.pathname.startsWith('/admin/users/')
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">group</span>
                <span className="font-medium text-sm whitespace-nowrap">Employees</span>
              </Link>
              <Link
                to="/admin/services"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group min-w-0 min-h-[40px] ${
                  location.pathname === '/admin/services' || location.pathname.startsWith('/admin/services/')
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">list_alt</span>
                <span className="font-medium text-sm whitespace-nowrap">Service List</span>
              </Link>
              <Link
                to="/admin/entities"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group min-w-0 min-h-[40px] ${
                  location.pathname === '/admin/entities' || location.pathname.startsWith('/admin/entities/')
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">groups</span>
                <span className="font-medium text-sm whitespace-nowrap">Entity List</span>
              </Link>
              <Link
                to="/admin/settings/organisation-structure"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group min-w-0 min-h-[40px] ${
                  location.pathname === '/admin/settings/organisation-structure' ||
                  location.pathname.startsWith('/admin/settings/departments') ||
                  location.pathname.startsWith('/admin/settings/designations') ||
                  location.pathname.startsWith('/admin/settings/reporting-hierarchy')
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">account_tree</span>
                <span className="font-medium text-sm whitespace-nowrap">Organisation Structure</span>
              </Link>
            </div>
          )}
        </div>
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
        className={`hidden md:flex flex-col bg-white border-r border-slate-200 h-full font-body shrink-0 z-20 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:hidden flex flex-col bg-white border-r border-slate-200 shadow-xl transition-transform duration-300 w-72 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg text-white shadow-lg shadow-primary/20 shrink-0">
              <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 text-base font-extrabold tracking-tight leading-none truncate">ORGIT</h1>
              <span className="text-[10px] text-slate-500 font-medium">Enterprise Admin</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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

