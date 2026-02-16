import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { TaskCard } from '../../components/shared';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { taskService } from '../../services/taskService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';
import { isTaskDeleted } from '../../utils/taskUtils';

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prevPathRef = useRef<string>(location.pathname);
  // Expand/collapse state for D.M. and C.M. sections (combined for both self and assigned)
  const [expandedDM, setExpandedDM] = useState(false);
  // const [expandedCM, setExpandedCM] = useState(false);
  const [taskDetails, setTaskDetails] = useState<Record<string, any>>({});

  const { data: dashboardData, isLoading, refetch: refetchDashboard } = useQuery(
    ['dashboard'],
    () => dashboardService.getDashboard(3),
    { 
      staleTime: 0, // Always consider stale so focus/mount refetch gets fresh data (match mobile)
      refetchInterval: 30000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      onSuccess: (data) => {
        console.log('[Dashboard Frontend] Received data:', data);
        console.log('[Dashboard Frontend] Self tasks:', data?.data?.selfTasks);
        console.log('[Dashboard Frontend] Assigned tasks:', data?.data?.assignedTasks);
      }
    }
  );

  const { data: statistics, refetch: refetchStatistics } = useQuery(
    ['dashboard-statistics'],
    () => dashboardService.getStatistics(),
    {
      staleTime: 0, // Always consider stale so focus/mount refetch gets fresh data (match mobile)
      refetchInterval: 30000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      onSuccess: (data) => {
        console.log('[Dashboard Statistics] Received data:', data);
        console.log('[Dashboard Statistics] Statistics:', data?.data);
      }
    }
  );

  const selfTasks = dashboardData?.data?.selfTasks;
  const assignedTasks = dashboardData?.data?.assignedTasks;

  const currentUserId = user?.id || (user as any)?.userId;

  const refetchDashboardData = React.useCallback(() => {
    queryClient.invalidateQueries(['dashboard-statistics']);
    queryClient.invalidateQueries(['dashboard']);
    refetchStatistics();
    refetchDashboard();
  }, [queryClient, refetchDashboard, refetchStatistics]);

  // Match mobile useFocusEffect: refresh dashboard whenever screen comes into focus.
  useEffect(() => {
    const pathname = location.pathname;
    const isDashboard = pathname === '/dashboard';

    if (isDashboard) {
      prevPathRef.current = pathname;
      refetchDashboardData();
    } else {
      prevPathRef.current = pathname;
    }
  }, [location.pathname, refetchDashboardData]);

  useEffect(() => {
    const onFocus = () => {
      if (location.pathname === '/dashboard') refetchDashboardData();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [location.pathname, refetchDashboardData]);

  // Refetch when tab becomes visible (more reliable than focus for tab switching)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && location.pathname === '/dashboard') {
        refetchDashboardData();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [location.pathname, refetchDashboardData]);

  const flattenTasksStructure = (tasks: any): any[] => {
    const result: any[] = [];
    if (!tasks) return result;
    if (Array.isArray(tasks)) return tasks.filter((t) => t && t.id && !isTaskDeleted(t));
    if (typeof tasks === 'object') {
      Object.values(tasks).forEach((category: any) => {
        if (Array.isArray(category)) {
          result.push(...category);
        } else if (category && typeof category === 'object') {
          Object.values(category).forEach((statusGroup: any) => {
            if (Array.isArray(statusGroup)) {
              result.push(...statusGroup);
            } else if (statusGroup && typeof statusGroup === 'object') {
              Object.values(statusGroup).forEach((taskArray: any) => {
                if (Array.isArray(taskArray)) result.push(...taskArray);
              });
            }
          });
        }
      });
    }
    return result.filter((t) => t && t.id && !isTaskDeleted(t));
  };

  // Mobile behavior: fetch full task details for a small set so assignees/progress stays accurate.
  useEffect(() => {
    const selfFlat = flattenTasksStructure(selfTasks);
    const assignedFlat = flattenTasksStructure(assignedTasks);
    const allFlat = [...selfFlat, ...assignedFlat].filter((t) => t && t.id);
    const uniqueIds: string[] = [];
    for (const t of allFlat) {
      if (t?.id && !uniqueIds.includes(t.id)) uniqueIds.push(t.id);
      if (uniqueIds.length >= 5) break;
    }

    if (uniqueIds.length === 0) return;

    let cancelled = false;
    (async () => {
      await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const full = await taskService.getTask(id);
            if (cancelled) return;
            setTaskDetails((prev) => ({ ...prev, [id]: full }));
          } catch {
            // ignore
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [selfTasks, assignedTasks]);

  // Flatten all self tasks collections into a single task array
  const flattenedSelfTasksForUser = useMemo(() => {
    if (!selfTasks || !currentUserId) return [] as any[];
    const buckets = ['todo', 'overdue', 'dueSoon', 'inProgress', 'completed'] as const;
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

    // Only keep tasks where current user is an assignee
    return all.filter((task) => {
      const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
      return assignees.some((a: any) => {
        const assigneeId = a.id || a.user_id || a.userId;
        return assigneeId === currentUserId;
      });
    });
  }, [selfTasks, currentUserId]);

  // Compute per-user completed vs in-progress counts for dashboard cards.
  // Task-level status = 'completed' (e.g. after all verified) takes precedence so counts stay in sync with API.
  const selfUserStatusCounts = useMemo(
    () => {
      const counts = { overdue: 0, duesoon: 0, inprogress: 0, completed: 0 };
      if (!flattenedSelfTasksForUser.length) return counts;

      flattenedSelfTasksForUser.forEach((task: any) => {
        const full = taskDetails[task.id];
        const merged = full ? { ...task, ...full } : task;
        const taskStatus = (merged.status || '').toLowerCase();

        // When API marks task completed (e.g. all members verified), count as completed for current user
        if (taskStatus === 'completed') {
          counts.completed += 1;
          return;
        }

        const assignees = Array.isArray(merged?.assignees) ? merged.assignees : [];
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
            bucket = 'inprogress'; // pending review still treated as in-progress for counts
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
    [flattenedSelfTasksForUser, currentUserId, taskDetails]
  );

  // If dashboard payload doesn't include assignees (common), compute self counts from fresh task details.
  // Task-level status = 'completed' takes precedence so verified tasks move to completed count.
  const selfUserStatusCountsFromDetails = useMemo(() => {
    const counts = { inprogress: 0, completed: 0 };
    if (!currentUserId || !selfTasks) return counts;

    const selfFlat = flattenTasksStructure(selfTasks).filter((t) => t && t.id);
    if (selfFlat.length === 0) return counts;

    selfFlat.forEach((t: any) => {
      const full = taskDetails[t.id];
      const assignees = Array.isArray(full?.assignees) ? full.assignees : [];
      if (!assignees.length) return;

      const me = assignees.find((a: any) => {
        const assigneeId = a.id || a.user_id || a.userId;
        return assigneeId === currentUserId;
      });
      if (!me) return;

      // When API marks task completed (all verified), count as completed
      const taskStatus = (full?.status || t?.status || '').toLowerCase();
      if (taskStatus === 'completed') {
        counts.completed += 1;
        return;
      }

      // Member-level: completed if verified_at exists; else inprogress
      const isVerified = !!me.verified_at;
      if (isVerified) {
        counts.completed += 1;
        return;
      }
      counts.inprogress += 1;
    });

    return counts;
  }, [currentUserId, selfTasks, taskDetails]);

  // Compute To-Do tasks (recurring, due today, not completed) for self or assigned - mirrors mobile getToDoTasks
  // Mobile: getCurrentTasks = self + assigned, deduplicated
  const getCurrentTasks = useMemo(() => {
    const selfFlat = flattenTasksStructure(selfTasks).filter((t) => t && t.id);
    const assignedFlat = flattenTasksStructure(assignedTasks).filter((t) => t && t.id);
    const all = selfFlat.map((t: any) => mergeTaskWithFinancial({ ...t, ...taskDetails[t.id] }));
    const fromAssigned = assignedFlat.map((t: any) => mergeTaskWithFinancial({ ...t, ...taskDetails[t.id] }));
    const seen = new Set<string>();
    const out: any[] = [];
    [...all, ...fromAssigned].forEach((task) => {
      if (!task?.id || seen.has(task.id)) return;
      seen.add(task.id);
      out.push(task);
    });
    return out;
  }, [selfTasks, assignedTasks, taskDetails]);

  const getToDoTasks = (view: 'self' | 'assigned') => {
    const source = view === 'assigned' ? assignedTasks : selfTasks;
    if (!source) return [] as any[];

    const flat = flattenTasksStructure(source).filter((t) => t && t.id);
    if (flat.length === 0) return [] as any[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return flat.filter((task: any) => {
      const full = taskDetails[task.id];
      const merged = full ? { ...task, ...full } : task;

      const type = merged.task_type || merged.taskType;
      if (type !== 'recurring') return false;

      const due = merged.due_date || merged.dueDate;
      if (!due) return false;
      const dueDate = new Date(due);
      dueDate.setHours(0, 0, 0, 0);
      const isToday = dueDate.getTime() === today.getTime();
      if (!isToday) return false;

      const status = (merged.status || '').toLowerCase();
      if (status === 'completed') return false;

      return true;
    });
  };

  const getStatusCount = (status: 'todo' | 'overdue' | 'duesoon' | 'inprogress' | 'completed', view: 'self' | 'assigned') => {
    // Match mobile: statsResponse?.data || statsResponse for stats object
    const stats = statistics?.data ?? statistics;
    if (!stats) return 0;
    const prefix = view === 'self' ? 'selfTasks' : 'assignedTasks';
    const statusKeyMap: Record<string, string> = {
      todo: 'Todo',
      overdue: 'Overdue',
      duesoon: 'DueSoon',
      inprogress: 'InProgress',
      completed: 'Completed',
    };
    const statusKey = statusKeyMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
    const key = `${prefix}${statusKey}`;
    return (stats[key] ?? stats[key.toLowerCase()] ?? 0) as number;
  };

  const getTotalCount = (view: 'self' | 'assigned') => {
    const stats = statistics?.data ?? statistics;
    if (!stats) return 0;
    const prefix = view === 'self' ? 'selfTasks' : 'assignedTasks';
    return (
      (stats[`${prefix}Todo`] ?? 0) +
      (stats[`${prefix}Overdue`] ?? 0) +
      (stats[`${prefix}DueSoon`] ?? 0) +
      (stats[`${prefix}InProgress`] ?? 0) +
      (stats[`${prefix}Completed`] ?? 0)
    );
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
          const full = taskDetails[task.id];
          const merged = mergeTaskWithFinancial(full ? { ...task, ...full, id: task.id || full.id } : task);
          const assignees = Array.isArray(merged?.assignees) ? merged.assignees : [];
          const totalMembers = assignees.length;
          const verifiedCompleted = assignees.filter((a: any) => !!a?.verified_at).length;
          const progress = totalMembers > 0 ? Math.round((verifiedCompleted / totalMembers) * 100) : 0;
          const cardAssignees = assignees
            .map((a: any) => ({
              id: a.id || a.user_id || a.userId,
              name: a.name || a.mobile || a.phone || 'User',
              photoUrl: a.profile_photo_url || a.profile_photo || a.profilePhotoUrl || a.photoUrl,
            }))
            .filter((a: any) => !!a.id);
          const hasFinance = merged.financial_value != null || merged.finance_type;
          const isCreator = (merged.created_by || merged.creator_id) === currentUserId;

          return (
            <TaskCard
              key={task.id}
              id={task.id}
              title={merged.title}
              description={merged.description}
              status={status}
              dueDate={merged.due_date || merged.dueDate}
              category={merged.category}
              assignees={cardAssignees}
              progress={status === 'inprogress' ? progress : undefined}
              finance={hasFinance && isCreator ? { amount: merged.financial_value, type: merged.finance_type } : undefined}
              onClick={() => navigate(`/tasks/${task.id}`)}
            />
          );
        })}
      </>
    );
  };

  const renderTaskRow = (tasks: any, viewType: 'self' | 'assigned', title: string) => {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-8 bg-primary rounded-full"></div>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">{title}</h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
        </div>

        {/* Statistics Cards for this section */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8">
          {/* To-Do Card (Today’s recurring, not completed) */}
          <button
            type="button"
            onClick={() => navigate('/tasks?status=todo')}
            className="relative bg-white dark:bg-slate-800/95 p-5 rounded-xl flex flex-col items-center text-center group cursor-pointer text-left w-full
              border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-blue-500
              shadow-sm hover:shadow-md
              transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="mb-2.5 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
              <span className="material-symbols-outlined text-xl">today</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              {getStatusCount('todo', viewType) + getToDoTasks(viewType).length}
            </span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              TO DO
            </span>
          </button>
          
          {/* In Progress Card */}
          <button
            type="button"
            onClick={() => navigate('/tasks?status=inprogress')}
            className="relative bg-white dark:bg-slate-800/95 p-5 rounded-xl flex flex-col items-center text-center group cursor-pointer text-left
              border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-purple-500
              shadow-sm hover:shadow-md
              transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="mb-2.5 p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
              <span className="material-symbols-outlined text-xl">pending_actions</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              {getStatusCount('inprogress', viewType)}
            </span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              In Progress
            </span>
          </button>
          
          {/* Due Soon Card */}
          <button
            type="button"
            onClick={() => navigate('/tasks?status=duesoon')}
            className="relative bg-white dark:bg-slate-800/95 p-5 rounded-xl flex flex-col items-center text-center group cursor-pointer text-left
              border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-amber-500
              shadow-sm hover:shadow-md
              transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="mb-2.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
              <span className="material-symbols-outlined text-xl">hourglass_top</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              {getStatusCount('duesoon', viewType)}
            </span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Due Soon
            </span>
          </button>
          
          {/* Overdue Card */}
          <button
            type="button"
            onClick={() => navigate('/tasks?status=overdue')}
            className="relative bg-white dark:bg-slate-800/95 p-5 rounded-xl flex flex-col items-center text-center group cursor-pointer text-left
              border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-red-500
              shadow-sm hover:shadow-md
              transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="mb-2.5 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              <span className="material-symbols-outlined text-xl">priority_high</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              {getStatusCount('overdue', viewType)}
            </span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Overdue
            </span>
          </button>
          
          {/* Completed Card */}
          <button
            type="button"
            onClick={() => navigate('/tasks?status=completed')}
            className="relative bg-white dark:bg-slate-800/95 p-5 rounded-xl flex flex-col items-center text-center group cursor-pointer text-left
              border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-emerald-500
              shadow-sm hover:shadow-md
              transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="mb-2.5 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
              <span className="material-symbols-outlined text-xl">task_alt</span>
            </div>
            <span className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
              {getStatusCount('completed', viewType)}
            </span>
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Completed
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <EmployeeLayout>
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 space-y-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Welcome Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                Welcome back, {user?.name || 'User'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
                Here's an overview of your tasks and progress
              </p>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-10 md:space-y-12">
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
                className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800/95 rounded-xl group transition-all duration-200 ease-out border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-primary shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary">
                    <span className="material-symbols-outlined text-xl">folder_shared</span>
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-900 dark:text-white text-base block mb-0.5">Document Management</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
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

          {/* Financial Report (Created by Me) - from getCurrentTasks (self+assigned), merged finance from API/localStorage */}
          {(() => {
            const uid = user?.id || (user as any)?.userId;
            const financialTasks = getCurrentTasks.filter((t: any) => {
              const createdBy = t.created_by || t.creator_id;
              const hasFinance = t.financial_value != null || !!t.finance_type;
              return createdBy === uid && hasFinance;
            });

            if (!financialTasks.length) return null;

            const formatDate = (dateString?: string) => {
              if (!dateString) return '';
              const date = new Date(dateString);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const due = new Date(date);
              due.setHours(0, 0, 0, 0);
              const diffTime = due.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays < 0) {
                if (diffDays === -1) return 'Yesterday';
                return `${Math.abs(diffDays)} days ago`;
              }
              if (diffDays === 0) return 'Today';
              if (diffDays === 1) return 'Tomorrow';
              if (diffDays <= 3) return `In ${diffDays} days`;
              return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            };

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-8 bg-emerald-500 rounded-full"></div>
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    Financial Report (Created by Me)
                  </h2>
                </div>
                <div className="bg-white dark:bg-slate-800/95 rounded-xl border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-emerald-500 shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
                  {financialTasks.map((task: any) => {
                    const amount = Number(task.financial_value || 0);
                    const type = task.finance_type;
                    const isIncome = type === 'income';
                    const isExpense = type === 'expense';
                    if (!amount && !type) return null;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="min-w-0 pr-4 flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isIncome 
                              ? 'bg-emerald-50 dark:bg-emerald-900/20' 
                              : 'bg-red-50 dark:bg-red-900/20'
                          }`}>
                            <span className={`material-icons-outlined text-base ${
                              isIncome 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {isIncome ? 'trending_up' : 'trending_down'}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white truncate text-sm">
                              {task.title}
                            </div>
                            {task.due_date && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {formatDate(task.due_date)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1 flex-shrink-0">
                          {amount ? (
                            <div
                              className={`text-base font-semibold ${
                                isIncome
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isExpense
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {isExpense ? '-' : '+'}
                              {amount.toFixed(2)}
                            </div>
                          ) : null}
                          {type && (
                            <div className={`text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded ${
                              isIncome
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                            }`}>
                              {type === 'income'
                                ? 'Income'
                                : type === 'expense'
                                ? 'Expense'
                                : type}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* To-Do List for Recurring Tasks (Self) - top 5, navigate to Task Chat if conversation_id else Task Detail */}
          {(() => {
            const todoSelf = getToDoTasks('self').slice(0, 5);
            if (!todoSelf.length) return null;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-8 bg-blue-500 rounded-full"></div>
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
                    To-Do (Today&apos;s Recurring Tasks)
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {todoSelf.map((task: any) => {
                    const full = taskDetails[task.id];
                    const merged = mergeTaskWithFinancial(full ? { ...task, ...full } : task);
                    const convId = merged.conversation_id || merged.conversationId;
                    const assignees = Array.isArray(merged?.assignees) ? merged.assignees : [];
                    const totalMembers = assignees.length;
                    const verifiedCompleted = assignees.filter((a: any) => !!a?.verified_at).length;
                    const progress =
                      totalMembers > 0 ? Math.round((verifiedCompleted / totalMembers) * 100) : 0;
                    const cardAssignees = assignees
                      .map((a: any) => ({
                        id: a.id || a.user_id || a.userId,
                        name: a.name || a.mobile || a.phone || 'User',
                        photoUrl:
                          a.profile_photo_url ||
                          a.profile_photo ||
                          a.profilePhotoUrl ||
                          a.photoUrl,
                      }))
                      .filter((a: any) => !!a.id);

                    const hasFinance = merged.financial_value != null || merged.finance_type;
                    const isCreator = (merged.created_by || merged.creator_id) === currentUserId;
                    return (
                      <TaskCard
                        key={task.id}
                        id={task.id}
                        title={merged.title}
                        description={merged.description}
                        status="inprogress"
                        dueDate={merged.due_date || merged.dueDate}
                        category={merged.category}
                        assignees={cardAssignees}
                        progress={progress}
                        finance={hasFinance && isCreator ? { amount: merged.financial_value, type: merged.finance_type } : undefined}
                        onClick={() =>
                          convId
                            ? navigate(`/tasks/task-group/${convId}`)
                            : navigate(`/tasks/${task.id}`)
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Compliance Management Section - Combined for both self and assigned */}
          {/* {isLoading ? null : (
            <div>
              <button
                onClick={() => setExpandedCM(!expandedCM)}
                className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800/90 rounded-2xl group transition-all duration-300 ease-out border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-primary shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/40"
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
    </EmployeeLayout>
  );
};

