import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { organizationService } from '../../../services/organizationService';

export const OrganizationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'tasks' | 'stats'>('info');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: org, isLoading } = useQuery(
    ['organization', id],
    () => organizationService.getById(id!).then((res) => res.data.data),
    { enabled: !!id }
  );

  const { data: users } = useQuery(
    ['organizationUsers', id],
    () => organizationService.getUsers(id!).then((res) => res.data.data),
    { enabled: !!id && activeTab === 'users' }
  );

  const { data: tasks } = useQuery(
    ['organizationTasks', id],
    () => organizationService.getTasks(id!).then((res) => res.data.data),
    { enabled: !!id && activeTab === 'tasks' }
  );

  const { data: stats } = useQuery(
    ['organizationStats', id],
    () => organizationService.getStats(id!).then((res) => res.data.data),
    { enabled: !!id && activeTab === 'stats' }
  );

  const handleDelete = async () => {
    if (!id) return;
    
    setIsDeleting(true);
    try {
      await organizationService.delete(id);
      queryClient.invalidateQueries(['organizations']);
      navigate('/super-admin/organizations');
    } catch (error: any) {
      alert(`Error deleting organization: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">Loading...</div>
      </SuperAdminLayout>
    );
  }

  if (!org) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center min-h-screen">Organization not found</div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout
      breadcrumbs={[
        { label: 'Organisations', path: '/super-admin/organizations' },
        { label: org.name },
      ]}
    >
      <div className="max-w-[1600px] mx-auto p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-2xl">
              {org.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{org.name}</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1 text-base">Organization details and management</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              to={`/super-admin/organizations/${id}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-super-admin-surface-dark hover:bg-gray-50 rounded-lg font-medium"
            >
              <span className="material-symbols-outlined text-xl">edit</span>
              Edit Organisation
            </Link>
            <button
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              <span className="material-symbols-outlined text-xl">delete</span>
              Delete Organisation
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {(['info', 'users', 'tasks', 'stats'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-super-admin-primary text-super-admin-primary'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark overflow-hidden">
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Organization Details Section */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-super-admin-primary text-2xl">business</span>
                  Organization Details
                </h3>
                <div className="flex flex-col md:flex-row gap-8">
                  {org.logoUrl && (
                    <div className="w-full md:w-1/3">
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Company Logo</label>
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 p-4 flex items-center justify-center min-h-[200px]">
                        <img
                          src={org.logoUrl}
                          alt="Company Logo"
                          className="max-w-full max-h-[180px] object-contain rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                  <div className={`w-full ${org.logoUrl ? 'md:w-2/3' : 'md:w-full'} space-y-5`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Organization Name</label>
                      <p className="text-base font-semibold text-gray-900 dark:text-white">{org.name || '-'}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Email Address</label>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-gray-400 text-lg">mail</span>
                          <p className="text-base text-gray-900 dark:text-white">{org.email || '-'}</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Mobile Number</label>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-gray-400 text-lg">phone</span>
                          <p className="text-base text-gray-900 dark:text-white">{org.mobile || '-'}</p>
                        </div>
                      </div>
                    </div>
                    {org.address && (
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Registered Address</label>
                        <p className="text-base text-gray-900 dark:text-white whitespace-pre-line">{org.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Statutory Details Section */}
              <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-super-admin-primary text-2xl">gavel</span>
                  Statutory Details (Entity Master Data)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">GST Number</label>
                    <p className="text-base font-mono uppercase tracking-wide text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                      {org.gst || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">PAN Number</label>
                    <p className="text-base font-mono uppercase tracking-wide text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                      {org.pan || '-'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">CIN Number</label>
                    <p className="text-base font-mono uppercase tracking-wide text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                      {org.cin || '-'}
                    </p>
                  </div>
                  {org.accountingYearStart && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">Accounting Year Start</label>
                      <p className="text-base text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                        {new Date(org.accountingYearStart).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Users ({users?.length || 0})</h3>
              <div className="space-y-2">
                {users?.map((user: any) => (
                  <div key={user.id} className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                    <p className="font-medium text-gray-900 dark:text-white">{user.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.mobile} • {user.role}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tasks ({tasks?.total || 0})</h3>
              <div className="space-y-2">
                {tasks?.tasks?.map((task: any) => (
                  <div key={task.id} className="p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800">
                    <p className="font-medium text-gray-900 dark:text-white">{task.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Status: {task.status}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'stats' && stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalTasks}</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Tasks</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeTasks}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
                <p className="text-sm text-gray-500 dark:text-gray-400">Overdue Tasks</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.overdueTasks}</p>
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-super-admin-surface-dark rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Delete Organization</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                Are you sure you want to delete <strong>{org.name}</strong>? This action cannot be undone and will delete all associated users, tasks, and data.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
};

