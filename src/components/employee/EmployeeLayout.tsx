import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmployeeSidebar } from './EmployeeSidebar';
import { FloatingActionButton } from '../shared/FloatingActionButton';
import { TaskCreateModal } from '../tasks/TaskCreateModal';
import { useQueryClient } from 'react-query';
import { useEmployeePermissions } from '../../hooks/useEmployeePermissions';

interface EmployeeLayoutProps {
  children: React.ReactNode;
  showConversationList?: boolean;
  conversationListContent?: React.ReactNode;
  showRightSidebar?: boolean;
  rightSidebarContent?: React.ReactNode;
  headerActions?: React.ReactNode;
  hideHeader?: boolean;
  hideSearch?: boolean;
  /** When true, page content fills the viewport; child panels manage their own scroll. */
  contentFitViewport?: boolean;
}

export const EmployeeLayout: React.FC<EmployeeLayoutProps> = (props) => {
  const {
    children,
    showConversationList = false,
    conversationListContent,
    showRightSidebar = false,
    rightSidebarContent,
    contentFitViewport = false,
  } = props;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreateTask, canUploadDocument, canAccessModule } = useEmployeePermissions();
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const sidebarToggleRef = useRef<(() => void) | null>(null);

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark overflow-hidden font-sans text-text-light dark:text-text-dark transition-colors duration-200">
      {/* Left Sidebar Navigation */}
      <EmployeeSidebar onToggleRef={sidebarToggleRef} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background-light dark:bg-background-dark">
        {/* Content Area with Conversation List and Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation List Panel (optional) */}
          {showConversationList && (
            <div className="w-80 md:w-96 bg-background-light dark:bg-background-dark flex flex-col border-r border-border-light dark:border-border-dark relative overflow-hidden">
              {conversationListContent}
            </div>
          )}

          {/* Main Content */}
          <main
            className={`flex-1 min-h-0 overflow-x-hidden ${
              contentFitViewport ? 'overflow-hidden' : 'overflow-y-auto'
            }`}
          >
            {children}
          </main>
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
        onOpenTaskModal={
          canCreateTask() ? () => setShowTaskCreateModal(true) : undefined
        }
        onOpenDocumentPage={
          canUploadDocument() && canAccessModule('Documents')
            ? () => navigate('/documents/create')
            : undefined
        }
        onOpenCompliancePage={() => navigate('/compliance')}
      />

      {/* Task Create Modal */}
      {canCreateTask() && (
      <TaskCreateModal
        visible={showTaskCreateModal}
        onClose={() => setShowTaskCreateModal(false)}
        onSuccess={() => {
          setShowTaskCreateModal(false);
          queryClient.invalidateQueries(['tasks']);
          queryClient.invalidateQueries(['dashboard']);
        }}
      />
      )}
    </div>
  );
};

