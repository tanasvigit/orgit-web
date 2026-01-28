import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../../components/shared';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Expand/collapse state for D.M. and C.M. sections (combined for both self and assigned)
  const [expandedDM, setExpandedDM] = useState(false);
  // const [expandedCM, setExpandedCM] = useState(false);

  const { data: dashboardData, isLoading } = useQuery(
    ['admin-dashboard'],
    () => dashboardService.getDashboard(3),
    { 
      refetchInterval: 30000, // Refetch every 30 seconds
      onSuccess: (data) => {
        // Debug logging
        console.log('[Admin Dashboard Frontend] Received data:', data);
        console.log('[Admin Dashboard Frontend] Self tasks:', data?.data?.selfTasks);
        console.log('[Admin Dashboard Frontend] Assigned tasks:', data?.data?.assignedTasks);
      }
    }
  );

  const { data: statistics } = useQuery(
    ['admin-dashboard-statistics'],
    () => dashboardService.getStatistics(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      onSuccess: (data) => {
        // Debug logging
        console.log('[Admin Dashboard Statistics] Received data:', data);
        console.log('[Admin Dashboard Statistics] Statistics:', data?.data);
      }
    }
  );

  const selfTasks = dashboardData?.data?.selfTasks;
  const assignedTasks = dashboardData?.data?.assignedTasks;

  const currentUserId = user?.id || (user as any)?.userId;

  const flattenedSelfTasksForUser = useMemo(() => {
    if (!selfTasks || !currentUserId) return [] as any[];
    const buckets = ['overdue', 'dueSoon', 'inProgress', 'completed'] as const;
    const all: any[] = [];

    Object.values(selfTasks).forEach((group: any) => {
      if (!group) return;
      buckets.forEach((bucket) => {
        const arr = group[bucket];
        if (Array.isArray(arr)) {
          all.push(...arr);
        }
      });
    });

    return all.filter((task) => {
      const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
      return assignees.some((a: any) => {
        const assigneeId = a.id || a.user_id || a.userId;
        return assigneeId === currentUserId;
      });
    });
  }, [selfTasks, currentUserId]);

  const selfUserStatusCounts = useMemo(
    () => {
      const counts = { overdue: 0, duesoon: 0, inprogress: 0, completed: 0 };
      if (!flattenedSelfTasksForUser.length) return counts;

      flattenedSelfTasksForUser.forEach((task: any) => {
        const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
        const assignee = assignees.find((a: any) => {
          const assigneeId = a.id || a.user_id || a.userId;
          return assigneeId === currentUserId;
        });

        let bucket: 'completed' | 'inprogress' = 'inprogress';
        if (assignee) {
          const verified =
            assignee.verified_at ||
            (assignee.verifiedAt as any) ||
            assignee.is_verified;
          const completed =
            assignee.completed_at ||
            assignee.completion_status === 'completed' ||
            assignee.status === 'completed';

          if (verified) {
            bucket = 'completed';
          } else if (completed) {
            bucket = 'inprogress';
          }
        }

        if (bucket === 'completed') {
          counts.completed += 1;
        } else {
          counts.inprogress += 1;
        }
      });

      return counts;
    },
    [flattenedSelfTasksForUser, currentUserId]
  );

  const getStatusCount = (status: 'overdue' | 'duesoon' | 'inprogress' | 'completed', view: 'self' | 'assigned') => {
    if (view === 'self') {
      if (status === 'completed') return selfUserStatusCounts.completed;
      if (status === 'inprogress') return selfUserStatusCounts.inprogress;
    }
    if (!statistics?.data) {
      console.log('[Admin Dashboard] No statistics data available');
      return 0;
    }
    const prefix = view === 'self' ? 'selfTasks' : 'assignedTasks';
    // Map status to correct key format matching backend response
    const statusKeyMap: Record<string, string> = {
      overdue: 'Overdue',
      duesoon: 'DueSoon',
      inprogress: 'InProgress',
      completed: 'Completed',
    };
    const statusKey = statusKeyMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
    const key = `${prefix}${statusKey}`;
    const value = statistics.data[key] || 0;
    console.log(`[Admin Dashboard] ${key}:`, value);
    return value;
  };

  const getTotalCount = (view: 'self' | 'assigned') => {
    if (view === 'self') {
      const localTotal =
        selfUserStatusCounts.completed + selfUserStatusCounts.inprogress;
      if (localTotal > 0) return localTotal;
    }
    if (!statistics?.data) return 0;
    const prefix = view === 'self' ? 'selfTasks' : 'assignedTasks';
    const total = (
      (statistics.data[`${prefix}Overdue`] || 0) +
      (statistics.data[`${prefix}DueSoon`] || 0) +
      (statistics.data[`${prefix}InProgress`] || 0) +
      (statistics.data[`${prefix}Completed`] || 0)
    );
    console.log(`[Admin Dashboard] Total ${prefix}:`, total);
    return total;
  };

  const renderTaskSection = (
    tasks: any[],
    statusCategory: 'overdue' | 'dueSoon' | 'inProgress' | 'completed'
  ) => {
    if (tasks.length === 0) return null;

    // Map backend status categories to frontend status values
    const statusMap: Record<string, 'overdue' | 'duesoon' | 'inprogress' | 'completed'> = {
      overdue: 'overdue',
      dueSoon: 'duesoon',
      inProgress: 'inprogress',
      completed: 'completed',
    };

    const status = statusMap[statusCategory] || 'inprogress';

    return (
      <>
        {tasks.map((task) => {
          return (
            <TaskCard
              key={task.id}
              id={task.id}
              title={task.title}
              description={task.description}
              status={status}
              dueDate={task.due_date || task.dueDate}
              category={task.category}
              onClick={() => navigate(`/admin/tasks/${task.id}`)}
            />
          );
        })}
      </>
    );
  };

  const renderTaskRow = (tasks: any, viewType: 'self' | 'assigned', title: string) => {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-text-main dark:text-white">{title}</h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
        </div>

        {/* Statistics Cards for this section */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6">
          {/* Total Tasks Card */}
          <div className="bg-white dark:bg-background-dark-subtle p-4 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-primary/30 hover:shadow-md transition-all">
            <div className="mb-2 p-2 rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-xl">task</span>
            </div>
            <span className="text-2xl font-bold text-primary mb-1">
              {getTotalCount(viewType)}
            </span>
            <span className="text-xs font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
              Total Tasks
            </span>
          </div>
          
          {/* Overdue Card */}
          <div className="bg-white dark:bg-background-dark-subtle p-4 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-overdue/30 hover:shadow-md transition-all">
            <div className="mb-2 p-2 rounded-full bg-status-overdue/10 text-status-overdue">
              <span className="material-symbols-outlined text-xl">priority_high</span>
            </div>
            <span className="text-2xl font-bold text-status-overdue mb-1">
              {getStatusCount('overdue', viewType)}
            </span>
            <span className="text-xs font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
              Overdue
            </span>
          </div>
          
          {/* Due Soon Card */}
          <div className="bg-white dark:bg-background-dark-subtle p-4 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-duesoon/30 hover:shadow-md transition-all">
            <div className="mb-2 p-2 rounded-full bg-status-duesoon/10 text-status-duesoon">
              <span className="material-symbols-outlined text-xl">hourglass_top</span>
            </div>
            <span className="text-2xl font-bold text-status-duesoon mb-1">
              {getStatusCount('duesoon', viewType)}
            </span>
            <span className="text-xs font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
              Due Soon
            </span>
          </div>
          
          {/* In Progress Card */}
          <div className="bg-white dark:bg-background-dark-subtle p-4 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-inprogress/30 hover:shadow-md transition-all">
            <div className="mb-2 p-2 rounded-full bg-status-inprogress/10 text-status-inprogress">
              <span className="material-symbols-outlined text-xl">pending_actions</span>
            </div>
            <span className="text-2xl font-bold text-status-inprogress mb-1">
              {getStatusCount('inprogress', viewType)}
            </span>
            <span className="text-xs font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
              In Progress
            </span>
          </div>
          
          {/* Completed Card */}
          <div className="bg-white dark:bg-background-dark-subtle p-4 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-white/5 flex flex-col items-center text-center group hover:border-status-completed/30 hover:shadow-md transition-all">
            <div className="mb-2 p-2 rounded-full bg-status-completed/10 text-status-completed">
              <span className="material-symbols-outlined text-xl">task_alt</span>
            </div>
            <span className="text-2xl font-bold text-status-completed mb-1">
              {getStatusCount('completed', viewType)}
            </span>
            <span className="text-xs font-semibold text-text-muted dark:text-white/60 uppercase tracking-wide">
              Completed
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Tasks List */}
        <div className="space-y-12">
          {/* Self Tasks Row */}
          {renderTaskRow(selfTasks, 'self', 'Self Tasks')}
          
          {/* Assigned Tasks Row */}
          {renderTaskRow(assignedTasks, 'assigned', 'Assigned Tasks')}

          {/* Document Management Section - Combined for both self and assigned */}
          {isLoading ? (
            <div className="text-center py-12 text-text-muted">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
              <p>Loading tasks...</p>
            </div>
          ) : (
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
                      {(() => {
                        const selfDM = selfTasks?.documentManagement || {};
                        const assignedDM = assignedTasks?.documentManagement || {};
                        const total = 
                          (selfDM.overdue?.length || 0) + 
                          (selfDM.dueSoon?.length || 0) + 
                          (selfDM.inProgress?.length || 0) + 
                          (selfDM.completed?.length || 0) +
                          (assignedDM.overdue?.length || 0) + 
                          (assignedDM.dueSoon?.length || 0) + 
                          (assignedDM.inProgress?.length || 0) + 
                          (assignedDM.completed?.length || 0);
                        return total;
                      })()} tasks
                    </span>
                  </div>
                </div>
                <span
                  className={`material-symbols-outlined text-gray-400 group-hover:text-primary transition-all text-2xl ${expandedDM ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>
              {expandedDM && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderTaskSection([
                    ...(selfTasks?.documentManagement?.overdue || []),
                    ...(assignedTasks?.documentManagement?.overdue || [])
                  ], 'overdue')}
                  {renderTaskSection([
                    ...(selfTasks?.documentManagement?.dueSoon || []),
                    ...(assignedTasks?.documentManagement?.dueSoon || [])
                  ], 'dueSoon')}
                  {renderTaskSection([
                    ...(selfTasks?.documentManagement?.inProgress || []),
                    ...(assignedTasks?.documentManagement?.inProgress || [])
                  ], 'inProgress')}
                  {renderTaskSection([
                    ...(selfTasks?.documentManagement?.completed || []),
                    ...(assignedTasks?.documentManagement?.completed || [])
                  ], 'completed')}
                </div>
              )}
            </div>
          )}

          {/* Compliance Management Section - Combined for both self and assigned */}
          {/* {isLoading ? null : (
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
                      {(() => {
                        const selfCM = selfTasks?.complianceManagement || {};
                        const assignedCM = assignedTasks?.complianceManagement || {};
                        const total = 
                          (selfCM.overdue?.length || 0) + 
                          (selfCM.dueSoon?.length || 0) + 
                          (selfCM.inProgress?.length || 0) + 
                          (selfCM.completed?.length || 0) +
                          (assignedCM.overdue?.length || 0) + 
                          (assignedCM.dueSoon?.length || 0) + 
                          (assignedCM.inProgress?.length || 0) + 
                          (assignedCM.completed?.length || 0);
                        return total;
                      })()} tasks
                    </span>
                  </div>
                </div>
                <span
                  className={`material-symbols-outlined text-gray-400 group-hover:text-primary transition-all text-2xl ${expandedCM ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </button>
              {expandedCM && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderTaskSection([
                    ...(selfTasks?.complianceManagement?.overdue || []),
                    ...(assignedTasks?.complianceManagement?.overdue || [])
                  ], 'overdue')}
                  {renderTaskSection([
                    ...(selfTasks?.complianceManagement?.dueSoon || []),
                    ...(assignedTasks?.complianceManagement?.dueSoon || [])
                  ], 'dueSoon')}
                  {renderTaskSection([
                    ...(selfTasks?.complianceManagement?.inProgress || []),
                    ...(assignedTasks?.complianceManagement?.inProgress || [])
                  ], 'inProgress')}
                  {renderTaskSection([
                    ...(selfTasks?.complianceManagement?.completed || []),
                    ...(assignedTasks?.complianceManagement?.completed || [])
                  ], 'completed')}
                </div>
              )}
            </div>
          )} */}
        </div>
      </div>
    </AdminLayout>
  );
};
