import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { FloatingActionButton } from '../shared/FloatingActionButton';
import { TaskCreateModal } from '../tasks/TaskCreateModal';
import { useQueryClient } from 'react-query';

interface AdminLayoutProps {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  hideHeader?: boolean;
  hideSearch?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, headerActions, hideHeader = false, hideSearch = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);

  // Redirect if not admin
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background">
        {!hideHeader && (
          <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
            <div className="flex items-center gap-4">
              <button className="md:hidden text-text-main">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span>Dashboard</span>
                <span className="material-symbols-outlined text-base">chevron_right</span>
                <span className="font-semibold text-text-main">Admin Panel</span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              {headerActions}
              {!hideSearch && (
                <div className="relative hidden sm:block">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
                    search
                  </span>
                  <input
                    className="bg-slate-100 border border-transparent hover:border-border focus:border-primary-600 rounded-full py-2 pl-10 pr-4 text-sm text-text-main focus:ring-0 focus:outline-none w-64 placeholder:text-text-muted transition-all"
                    placeholder="Search..."
                    type="text"
                  />
                </div>
              )}
              <button className="relative text-text-muted hover:text-primary-700 transition-colors">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-0.5 right-0.5 size-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              </button>
              
              {/* Profile Dropdown */}
              <div className="relative z-[100]" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  {user?.profilePhotoUrl ? (
                    <img
                      src={user.profilePhotoUrl}
                      alt={user.name || 'Admin'}
                      className="w-8 h-8 rounded-full object-cover border-2 border-slate-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                      {user?.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                  )}
                  <span className="material-symbols-outlined text-text-muted text-lg">expand_more</span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-[100]">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">{user?.name || 'Admin'}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@orgit.com'}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate('/profile');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">person</span>
                        View Profile
                      </button>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          navigate('/settings');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">settings</span>
                        Settings
                      </button>
                    </div>
                    <div className="border-t border-slate-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton 
        isAdmin={true}
        onOpenTaskModal={() => setShowTaskCreateModal(true)}
        onOpenDocumentPage={() => navigate('/admin/documents/create')}
        onOpenCompliancePage={() => navigate('/admin/compliance/create')}
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

