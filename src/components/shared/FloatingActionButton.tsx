import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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

  // const handleCreateCompliance = () => {
  //   if (onOpenCompliancePage) {
  //     onOpenCompliancePage();
  //   } else {
  //     navigate(isAdmin ? '/admin/compliance/create' : '/compliance');
  //   }
  //   setIsOpen(false);
  // };

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={menuRef}>
      {/* Menu Items */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 mb-2 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
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

          {/* Create Task */}
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
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full bg-primary text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center ${
          isOpen ? 'rotate-45' : 'hover:scale-110'
        }`}
        title="Create"
      >
        <span className="material-symbols-outlined text-3xl">
          {isOpen ? 'close' : 'add'}
        </span>
      </button>
    </div>
  );
};
