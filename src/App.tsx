import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
// import { BottomNav } from './components/shared'; // Not used in super admin routes
import { MobileNumberRegistration } from './screens/auth/MobileNumberRegistration';
import { Login } from './screens/auth/Login';
import { OTPVerification } from './screens/auth/OTPVerification';
import { UserProfileCreation } from './screens/auth/UserProfileCreation';
import { EmployeeDashboard } from './screens/dashboard/EmployeeDashboard';
import { MainMessagingScreen } from './screens/messaging/MainMessagingScreen';
import { NewChatScreen } from './screens/messaging/NewChatScreen';
import { DirectChatConversation } from './screens/messaging/DirectChatConversation';
import { TaskGroupChatConversation } from './screens/messaging/TaskGroupChatConversation';
import { TaskCreationScreen } from './screens/tasks/TaskCreationScreen';
import { TaskDashboardScreen } from './screens/tasks/TaskDashboardScreen';
import { TaskDetailsScreen } from './screens/tasks/TaskDetailsScreen';
import { TaskChatScreen } from './screens/tasks/TaskChatScreen';
import { DocumentManagementHome } from './screens/documents/DocumentManagementHome';
import { DocumentLibrary } from './screens/admin/documents/DocumentLibrary';
import { CreateDocument } from './screens/admin/documents/CreateDocument';
import { DocumentViewer } from './screens/admin/documents/DocumentViewer';
// import { ComplianceManagementHome } from './screens/compliance/ComplianceManagementHome';
// import { ComplianceView } from './screens/compliance/ComplianceView';
import { AdminSettings } from './screens/settings/AdminSettings';
import { Dashboard as SuperAdminDashboard } from './screens/super-admin/Dashboard';
import { OrganizationList } from './screens/super-admin/organizations/OrganizationList';
import { OrganizationDetail } from './screens/super-admin/organizations/OrganizationDetail';
import { OrganizationForm } from './screens/super-admin/organizations/OrganizationForm';
import { DocumentTemplateList } from './screens/super-admin/document-templates/DocumentTemplateList';
import { DocumentTemplateForm } from './screens/super-admin/document-templates/DocumentTemplateForm';
// import { ComplianceList } from './screens/super-admin/compliance/ComplianceList';
// import { ComplianceForm } from './screens/super-admin/compliance/ComplianceForm';
// import { AdminComplianceForm } from './screens/admin/compliance/AdminComplianceForm';
import { TaskMonitoring } from './screens/super-admin/tasks/TaskMonitoring';
import { TestSuperAdmin } from './screens/super-admin/TestSuperAdmin';
import { UserList } from './screens/super-admin/users/UserList';
import { EmployeeList } from './screens/admin/employees/EmployeeList';
import { PlatformSettings } from './screens/super-admin/settings/PlatformSettings';
import { AdminDashboard } from './screens/admin/Dashboard';
import { EntityMasterData } from './screens/admin/EntityMasterData';
import { ServiceList } from './screens/admin/ServiceList';
import { EntityList } from './screens/admin/EntityList';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { UserProfileScreen } from './screens/profile/UserProfileScreen';
import { ProfileSettings } from './screens/settings/ProfileSettings';
import { ChangePassword } from './screens/settings/ChangePassword';
import { ThemeSettings } from './screens/settings/ThemeSettings';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { Departments } from './screens/admin/settings/Departments';
import { Designations } from './screens/admin/settings/Designations';
import { ReportingHierarchy } from './screens/admin/settings/ReportingHierarchy';
import { ReminderConfig } from './screens/admin/settings/ReminderConfig';
import { AutoEscalationConfig } from './screens/admin/settings/AutoEscalationConfig';
import { RecurringTaskSettings } from './screens/admin/settings/RecurringTaskSettings';
import { OrganisationStructureScreen } from './screens/admin/settings/OrganisationStructureScreen';
import { ChangePasswordPopup } from './components/auth/ChangePasswordPopup';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-primary">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Allow admin users to access settings routes
  const isSettingsRoute = location.pathname.startsWith('/settings');
  
  // Redirect admin users to admin dashboard (except for settings routes)
  if (user?.role === 'admin' && !isSettingsRoute) {
    return <Navigate to="/admin" replace />;
  }

  // Redirect super_admin users to super admin dashboard (except for settings routes)
  if (user?.role === 'super_admin' && !isSettingsRoute) {
    return <Navigate to="/super-admin" replace />;
  }

  return <>{children}</>;
};

const SuperAdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-primary">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-primary">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AdminOrSuperAdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-primary">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
        <Router>
          <ChangePasswordPopup />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<MobileNumberRegistration />} />
            <Route path="/otp-verification" element={<OTPVerification />} />
            <Route path="/profile-setup" element={<UserProfileCreation />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MainMessagingScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/new"
              element={
                <ProtectedRoute>
                  <NewChatScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <DirectChatConversation />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/task-group/:conversationId"
              element={
                <ProtectedRoute>
                  <TaskGroupChatConversation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks/task-group/:conversationId"
              element={
                <ProtectedRoute>
                  <TaskGroupChatConversation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <TaskDashboardScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks/create"
              element={
                <ProtectedRoute>
                  <TaskCreationScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks/:taskId"
              element={
                <ProtectedRoute>
                  <TaskDetailsScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <DocumentManagementHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents/create"
              element={
                <ProtectedRoute>
                  <CreateDocument />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents/create/:templateId"
              element={
                <ProtectedRoute>
                  <CreateDocument />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents/:id"
              element={
                <ProtectedRoute>
                  <DocumentViewer />
                </ProtectedRoute>
              }
            />
            {/* <Route
              path="/compliance"
              element={
                <ProtectedRoute>
                  <ComplianceManagementHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compliance/:id"
              element={
                <ProtectedRoute>
                  <ComplianceView />
                </ProtectedRoute>
              }
            /> */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/profile"
              element={
                <ProtectedRoute>
                  <ProfileSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/theme"
              element={
                <ProtectedRoute>
                  <ThemeSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfileScreen />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <ProtectedRoute>
                  <UserProfileScreen />
                </ProtectedRoute>
              }
            />
            {/* Super Admin Routes */}
            {/* Test route - remove after debugging */}
            <Route
              path="/super-admin-test"
              element={<TestSuperAdmin />}
            />
            <Route
              path="/super-admin"
              element={
                <SuperAdminProtectedRoute>
                  <SuperAdminDashboard />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations"
              element={
                <SuperAdminProtectedRoute>
                  <OrganizationList />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/users"
              element={
                <SuperAdminProtectedRoute>
                  <UserList />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations/create"
              element={
                <SuperAdminProtectedRoute>
                  <OrganizationForm />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations/:id"
              element={
                <SuperAdminProtectedRoute>
                  <OrganizationDetail />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations/:id/edit"
              element={
                <SuperAdminProtectedRoute>
                  <OrganizationForm />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/document-templates"
              element={
                <SuperAdminProtectedRoute>
                  <DocumentTemplateList />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/document-templates/create"
              element={
                <SuperAdminProtectedRoute>
                  <DocumentTemplateForm />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/document-templates/:id"
              element={
                <SuperAdminProtectedRoute>
                  <DocumentTemplateForm />
                </SuperAdminProtectedRoute>
              }
            />
            {/* Compliance routes disabled in web */}
            {/*
            <Route
              path="/super-admin/compliance"
              element={
                <AdminOrSuperAdminProtectedRoute>
                  <ComplianceList />
                </AdminOrSuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/compliance/create"
              element={
                <AdminOrSuperAdminProtectedRoute>
                  <ComplianceForm />
                </AdminOrSuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/compliance/:id"
              element={
                <AdminOrSuperAdminProtectedRoute>
                  <ComplianceForm />
                </AdminOrSuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/compliance/:id/edit"
              element={
                <AdminOrSuperAdminProtectedRoute>
                  <ComplianceForm />
                </AdminOrSuperAdminProtectedRoute>
              }
            />
            */}
            <Route
              path="/super-admin/tasks"
              element={
                <SuperAdminProtectedRoute>
                  <TaskMonitoring />
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/settings"
              element={
                <SuperAdminProtectedRoute>
                  <PlatformSettings />
                </SuperAdminProtectedRoute>
              }
            />
            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <AdminDashboard />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages"
              element={
                <AdminProtectedRoute>
                  <MainMessagingScreen />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages/new"
              element={
                <AdminProtectedRoute>
                  <NewChatScreen />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages/:conversationId"
              element={
                <AdminProtectedRoute>
                  <ErrorBoundary>
                    <DirectChatConversation />
                  </ErrorBoundary>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages/task-group/:conversationId"
              element={
                <AdminProtectedRoute>
                  <TaskGroupChatConversation />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks/task-group/:conversationId"
              element={
                <AdminProtectedRoute>
                  <TaskGroupChatConversation />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <AdminProtectedRoute>
                  <TaskDashboardScreen />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks/create"
              element={
                <AdminProtectedRoute>
                  <TaskCreationScreen />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks/:taskId"
              element={
                <AdminProtectedRoute>
                  <TaskDetailsScreen />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents"
              element={
                <AdminProtectedRoute>
                  <DocumentLibrary />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents/create"
              element={
                <AdminProtectedRoute>
                  <CreateDocument />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents/create/:templateId"
              element={
                <AdminProtectedRoute>
                  <CreateDocument />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents/:id"
              element={
                <AdminProtectedRoute>
                  <DocumentViewer />
                </AdminProtectedRoute>
              }
            />
            {/* <Route
              path="/admin/compliance"
              element={
                <AdminProtectedRoute>
                  <ComplianceManagementHome />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/compliance/create"
              element={
                <AdminProtectedRoute>
                  <AdminComplianceForm />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/compliance/:id"
              element={
                <AdminProtectedRoute>
                  <AdminComplianceForm />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/compliance/:id/edit"
              element={
                <AdminProtectedRoute>
                  <AdminComplianceForm />
                </AdminProtectedRoute>
              }
            /> */}
            <Route
              path="/admin/users"
              element={
                <AdminProtectedRoute>
                  <EmployeeList />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/entity-master"
              element={
                <AdminProtectedRoute>
                  <EntityMasterData />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <AdminProtectedRoute>
                  <ServiceList />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/entities"
              element={
                <AdminProtectedRoute>
                  <EntityList />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/organisation-structure"
              element={
                <AdminProtectedRoute>
                  <OrganisationStructureScreen />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/departments"
              element={
                <AdminProtectedRoute>
                  <Departments />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/designations"
              element={
                <AdminProtectedRoute>
                  <Designations />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/reporting-hierarchy"
              element={
                <AdminProtectedRoute>
                  <ReportingHierarchy />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/reminder-config"
              element={
                <AdminProtectedRoute>
                  <ReminderConfig />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/auto-escalation"
              element={
                <AdminProtectedRoute>
                  <AutoEscalationConfig />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/recurring-tasks"
              element={
                <AdminProtectedRoute>
                  <RecurringTaskSettings />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/configuration/notifications"
              element={
                <AdminProtectedRoute>
                  <AdminSettings />
                </AdminProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
