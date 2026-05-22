import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { showLogoutConfirm } from '../../utils/logoutConfirm';
import { AppIcon } from '../shared/AppIcon';
import type { AppIconName } from '../../constants/appIcons';

interface NavItem {
  path: string;
  icon: AppIconName;
  label: string;
}

const collapsedLabelMap: Record<string, string> = {
  Dashboard: 'Dash board',
  Chats: 'Chats',
  'Task Management': 'Tasks',
  'Document Management': "Docs",
  Settings: 'Settings',
};

const navItems: NavItem[] = [
  { path: '/admin', icon: 'dashboard', label: 'Dashboard' },
  { path: '/admin/messages', icon: 'chat', label: 'Chats' },
  { path: '/admin/tasks', icon: 'task', label: 'Task Management' },
  { path: '/admin/documents', icon: 'document', label: 'Document Management' },
];

const subNavLinkBase =
  'flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg px-2 py-2 transition-colors min-h-[40px] max-[1366px]:min-h-[36px]';

function subNavLinkClass(active: boolean) {
  return `${subNavLinkBase} ${
    active
      ? 'bg-primary/10 font-semibold text-primary'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`;
}

const ADMIN_STORAGE_KEY = 'admin-sidebar-minimized-by-messages';
const ADMIN_STORAGE_KEY_MANUAL = 'admin-sidebar-manually-expanded';

