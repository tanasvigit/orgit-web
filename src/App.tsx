import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ChangePasswordPopup } from './components/auth/ChangePasswordPopup';
import './App.css';

// Lazy-loaded route screens (named-export pattern)
const Login = lazy(() => import('./screens/auth/Login').then(m => ({ default: m.Login })));
const ForgotPassword = lazy(() => import('./screens/auth/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./screens/auth/ResetPassword').then(m => ({ default: m.ResetPassword })));
const MobileNumberRegistration = lazy(() => import('./screens/auth/MobileNumberRegistration').then(m => ({ default: m.MobileNumberRegistration })));
const OTPVerification = lazy(() => import('./screens/auth/OTPVerification').then(m => ({ default: m.OTPVerification })));
const UserProfileCreation = lazy(() => import('./screens/auth/UserProfileCreation').then(m => ({ default: m.UserProfileCreation })));
const EmployeeDashboard = lazy(() => import('./screens/dashboard/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })));
const MainMessagingScreen = lazy(() => import('./screens/messaging/MainMessagingScreen').then(m => ({ default: m.MainMessagingScreen })));
const NewChatScreen = lazy(() => import('./screens/messaging/NewChatScreen').then(m => ({ default: m.NewChatScreen })));
const DirectChatConversation = lazy(() => import('./screens/messaging/DirectChatConversation').then(m => ({ default: m.DirectChatConversation })));
const TaskGroupChatConversation = lazy(() => import('./screens/messaging/TaskGroupChatConversation').then(m => ({ default: m.TaskGroupChatConversation })));
const TaskCreationScreen = lazy(() => import('./screens/tasks/TaskCreationScreen').then(m => ({ default: m.TaskCreationScreen })));
const TaskDashboardScreen = lazy(() => import('./screens/tasks/TaskDashboardScreen').then(m => ({ default: m.TaskDashboardScreen })));
const TaskDetailsScreen = lazy(() => import('./screens/tasks/TaskDetailsScreen').then(m => ({ default: m.TaskDetailsScreen })));
const DocumentManagementHome = lazy(() => import('./screens/documents/DocumentManagementHome').then(m => ({ default: m.DocumentManagementHome })));
const DocumentLibrary = lazy(() => import('./screens/admin/documents/DocumentLibrary').then(m => ({ default: m.DocumentLibrary })));
const CreateDocument = lazy(() => import('./screens/admin/documents/CreateDocument').then(m => ({ default: m.CreateDocument })));
const DocumentViewer = lazy(() => import('./screens/admin/documents/DocumentViewer').then(m => ({ default: m.DocumentViewer })));
const AdminSettings = lazy(() => import('./screens/settings/AdminSettings').then(m => ({ default: m.AdminSettings })));
const SuperAdminDashboard = lazy(() => import('./screens/super-admin/Dashboard').then(m => ({ default: m.Dashboard })));
const OrganizationList = lazy(() => import('./screens/super-admin/organizations/OrganizationList').then(m => ({ default: m.OrganizationList })));
const OrganizationDetail = lazy(() => import('./screens/super-admin/organizations/OrganizationDetail').then(m => ({ default: m.OrganizationDetail })));
const OrganizationForm = lazy(() => import('./screens/super-admin/organizations/OrganizationForm').then(m => ({ default: m.OrganizationForm })));
const DocumentTemplateList = lazy(() => import('./screens/super-admin/document-templates/DocumentTemplateList').then(m => ({ default: m.DocumentTemplateList })));
const DocumentTemplateForm = lazy(() => import('./screens/super-admin/document-templates/DocumentTemplateForm').then(m => ({ default: m.DocumentTemplateForm })));
const TaskMonitoring = lazy(() => import('./screens/super-admin/tasks/TaskMonitoring').then(m => ({ default: m.TaskMonitoring })));
const TestSuperAdmin = lazy(() => import('./screens/super-admin/TestSuperAdmin').then(m => ({ default: m.TestSuperAdmin })));
const UserList = lazy(() => import('./screens/super-admin/users/UserList').then(m => ({ default: m.UserList })));
const EmployeeList = lazy(() => import('./screens/admin/employees/EmployeeList').then(m => ({ default: m.EmployeeList })));
const PlatformSettings = lazy(() => import('./screens/super-admin/settings/PlatformSettings').then(m => ({ default: m.PlatformSettings })));
const AdminDashboard = lazy(() => import('./screens/admin/Dashboard').then(m => ({ default: m.AdminDashboard })));
const EntityMasterData = lazy(() => import('./screens/admin/EntityMasterData').then(m => ({ default: m.EntityMasterData })));
const ServiceList = lazy(() => import('./screens/admin/ServiceList').then(m => ({ default: m.ServiceList })));
const EntityList = lazy(() => import('./screens/admin/EntityList').then(m => ({ default: m.EntityList })));
const ProfileScreen = lazy(() => import('./screens/profile/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const UserProfileScreen = lazy(() => import('./screens/profile/UserProfileScreen').then(m => ({ default: m.UserProfileScreen })));
// Note: internal ProfileSettings screen has been replaced by an external profile app
// const ProfileSettings = lazy(() => import('./screens/settings/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const _ProfileSettings = lazy(() => import('./screens/settings/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const ChangePassword = lazy(() => import('./screens/settings/ChangePassword').then(m => ({ default: m.ChangePassword })));
const ThemeSettings = lazy(() => import('./screens/settings/ThemeSettings').then(m => ({ default: m.ThemeSettings })));
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const Departments = lazy(() => import('./screens/admin/settings/Departments').then(m => ({ default: m.Departments })));
const Designations = lazy(() => import('./screens/admin/settings/Designations').then(m => ({ default: m.Designations })));
const ReportingHierarchy = lazy(() => import('./screens/admin/settings/ReportingHierarchy').then(m => ({ default: m.ReportingHierarchy })));
const ReminderConfig = lazy(() => import('./screens/admin/settings/ReminderConfig').then(m => ({ default: m.ReminderConfig })));
const AutoEscalationConfig = lazy(() => import('./screens/admin/settings/AutoEscalationConfig').then(m => ({ default: m.AutoEscalationConfig })));
const RecurringTaskSettings = lazy(() => import('./screens/admin/settings/RecurringTaskSettings').then(m => ({ default: m.RecurringTaskSettings })));
const OrganisationStructureScreen = lazy(() => import('./screens/admin/settings/OrganisationStructureScreen').then(m => ({ default: m.OrganisationStructureScreen })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-primary">Loading...</div>
  </div>
);

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

  // Allow admin/super_admin to access settings and profile routes
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const isProfileRoute = location.pathname.startsWith('/profile');

  // Redirect admin users to admin dashboard (except for settings and profile routes)
  if (user?.role === 'admin' && !isSettingsRoute && !isProfileRoute) {
    return <Navigate to="/admin" replace />;
  }

  // Redirect super_admin users to super admin dashboard (except for settings and profile routes)
  if (user?.role === 'super_admin' && !isSettingsRoute && !isProfileRoute) {
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

const _AdminOrSuperAdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

// Simple component to redirect the user to the external profile application
const ExternalProfileRedirect: React.FC = () => {
  useEffect(() => {
    window.location.href = 'http://localhost:3001/profile';
  }, []);
  return null;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
        <Router>
          <ChangePasswordPopup />
          <Routes>
            <Route path="/login" element={<Suspense fallback={<RouteFallback />}><Login /></Suspense>} />
            <Route path="/forgot-password" element={<Suspense fallback={<RouteFallback />}><ForgotPassword /></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<RouteFallback />}><ResetPassword /></Suspense>} />
            <Route path="/register" element={<Suspense fallback={<RouteFallback />}><MobileNumberRegistration /></Suspense>} />
            <Route path="/otp-verification" element={<Suspense fallback={<RouteFallback />}><OTPVerification /></Suspense>} />
            <Route path="/profile-setup" element={<Suspense fallback={<RouteFallback />}><UserProfileCreation /></Suspense>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><EmployeeDashboard /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><MainMessagingScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/new"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><NewChatScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/:conversationId"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Suspense fallback={<RouteFallback />}><DirectChatConversation /></Suspense>
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages/task-group/:conversationId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskGroupChatConversation /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks/task-group/:conversationId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskDashboardScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskDashboardScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks/create"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskCreationScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks/:taskId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskDetailsScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><DocumentManagementHome /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents/create"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><CreateDocument /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents/create/:templateId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><CreateDocument /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents/:id"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><DocumentViewer /></Suspense>
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
                  <Suspense fallback={<RouteFallback />}><SettingsScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/profile"
              element={
                <ProtectedRoute>
                  {/* Redirect to external profile app */}
                  <ExternalProfileRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/change-password"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><ChangePassword /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/theme"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><ThemeSettings /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><ProfileScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><UserProfileScreen /></Suspense>
                </ProtectedRoute>
              }
            />
            {/* Super Admin Routes */}
            {/* Test route - remove after debugging */}
            <Route
              path="/super-admin-test"
              element={<Suspense fallback={<RouteFallback />}><TestSuperAdmin /></Suspense>}
            />
            <Route
              path="/super-admin"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><SuperAdminDashboard /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><OrganizationList /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/users"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><UserList /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations/create"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><OrganizationForm /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations/:id"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><OrganizationDetail /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/organizations/:id/edit"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><OrganizationForm /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/document-templates"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><DocumentTemplateList /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/document-templates/create"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><DocumentTemplateForm /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/document-templates/:id"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><DocumentTemplateForm /></Suspense>
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
                  <Suspense fallback={<RouteFallback />}><TaskMonitoring /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            <Route
              path="/super-admin/settings"
              element={
                <SuperAdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><PlatformSettings /></Suspense>
                </SuperAdminProtectedRoute>
              }
            />
            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><AdminDashboard /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><MainMessagingScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages/new"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><NewChatScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages/:conversationId"
              element={
                <AdminProtectedRoute>
                  <ErrorBoundary>
                    <Suspense fallback={<RouteFallback />}><DirectChatConversation /></Suspense>
                  </ErrorBoundary>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages/task-group/:conversationId"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskGroupChatConversation /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks/task-group/:conversationId"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskDashboardScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskDashboardScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks/create"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskCreationScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks/:taskId"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><TaskDetailsScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><DocumentLibrary /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents/create"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><CreateDocument /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents/create/:templateId"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><CreateDocument /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/documents/:id"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><DocumentViewer /></Suspense>
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
                  <Suspense fallback={<RouteFallback />}><EmployeeList /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/entity-master"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><EntityMasterData /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/services"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><ServiceList /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/entities"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><EntityList /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><SettingsScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/organisation-structure"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><OrganisationStructureScreen /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/departments"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><Departments /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/designations"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><Designations /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/reporting-hierarchy"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><ReportingHierarchy /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/reminder-config"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><ReminderConfig /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/auto-escalation"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><AutoEscalationConfig /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings/recurring-tasks"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><RecurringTaskSettings /></Suspense>
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/configuration/notifications"
              element={
                <AdminProtectedRoute>
                  <Suspense fallback={<RouteFallback />}><AdminSettings /></Suspense>
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
