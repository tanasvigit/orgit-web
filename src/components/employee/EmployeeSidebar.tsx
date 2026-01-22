import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: 'grid_view', label: 'Dashboard' },
  { path: '/messages', icon: 'chat', label: 'Messages' },
  { path: '/tasks', icon: 'check_circle', label: 'Tasks' },
  { path: '/documents', icon: 'description', label: 'Documents' },
  { path: '/compliance', icon: 'verified_user', label: 'Compliance' },
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
        {/* Settings Link */}
        {!isCollapsed && (
          <Link
            to="/settings"
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
              location.pathname === '/settings' || location.pathname.startsWith('/settings/')
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
            }`}
            title="Settings"
          >
            <span className={`material-icons-outlined text-2xl shrink-0 ${location.pathname === '/settings' || location.pathname.startsWith('/settings/') ? '' : 'group-hover:text-primary'}`}>
              settings
            </span>
            <span className="font-medium text-sm whitespace-nowrap">Settings</span>
          </Link>
        )}
        {isCollapsed && (
          <Link
            to="/settings"
            className={`relative flex items-center justify-center px-3 py-2.5 rounded-xl transition-all ${
              location.pathname === '/settings' || location.pathname.startsWith('/settings/')
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-400 hover:text-primary hover:bg-secondary/50 dark:hover:bg-primary/10'
            }`}
            title="Settings"
          >
            <span className="material-icons-outlined text-2xl shrink-0">settings</span>
          </Link>
        )}
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