interface AdminSidebarProps {
  onToggleRef?: React.MutableRefObject<(() => void) | null>;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ onToggleRef }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toast } = useToast();
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
    location.pathname === '/admin/settings/org-definition' ||
    location.pathname === '/admin/settings/organisation-structure' || location.pathname.startsWith('/admin/settings/reporting-hierarchy') ||
    location.pathname === '/admin/settings/user-config' ||
    location.pathname.startsWith('/admin/settings/reminder-config') ||
    location.pathname.startsWith('/admin/settings/auto-escalation') ||
    location.pathname.startsWith('/admin/settings/recurring-tasks');

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
      <div className={`hidden md:block p-6 pb-2 shrink-0 relative max-[1366px]:p-3 max-[1366px]:pb-0.5 ${isCollapsed ? 'px-4 max-[1366px]:px-2.5' : ''}`}>
        <div className={`flex items-center gap-3 mb-8 max-[1366px]:mb-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="bg-primary p-2 rounded-lg text-white shadow-lg shadow-primary/20 shrink-0 max-[1366px]:p-1.5">
            <span className="material-symbols-outlined text-2xl max-[1366px]:text-xl">admin_panel_settings</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 text-lg font-extrabold tracking-tight leading-none truncate max-[1366px]:text-base">ORGIT</h1>
              <span className="text-[10px] text-slate-500 font-medium max-[1366px]:text-[9px]">Enterprise Admin</span>
            </div>
          )}
        </div>
        {isCollapsed && (
          <p className="text-[9px] leading-tight text-slate-500 text-center -mt-5 mb-2 max-[1366px]:text-[8px]">
            ORGIT
          </p>
        )}
      </div>
      <nav
        className={`flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto pb-2 max-[1366px]:gap-0 ${
          isCollapsed ? 'px-3 max-[1366px]:px-1.5' : 'px-3 md:px-4 max-[1366px]:px-3'
        }`}
      >
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
              className={`flex min-w-0 w-full items-center gap-2 overflow-hidden rounded-lg px-2 py-2.5 transition-colors group min-h-[44px] max-[1366px]:min-h-[34px] max-[1366px]:py-1.5 ${
                isCollapsed ? 'justify-center flex-col gap-0.5 py-2' : ''
              } ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              title={isCollapsed ? item.label : item.label}
            >
              <AppIcon
                name={item.icon}
                variant="nav"
                className={isActive ? '' : 'opacity-70 group-hover:opacity-100 transition-opacity'}
              />
              {isCollapsed ? (
                <span className="text-[9px] leading-tight text-center whitespace-nowrap max-[1366px]:text-[8px]">
                  {collapsedLabelMap[item.label] || item.label}
                </span>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium text-sm max-[1366px]:text-xs">{item.label}</span>
              )}
            </Link>
          );
        })}
        
        {/* Settings: icon + label navigate; chevron toggles dropdown */}
        <div className="relative min-w-0 w-full">
          <div
            className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2.5 transition-colors group min-h-[44px] max-[1366px]:min-h-[34px] max-[1366px]:py-1.5 ${
              isCollapsed ? 'justify-center flex-col gap-0.5 py-2' : ''
            } ${
              isSettingsActive
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(true);
                navigate('/admin/settings');
                if (window.innerWidth < 768) setIsMobileOpen(false);
              }}
              className={`flex min-w-0 flex-1 overflow-hidden text-left ${
                isCollapsed ? 'flex-col items-center justify-center gap-0.5' : 'items-center gap-2'
              }`}
              title={isCollapsed ? collapsedLabelMap.Settings : 'Settings'}
            >
              <AppIcon
                name="settings"
                variant="nav"
                className={`shrink-0 ${isSettingsActive ? '' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`}
              />
              {isCollapsed ? (
                <span className="text-[9px] leading-tight text-center whitespace-nowrap max-[1366px]:text-[8px]">
                  {collapsedLabelMap.Settings}
                </span>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium text-sm max-[1366px]:text-xs">Settings</span>
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
            <div className="ml-1.5 mt-1 min-w-0 space-y-0.5 border-l-2 border-slate-200 pl-2">
              <Link
                to="/admin/users"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={subNavLinkClass(
                  location.pathname === '/admin/users' || location.pathname.startsWith('/admin/users/')
                )}
                title="Employees"
              >
                <span className="material-symbols-outlined shrink-0 text-[18px]">group</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">Employees</span>
              </Link>
              <Link
                to="/admin/services"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={subNavLinkClass(
                  location.pathname === '/admin/services' || location.pathname.startsWith('/admin/services/')
                )}
                title="Service List"
              >
                <span className="material-symbols-outlined shrink-0 text-[18px]">list_alt</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">Service List</span>
              </Link>
              <Link
                to="/admin/entity-master"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={subNavLinkClass(location.pathname === '/admin/entity-master')}
                title="Entity Master Data"
              >
                <span className="material-symbols-outlined shrink-0 text-[18px]">corporate_fare</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">Entity Master Data</span>
              </Link>
              <Link
                to="/admin/entities"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={subNavLinkClass(
                  location.pathname === '/admin/entities' || location.pathname.startsWith('/admin/entities/')
                )}
                title="Entity List"
              >
                <span className="material-symbols-outlined shrink-0 text-[18px]">groups</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">Entity List</span>
              </Link>
              <Link
                to="/admin/settings/organisation-structure"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={subNavLinkClass(
                  location.pathname === '/admin/settings/org-definition' ||
                    location.pathname === '/admin/settings/organisation-structure' ||
                    location.pathname.startsWith('/admin/settings/reporting-hierarchy')
                )}
                title="Organisation Structure"
              >
                <span className="material-symbols-outlined shrink-0 text-[18px]">account_tree</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">Organisation Structure</span>
              </Link>
              <Link
                to="/admin/settings/user-config"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileOpen(false);
                  }
                }}
                className={subNavLinkClass(location.pathname === '/admin/settings/user-config')}
                title="User configuration"
              >
                <span className="material-symbols-outlined shrink-0 text-[18px]">tune</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">User configuration</span>
              </Link>
            </div>
          )}
        </div>
      </nav>
      <div className={`shrink-0 p-4 border-t border-slate-100 space-y-2 max-[1366px]:p-2 max-[1366px]:space-y-0.5 ${isCollapsed ? 'px-2 max-[1366px]:px-1.5' : ''}`}>
        <button
          onClick={() => {
            navigate('/profile');
            if (window.innerWidth < 768) {
              setIsMobileOpen(false);
            }
          }}
          className={`flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl px-2 py-2.5 transition-colors min-h-[44px] max-[1366px]:min-h-[34px] max-[1366px]:py-1.5 ${
            isCollapsed ? 'justify-center' : ''
          } ${
            location.pathname === '/profile'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-500 hover:text-primary hover:bg-slate-100'
          }`}
          title={isCollapsed ? 'Profile' : ''}
        >
          <span className="material-icons-outlined text-2xl shrink-0 max-[1366px]:text-xl">person</span>
          {!isCollapsed && <span className="min-w-0 flex-1 truncate font-medium text-sm max-[1366px]:text-xs">Profile</span>}
        </button>
        <button
          onClick={() => {
            showLogoutConfirm(toast, logout, navigate, {
              onAfterConfirm: () => {
                if (window.innerWidth < 768) setIsMobileOpen(false);
              },
            });
          }}
          className={`flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-xl px-2 py-2.5 transition-colors min-h-[44px] max-[1366px]:min-h-[34px] max-[1366px]:py-1.5 ${
            isCollapsed ? 'justify-center' : ''
          } text-slate-500 hover:text-red-500 hover:bg-red-50`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <span className="material-icons-outlined text-2xl shrink-0 max-[1366px]:text-xl">logout</span>
          {!isCollapsed && <span className="min-w-0 flex-1 truncate font-medium text-sm max-[1366px]:text-xs">Logout</span>}
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
        className={`hidden md:flex h-full shrink-0 z-20 flex-col overflow-hidden border-r border-slate-200 bg-white font-body transition-all duration-300 ${
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
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 md:hidden ${
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

