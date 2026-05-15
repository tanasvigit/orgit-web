import React, { useRef, useState } from 'react';
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

export const AdminLayout: React.FC<AdminLayoutProps> = (props) => {
  const { children } = props;
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const sidebarToggleRef = useRef<(() => void) | null>(null);

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <AdminSidebar onToggleRef={sidebarToggleRef} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto w-full">{children}</main>
      </div>

      <FloatingActionButton
        isAdmin={true}
        onOpenTaskModal={() => setShowTaskCreateModal(true)}
        onOpenDocumentPage={() => navigate('/admin/documents/create')}
        onOpenCompliancePage={() => navigate('/admin/compliance/create')}
      />

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
