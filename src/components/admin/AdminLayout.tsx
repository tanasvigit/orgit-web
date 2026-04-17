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

  // Redirect if not admin
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AdminSidebar onToggleRef={sidebarToggleRef} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-background">
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

