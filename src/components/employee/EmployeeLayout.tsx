import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { EmployeeSidebar } from './EmployeeSidebar';
import { useAuth } from '../../context/AuthContext';
import { FloatingActionButton } from '../shared/FloatingActionButton';
import { TaskCreateModal } from '../tasks/TaskCreateModal';
import { useQueryClient } from 'react-query';

interface EmployeeLayoutProps {
  children: React.ReactNode;
  showConversationList?: boolean;
  conversationListContent?: React.ReactNode;
  showRightSidebar?: boolean;
  rightSidebarContent?: React.ReactNode;
  headerActions?: React.ReactNode;
  hideHeader?: boolean;
  hideSearch?: boolean;
}

export const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({
  children,
  showConversationList = false,
  conversationListContent,
  showRightSidebar = false,
  rightSidebarContent,
  headerActions,
  hideHeader = false,
  hideSearch = false,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const sidebarToggleRef = useRef<(() => void) | null>(null);

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

  // Get breadcrumb based on current route
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/dashboard') return { current: 'Dashboard' };
    if (path.startsWith('/messages')) return { current: 'Messages' };
    if (path.startsWith('/tasks')) return { current: 'Tasks' };
    if (path.startsWith('/documents')) return { current: 'Documents' };
    if (path.startsWith('/compliance')) return { current: 'Compliance' };
    if (path.startsWith('/profile')) return { current: 'Profile' };
    if (path.startsWith('/settings')) return { current: 'Settings' };
    return { current: 'Dashboard' };
  };

  const breadcrumb = getBreadcrumb();

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark overflow-hidden font-sans text-text-light dark:text-text-dark transition-colors duration-200">
      {/* Left Sidebar Navigation */}
      <EmployeeSidebar onToggleRef={sidebarToggleRef} />

      {/* Main Content Area with Header */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-light dark:bg-background-dark">
        {!hideHeader && (
          <header className="h-16 border-b border-border-light dark:border-border-dark bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 md:px-8 shrink-0 z-[100] sticky top-0">
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => sidebarToggleRef.current?.()}
                className="p-2 rounded-lg text-text-main-light dark:text-text-main-dark hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Toggle Sidebar"
                aria-label="Toggle Sidebar"
              >
                <span className="material-symbols-outlined text-xl">menu</span>
              </button>
              <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-text-muted dark:text-gray-400">
                <span className="hidden sm:inline">Dashboard</span>
                <span className="material-symbols-outlined text-sm sm:text-base">chevron_right</span>
                <span className="font-semibold text-text-main-light dark:text-text-main-dark truncate max-w-[120px] sm:max-w-none">{breadcrumb.current}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
              {headerActions}
              <button className="text-text-muted dark:text-gray-400 hover:text-primary-700 dark:hover:text-primary-400 transition-colors">
                <span className="material-symbols-outlined">help</span>
              </button>
              
              {/* Profile Dropdown - fixed positioning so it appears above task/message header */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors"
                  aria-expanded={showProfileMenu}
                  aria-haspopup="true"
                >
                  {user?.profilePhotoUrl ? (
                    <img
                      src={user.profilePhotoUrl}
                      alt={user.name || 'Employee'}
                      className="w-8 h-8 rounded-full object-cover border-2 border-slate-200 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                      {user?.name?.charAt(0).toUpperCase() || 'E'}
                    </div>
                  )}
                  <span className="material-symbols-outlined text-text-muted dark:text-gray-400 text-lg">expand_more</span>
                </button>

                {showProfileMenu && (
                  <div className="fixed right-8 top-20 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700 py-2 z-[9999]">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-700">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name || 'Employee'}</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{user?.email || user?.mobile || 'employee@orgit.com'}</p>
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate('/profile');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-lg">person</span>
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate('/settings');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-lg">settings</span>
                        Settings
                      </button>
                    </div>
                    <div className="border-t border-slate-100 dark:border-gray-700 pt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left w-full"
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
        )}
        
        {/* Content Area with Conversation List and Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation List Panel (optional) */}
          {showConversationList && (
            <div className="w-80 md:w-96 bg-background-light dark:bg-background-dark flex flex-col border-r border-border-light dark:border-border-dark relative overflow-hidden">
              {conversationListContent}
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
        </div>
      </div>

      {/* Right Sidebar (optional) */}
      {showRightSidebar && (
        <aside className="w-72 bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark hidden xl:flex flex-col overflow-y-auto">
          {rightSidebarContent}
        </aside>
      )}

      {/* Floating Action Button */}
      <FloatingActionButton 
        isAdmin={false}
        onOpenTaskModal={() => setShowTaskCreateModal(true)}
        onOpenDocumentPage={() => navigate('/documents/create')}
        onOpenCompliancePage={() => navigate('/compliance')}
      />

      {/* Task Create Modal */}
      <TaskCreateModal
        visible={showTaskCreateModal}
        onClose={() => setShowTaskCreateModal(false)}
        onSuccess={() => {
          setShowTaskCreateModal(false);
          queryClient.invalidateQueries(['tasks']);
          queryClient.invalidateQueries(['dashboard']);
        }}
      />
    </div>
  );
};

