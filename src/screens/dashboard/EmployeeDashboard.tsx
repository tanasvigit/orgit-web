import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../../components/shared';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';

type TaskView = 'self' | 'assigned';

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [taskView, setTaskView] = useState<TaskView>('self');
  const [expandedDM, setExpandedDM] = useState(false);
  const [expandedCM, setExpandedCM] = useState(false);

  const { data: dashboardData, isLoading } = useQuery(
    ['dashboard', taskView],
    () => dashboardService.getDashboard(3),
    { refetchInterval: 30000 } // Refetch every 30 seconds
  );

  const { data: statistics } = useQuery('dashboard-statistics', () =>
    dashboardService.getStatistics()
  );

  const getStatusCount = (status: 'overdue' | 'duesoon' | 'inprogress' | 'completed') => {
    if (!statistics?.data) return 0;
    const prefix = taskView === 'self' ? 'selfTasks' : 'assignedTasks';
    return statistics.data[`${prefix}${status.charAt(0).toUpperCase() + status.slice(1)}`] || 0;
  };

  const renderTaskSection = (
    tasks: any[]
  ) => {
    if (tasks.length === 0) return null;

    return (
      <>
        {tasks.map((task) => {
          const status = task.status === 'overdue' ? 'overdue' :
            task.status === 'completed' ? 'completed' :
              task.daysUntilDue !== null && task.daysUntilDue <= 3 ? 'duesoon' : 'inprogress';

          return (
            <TaskCard
              key={task.id}
              id={task.id}
              title={task.title}
              description={task.description}
              status={status}
              dueDate={task.dueDate}
              category={task.category}
              onClick={() => navigate(`/tasks/${task.id}`)}
            />
          );
        })}
      </>
    );
  };

  const currentTasks = taskView === 'self'
    ? dashboardData?.data?.selfTasks
    : dashboardData?.data?.assignedTasks;

  return (
    <EmployeeLayout>
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Task View Toggle */}
        <div className="bg-background-light dark:bg-background-dark-subtle p-1 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 flex relative max-w-md">
          <label className="flex-1 relative cursor-pointer group">
            <input
              checked={taskView === 'self'}
              onChange={() => setTaskView('self')}
              className="peer sr-only"
              name="task_view"
              type="radio"
              value="self"
            />
            <div className="h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200 text-text-muted dark:text-white/60 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-md">
              Self Tasks
            </div>
          </label>
          <label className="flex-1 relative cursor-pointer group">
            <input
              checked={taskView === 'assigned'}
              onChange={() => setTaskView('assigned')}
              className="peer sr-only"
              name="task_view"
              type="radio"
              value="assigned"
            />
            <div className="h-10 w-full rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-200 text-text-muted dark:text-white/60 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-md">
              Assigned Tasks
            </div>
          </label>
        </div>

        {/* Overview Statistics */}
        <div>
          <h3 className="text-text-main dark:text-white text-xl font-bold mb-6">Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white dark:bg-background-dark-subtle p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-overdue/30 hover:shadow-md transition-all">
              <div className="mb-3 p-3 rounded-full bg-status-overdue/10 text-status-overdue">
                <span className="material-symbols-outlined text-2xl">priority_high</span>
              </div>
              <span className="text-4xl font-bold text-status-overdue mb-2">
                {getStatusCount('overdue')}
              </span>
              <span className="text-sm font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
                Overdue
              </span>
            </div>
            <div className="bg-white dark:bg-background-dark-subtle p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-duesoon/30 hover:shadow-md transition-all">
              <div className="mb-3 p-3 rounded-full bg-status-duesoon/10 text-status-duesoon">
                <span className="material-symbols-outlined text-2xl">hourglass_top</span>
              </div>
              <span className="text-4xl font-bold text-text-main dark:text-white mb-2">
                {getStatusCount('duesoon')}
              </span>
              <span className="text-sm font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
                Due Soon
              </span>
            </div>
            <div className="bg-white dark:bg-background-dark-subtle p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-inprogress/30 hover:shadow-md transition-all">
              <div className="mb-3 p-3 rounded-full bg-status-inprogress/10 text-status-inprogress">
                <span className="material-symbols-outlined text-2xl">pending_actions</span>
              </div>
              <span className="text-4xl font-bold text-text-main dark:text-white mb-2">
                {getStatusCount('inprogress')}
              </span>
              <span className="text-sm font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
                In Progress
              </span>
            </div>
            <div className="bg-white dark:bg-background-dark-subtle p-6 rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-completed/30 hover:shadow-md transition-all">
              <div className="mb-3 p-3 rounded-full bg-status-completed/10 text-status-completed">
                <span className="material-symbols-outlined text-2xl">task_alt</span>
              </div>
              <span className="text-4xl font-bold text-text-main dark:text-white mb-2">
                {getStatusCount('completed')}
              </span>
              <span className="text-sm font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
                Completed
              </span>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="text-center py-12 text-text-muted">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
              <p>Loading tasks...</p>
            </div>
          ) : (
            <>
              {/* General Tasks */}
              {currentTasks?.general && (
                <div>
                  <h3 className="text-text-main dark:text-white text-lg font-bold mb-4">General Tasks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderTaskSection([
                      ...(currentTasks.general.overdue || []),
                      ...(currentTasks.general.dueSoon || []),
                      ...(currentTasks.general.inProgress || []),
                      ...(currentTasks.general.completed || []),
                    ])}
                  </div>
                </div>
              )}

              {/* Document Management Section */}
              <div>
                <button
                  onClick={() => setExpandedDM(!expandedDM)}
                  className="w-full flex items-center justify-between p-5 bg-white dark:bg-background-dark-subtle rounded-xl shadow-sm border border-gray-100 dark:border-white/5 group hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg text-primary">
                      <span className="material-symbols-outlined text-2xl">folder_shared</span>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-text-main dark:text-white text-lg block">Document Management</span>
                      <span className="text-sm text-text-muted dark:text-gray-400">
                        {currentTasks?.documentManagement ? 
                          (currentTasks.documentManagement.overdue?.length || 0) + 
                          (currentTasks.documentManagement.dueSoon?.length || 0) + 
                          (currentTasks.documentManagement.inProgress?.length || 0) + 
                          (currentTasks.documentManagement.completed?.length || 0) 
                          : 0} tasks
                      </span>
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-gray-400 group-hover:text-primary transition-all text-2xl ${expandedDM ? 'rotate-180' : ''
                      }`}
                  >
                    expand_more
                  </span>
                </button>
                {expandedDM && currentTasks?.documentManagement && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderTaskSection([
                      ...(currentTasks.documentManagement.overdue || []),
                      ...(currentTasks.documentManagement.dueSoon || []),
                      ...(currentTasks.documentManagement.inProgress || []),
                      ...(currentTasks.documentManagement.completed || []),
                    ])}
                  </div>
                )}
              </div>

              {/* Compliance Management Section */}
              <div>
                <button
                  onClick={() => setExpandedCM(!expandedCM)}
                  className="w-full flex items-center justify-between p-5 bg-white dark:bg-background-dark-subtle rounded-xl shadow-sm border border-gray-100 dark:border-white/5 group hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg text-primary">
                      <span className="material-symbols-outlined text-2xl">policy</span>
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-text-main dark:text-white text-lg block">Compliance Management</span>
                      <span className="text-sm text-text-muted dark:text-gray-400">
                        {currentTasks?.complianceManagement ? 
                          (currentTasks.complianceManagement.overdue?.length || 0) + 
                          (currentTasks.complianceManagement.dueSoon?.length || 0) + 
                          (currentTasks.complianceManagement.inProgress?.length || 0) + 
                          (currentTasks.complianceManagement.completed?.length || 0) 
                          : 0} tasks
                      </span>
                    </div>
                  </div>
                  <span
                    className={`material-symbols-outlined text-gray-400 group-hover:text-primary transition-all text-2xl ${expandedCM ? 'rotate-180' : ''
                      }`}
                  >
                    expand_more
                  </span>
                </button>
                {expandedCM && currentTasks?.complianceManagement && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderTaskSection([
                      ...(currentTasks.complianceManagement.overdue || []),
                      ...(currentTasks.complianceManagement.dueSoon || []),
                      ...(currentTasks.complianceManagement.inProgress || []),
                      ...(currentTasks.complianceManagement.completed || []),
                    ])}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Floating Action Button - Desktop */}
        <div className="fixed bottom-8 right-8 z-40">
          <button
            onClick={() => navigate('/tasks/create')}
            className="flex items-center justify-center size-16 rounded-full bg-primary text-white shadow-lg shadow-primary/40 hover:bg-primary/90 transition-all active:scale-95 hover:scale-105"
            title="Create New Task"
          >
            <span className="material-symbols-outlined text-3xl">add</span>
          </button>
        </div>
      </div>
    </EmployeeLayout>
  );
};

