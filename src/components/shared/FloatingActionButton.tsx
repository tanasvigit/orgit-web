import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEmployeePermissions } from '../../hooks/useEmployeePermissions';

interface FloatingActionButtonProps {
  isAdmin?: boolean;
  onOpenTaskModal?: () => void;
  onOpenDocumentPage?: () => void;
  // onOpenCompliancePage?: () => void;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  isAdmin = false,
  onOpenTaskModal,
  onOpenDocumentPage,
  // onOpenCompliancePage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    canAccessModule,
    canCreateTask,
    canUploadDocument,
  } = useEmployeePermissions();

  const isOnTasksModule = /^\/(?:admin\/)?tasks(\/|$)/.test(location.pathname);

  const showMessageAction = canAccessModule('Messaging');
  const showDocumentAction = canUploadDocument() && canAccessModule('Documents');
  const showTaskAction = canCreateTask() && canAccessModule('Tasks');
  const hasAnyAction = showMessageAction || showDocumentAction || showTaskAction;

  const closeMenu = useCallback(() => setIsOpen(false), []);
  useClickOutside(menuRef, closeMenu, isOpen);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleCreateTask = () => {
    if (onOpenTaskModal) {
      onOpenTaskModal();
    } else {
      navigate(isAdmin ? '/admin/tasks/create' : '/tasks/create');
    }
    setIsOpen(false);
  };

  const handleCreateDocument = () => {
    if (onOpenDocumentPage) {
      onOpenDocumentPage();
    } else {
      navigate(isAdmin ? '/admin/documents/create' : '/documents/create');
    }
    setIsOpen(false);
  };

  const handleNewMessage = () => {
    navigate(isAdmin ? '/admin/messages' : '/messages', {
      state: { openNewChatModal: true },
    });
    setIsOpen(false);
  };

  // const handleCreateCompliance = () => {
  //   if (onOpenCompliancePage) {
  //     onOpenCompliancePage();
  //   } else {
  //     navigate(isAdmin ? '/admin/compliance/create' : '/compliance');
  //   }
  //   setIsOpen(false);
  // };

  if (isOnTasksModule || (!hasAnyAction && !isAdmin)) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={menuRef}>
      {/* Menu Items */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 mb-2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* New Message */}
          {showMessageAction && (
          <button
            onClick={handleNewMessage}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-gray-200 dark:border-gray-700 min-w-[200px] group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">
                chat
              </span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">New Message</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Start a new chat</div>
            </div>
          </button>
          )}

          {/* Create Compliance Task */}
          {/* <button
            onClick={handleCreateCompliance}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-gray-200 dark:border-gray-700 min-w-[200px] group"
          >
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-xl">
                gavel
              </span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">{isAdmin ? 'Create Compliance' : 'Compliance Tasks'}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {isAdmin ? 'New compliance requirement' : 'View & assign compliance'}
              </div>
            </div>
          </button> */}

          {/* Create Document */}
          {showDocumentAction && (
          <button
            onClick={handleCreateDocument}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-gray-200 dark:border-gray-700 min-w-[200px] group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">
                description
              </span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Create Document</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">New document</div>
            </div>
          </button>
          )}

          {/* Create Task */}
          {showTaskAction && (
          <button
            onClick={handleCreateTask}
            className="flex items-center gap-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-gray-200 dark:border-gray-700 min-w-[200px] group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors">
              <span className="material-symbols-outlined text-primary text-xl">
                assignment
              </span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">Create Task</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">New task</div>
            </div>
          </button>
          )}
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center ${
          isOpen ? 'rotate-45' : 'hover:scale-110'
        }`}
        title="Create"
        aria-label="Create"
      >
        <span className="material-symbols-outlined text-3xl">
          {isOpen ? 'close' : 'add'}
        </span>
      </button>
    </div>
  );
};
