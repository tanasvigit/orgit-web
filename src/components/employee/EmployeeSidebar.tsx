import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { showLogoutConfirm } from '../../utils/logoutConfirm';
import { AppIcon } from '../shared/AppIcon';
import type { AppIconName } from '../../constants/appIcons';
import { useEmployeePermissions } from '../../hooks/useEmployeePermissions';
import type { AppModule } from '../../utils/employeePermissionUtils';

interface NavItem {
  path: string;
  icon: AppIconName;
  label: string;
  module: AppModule;
}

const collapsedLabelMap: Record<string, string> = {
  Dashboard: 'Dash board',
  Chats: 'Chats',
  'Task Management': 'Tasks',
  'Document Management': "Docs",
  Settings: 'Settings',
};

const navItems: NavItem[] = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', module: 'Dashboard' },
  { path: '/messages', icon: 'chat', label: 'Chats', module: 'Messaging' },
  { path: '/tasks', icon: 'task', label: 'Task Management', module: 'Tasks' },
  { path: '/documents', icon: 'document', label: 'Document Management', module: 'Documents' },
];

const STORAGE_KEY = 'employee-sidebar-minimized-by-messages';
const STORAGE_KEY_MANUAL = 'employee-sidebar-manually-expanded';

interface EmployeeSidebarProps {
  onToggleRef?: React.MutableRefObject<(() => void) | null>;
}

export const EmployeeSidebar: React.FC<EmployeeSidebarProps> = ({ onToggleRef }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { canAccessModule } = useEmployeePermissions();
  const visibleNavItems = navItems.filter((item) => canAccessModule(item.module));
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Use localStorage to persist state across remounts
  const getStoredMinimizedFlag = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  };
  
  const getStoredManualExpanded = () => {
    try {
      return localStorage.getItem(STORAGE_KEY_MANUAL) === 'true';
    } catch {
      return false;
    }
  };
  
  const setStoredMinimizedFlag = (value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, value.toString());
    } catch {}
  };
  
  const setStoredManualExpanded = (value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY_MANUAL, value.toString());
    } catch {}
  };
  
  // Use refs to track state that persists across renders
  const wasManuallyExpanded = useRef(getStoredManualExpanded());
  const wasMinimizedByMessageRoute = useRef(getStoredMinimizedFlag());
  const previousPath = useRef(location.pathname);
  
  // Initialize: check localStorage and current route
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const onMessageRoute = location.pathname.startsWith('/messages');
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
    const isOnMessageRoute = location.pathname.startsWith('/messages');
    const wasOnMessageRoute = previousPath.current.startsWith('/messages');

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
    const isOnMessageRoute = location.pathname.startsWith('/messages');
    
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
    
    const isOnMessageRoute = location.pathname.startsWith('/messages');
    
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

  const isActive = (path: string) => {
    // Special handling for Dashboard - only active when exactly /dashboard or /dashboard/
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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

  // Auto-open settings dropdown if on a settings route
  const isSettingsActive = 
    location.pathname === '/settings' || location.pathname.startsWith('/settings/');

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
      <div className={`hidden md:block p-6 pb-4 shrink-0 border-b border-border-light dark:border-border-dark relative max-[1366px]:p-3 max-[1366px]:pb-1 ${isCollapsed ? 'px-4 max-[1366px]:px-2.5' : ''}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-secondary dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-dark max-[1366px]:w-10 max-[1366px]:h-10">
              {user?.profilePhotoUrl ? (
                <img
                  alt="User Avatar"
                  className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 object-cover max-[1366px]:w-8 max-[1366px]:h-8"
                  src={user.profilePhotoUrl}
                />
              ) : (
                <span className="text-primary text-xl font-bold max-[1366px]:text-lg">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 dark:text-white text-lg font-extrabold tracking-tight leading-none truncate max-[1366px]:text-base">
                ORGIT
              </h1>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-medium max-[1366px]:text-[9px]">Employee Portal</span>
            </div>
          )}
        </div>
        {isCollapsed && (
          <p className="text-[9px] leading-tight text-slate-500 dark:text-gray-400 text-center mt-1 max-[1366px]:text-[8px]">
            ORGIT
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1 max-[1366px]:py-2 max-[1366px]:gap-0">
        {visibleNavItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                // Close mobile menu on navigation
                if (window.innerWidth < 768) {
                  setIsMobileOpen(false);
                }
              }}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group min-h-[44px] max-[1366px]:py-1.5 max-[1366px]:min-h-[34px] ${
                isCollapsed ? 'justify-center flex-col gap-0.5 py-2' : ''
              } ${
                active
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
              }`}
              title={isCollapsed ? item.label : ''}
            >
              <AppIcon
                name={item.icon}
                variant="nav"
                className={active ? '' : 'opacity-70 group-hover:opacity-100 transition-opacity'}
              />
              {isCollapsed ? (
                <span className="text-[9px] leading-tight text-center whitespace-nowrap max-[1366px]:text-[8px]">
                  {collapsedLabelMap[item.label] || item.label}
                </span>
              ) : (
                <span className="font-medium text-sm whitespace-nowrap max-[1366px]:text-xs">{item.label}</span>
              )}
            </Link>
          );
        })}
        
        {/* Settings: icon + label navigate to Settings page; chevron toggles dropdown */}
        <div className="relative">
          <div
            className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group min-h-[44px] max-[1366px]:py-1.5 max-[1366px]:min-h-[34px] ${
              isCollapsed ? 'justify-center' : ''
            } ${
              isSettingsActive
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                navigate('/settings');
                if (window.innerWidth < 768) setIsMobileOpen(false);
              }}
              className={`flex items-center gap-3 min-w-0 flex-1 text-left ${
                isCollapsed ? 'justify-center flex-col gap-0.5' : ''
              }`}
              title={isCollapsed ? 'Settings' : ''}
            >
              <AppIcon
                name="settings"
                variant="nav"
                className={isSettingsActive ? '' : 'opacity-70 group-hover:opacity-100 transition-opacity'}
              />
              {isCollapsed ? (
                <span className="text-[9px] leading-tight text-center whitespace-nowrap max-[1366px]:text-[8px]">
                  Settings
                </span>
              ) : (
                <span className="font-medium text-sm whitespace-nowrap flex-1 max-[1366px]:text-xs">Settings</span>
              )}
            </button>
            {!isCollapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSettingsOpen(!isSettingsOpen);
                }}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
                aria-label="Toggle settings menu"
              >
                <span
                  className={`material-icons-outlined text-lg shrink-0 transition-transform ${
                    isSettingsOpen ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>
            )}
          </div>
          
          {/* Dropdown Menu */}
          {!isCollapsed && isSettingsOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
              <Link
                to="/settings"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group min-w-0 min-h-[40px] ${
                  location.pathname === '/settings' || location.pathname.startsWith('/settings/')
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
                }`}
              >
                <AppIcon name="settings" variant="nav" />
                <span className="font-medium text-sm whitespace-nowrap">Settings</span>
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className={`shrink-0 p-4 border-t border-border-light dark:border-border-dark space-y-2 max-[1366px]:p-2 max-[1366px]:space-y-0.5 ${isCollapsed ? 'px-2 max-[1366px]:px-1.5' : ''}`}>
        <button
          onClick={() => {
            navigate('/profile');
            if (window.innerWidth < 768) {
              setIsMobileOpen(false);
            }
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors min-h-[44px] max-[1366px]:py-1.5 max-[1366px]:min-h-[34px] ${
            isCollapsed ? 'justify-center' : ''
          } ${
            location.pathname === '/profile'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
          }`}
          title={isCollapsed ? 'Profile' : ''}
        >
          <span className="material-icons-outlined text-2xl shrink-0 max-[1366px]:text-xl">person</span>
          {!isCollapsed && <span className="font-medium text-sm max-[1366px]:text-xs">Profile</span>}
        </button>
        <button
          onClick={() => {
            showLogoutConfirm(toast, logout, navigate, {
              onAfterConfirm: () => {
                if (window.innerWidth < 768) setIsMobileOpen(false);
              },
            });
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors min-h-[44px] max-[1366px]:py-1.5 max-[1366px]:min-h-[34px] ${
            isCollapsed ? 'justify-center' : ''
          } text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <span className="material-icons-outlined text-2xl shrink-0 max-[1366px]:text-xl">logout</span>
          {!isCollapsed && <span className="font-medium text-sm max-[1366px]:text-xs">Logout</span>}
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
        className={`hidden md:flex flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark shadow-sm z-20 transition-all duration-300 ${
          isCollapsed ? 'w-[70px]' : 'w-[240px]'
        }`}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('a,button,input,textarea,select,label,[role="button"]')) return;
          handleToggle();
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 md:hidden flex flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark shadow-xl transition-transform duration-300 w-64 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-secondary dark:bg-primary/20 flex items-center justify-center text-primary dark:text-primary-dark">
                {user?.profilePhotoUrl ? (
                  <img
                    alt="User Avatar"
                    className="w-9 h-9 rounded-full border-2 border-white dark:border-gray-700 object-cover"
                    src={user.profilePhotoUrl}
                  />
                ) : (
                  <span className="text-primary text-lg font-bold">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 dark:text-white text-base font-extrabold tracking-tight leading-none truncate">
                ORGIT
              </h1>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">Employee Portal</span>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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

