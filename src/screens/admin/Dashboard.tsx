import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { TaskCard } from '../../components/shared';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';

export const AdminDashboard: React.FC = () => {
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
    ['admin-dashboard'],
    () => dashboardService.getDashboard(3),
    { 
      staleTime: 0, // Match mobile: always refetch on focus so counts stay in sync
      refetchInterval: 30000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      onSuccess: (data) => {
        console.log('[Admin Dashboard Frontend] Received data:', data);
        console.log('[Admin Dashboard Frontend] Self tasks:', data?.data?.selfTasks);
        console.log('[Admin Dashboard Frontend] Assigned tasks:', data?.data?.assignedTasks);
      }
    }
  );

  const { data: statistics, refetch: refetchStatistics } = useQuery(
    ['admin-dashboard-statistics'],
    () => dashboardService.getStatistics(),
    {
      staleTime: 0, // Match mobile: always refetch on focus so counts stay in sync
      refetchInterval: 30000,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      onSuccess: (data) => {
        console.log('[Admin Dashboard Statistics] Received data:', data);
        console.log('[Admin Dashboard Statistics] Statistics:', data?.data);
      }
    }
  );

  const selfTasks = dashboardData?.data?.selfTasks;
  const assignedTasks = dashboardData?.data?.assignedTasks;

  const currentUserId = user?.id || (user as any)?.userId;

  const refetchAdminDashboard = React.useCallback(() => {
    queryClient.invalidateQueries(['admin-dashboard-statistics']);
    queryClient.invalidateQueries(['admin-dashboard']);
    refetchStatistics();
    refetchDashboard();
  }, [queryClient, refetchDashboard, refetchStatistics]);

  // Match mobile useFocusEffect: refresh dashboard whenever screen comes into focus.
  useEffect(() => {
    const pathname = location.pathname;
    const isAdminDashboard = pathname === '/admin';

    if (isAdminDashboard) {
      prevPathRef.current = pathname;
      refetchAdminDashboard();
    } else {
      prevPathRef.current = pathname;
    }
  }, [location.pathname, refetchAdminDashboard]);

  useEffect(() => {
    const onFocus = () => {
      if (location.pathname === '/admin') refetchAdminDashboard();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [location.pathname, refetchAdminDashboard]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && location.pathname === '/admin') {
        refetchAdminDashboard();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [location.pathname, refetchAdminDashboard]);

  const flattenTasksStructure = (tasks: any): any[] => {
    const result: any[] = [];
    if (!tasks) return result;
    if (Array.isArray(tasks)) return tasks;
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
    return result;
  };

  // Fetch full task details for a small set so assignees/progress stays accurate.
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
        const full = taskDetails[task.id];
        const merged = full ? { ...task, ...full } : task;
        const taskStatus = (merged.status || '').toLowerCase();

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
    [flattenedSelfTasksForUser, currentUserId, taskDetails]
  );

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

      const taskStatus = (full?.status || t?.status || '').toLowerCase();
      if (taskStatus === 'completed') {
        counts.completed += 1;
        return;
      }

      if (me.verified_at) {
        counts.completed += 1;
      } else {
        counts.inprogress += 1;
      }
    });

    return counts;
  }, [currentUserId, selfTasks, taskDetails]);

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
    const stats = statistics?.data ?? statistics;
    if (!stats) return 0;
    const prefix = view === 'self' ? 'selfTasks' : 'assignedTasks';
    // Map status to correct key format matching backend response
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-5 mb-6">
          {/* To-Do Card (Today’s recurring, not completed) */}
          <button
            type="button"
            onClick={() => navigate('/admin/tasks?status=todo')}
            className="relative bg-white dark:bg-slate-800/90 p-5 rounded-2xl flex flex-col items-center text-center group cursor-pointer text-left w-full border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-primary shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/40"
          >
            <div className="mb-3 p-2.5 rounded-xl bg-primary/15 text-primary ring-2 ring-primary/10">
              <span className="material-symbols-outlined text-2xl">today</span>
            </div>
            <span className="text-2xl font-bold text-primary mb-1">
              {getStatusCount('todo', viewType) + getToDoTasks(viewType).length}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              TO DO
            </span>
          </button>
          
          {/* Overdue Card - clickable */}
          <button
            type="button"
            onClick={() => navigate('/admin/tasks?status=overdue')}
            className="relative bg-white dark:bg-slate-800/90 p-5 rounded-2xl flex flex-col items-center text-center group cursor-pointer text-left border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-status-overdue shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-status-overdue/10 hover:-translate-y-0.5 hover:border-status-overdue/30 dark:hover:border-status-overdue/40"
          >
            <div className="mb-3 p-2.5 rounded-xl bg-status-overdue/15 text-status-overdue ring-2 ring-status-overdue/20">
              <span className="material-symbols-outlined text-2xl">priority_high</span>
            </div>
            <span className="text-2xl font-bold text-status-overdue mb-1">
              {getStatusCount('overdue', viewType)}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Overdue
            </span>
          </button>
          
          {/* Due Soon Card - clickable */}
          <button
            type="button"
            onClick={() => navigate('/admin/tasks?status=duesoon')}
            className="relative bg-white dark:bg-slate-800/90 p-5 rounded-2xl flex flex-col items-center text-center group cursor-pointer text-left border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-status-duesoon shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-status-duesoon/10 hover:-translate-y-0.5 hover:border-status-duesoon/30 dark:hover:border-status-duesoon/40"
          >
            <div className="mb-3 p-2.5 rounded-xl bg-status-duesoon/15 text-status-duesoon ring-2 ring-status-duesoon/20">
              <span className="material-symbols-outlined text-2xl">hourglass_top</span>
            </div>
            <span className="text-2xl font-bold text-status-duesoon mb-1">
              {getStatusCount('duesoon', viewType)}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Due Soon
            </span>
          </button>
          
          {/* In Progress Card - clickable */}
          <button
            type="button"
            onClick={() => navigate('/admin/tasks?status=inprogress')}
            className="relative bg-white dark:bg-slate-800/90 p-5 rounded-2xl flex flex-col items-center text-center group cursor-pointer text-left border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-status-inprogress shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-status-inprogress/10 hover:-translate-y-0.5 hover:border-status-inprogress/30 dark:hover:border-status-inprogress/40"
          >
            <div className="mb-3 p-2.5 rounded-xl bg-status-inprogress/15 text-status-inprogress ring-2 ring-status-inprogress/20">
              <span className="material-symbols-outlined text-2xl">pending_actions</span>
            </div>
            <span className="text-2xl font-bold text-status-inprogress mb-1">
              {getStatusCount('inprogress', viewType)}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              In Progress
            </span>
          </button>
          
          {/* Completed Card - clickable */}
          <button
            type="button"
            onClick={() => navigate('/admin/tasks?status=completed')}
            className="relative bg-white dark:bg-slate-800/90 p-5 rounded-2xl flex flex-col items-center text-center group cursor-pointer text-left border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-status-completed shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-status-completed/10 hover:-translate-y-0.5 hover:border-status-completed/30 dark:hover:border-status-completed/40"
          >
            <div className="mb-3 p-2.5 rounded-xl bg-status-completed/15 text-status-completed ring-2 ring-status-completed/20">
              <span className="material-symbols-outlined text-2xl">task_alt</span>
            </div>
            <span className="text-2xl font-bold text-status-completed mb-1">
              {getStatusCount('completed', viewType)}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Completed
            </span>
          </button>
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
                className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800/90 rounded-2xl group transition-all duration-300 ease-out border-2 border-slate-200/90 dark:border-slate-600/80 border-l-[6px] border-l-primary shadow-lg shadow-slate-200/25 dark:shadow-slate-900/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5 hover:border-primary/30 dark:hover:border-primary/40"
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
                <h2 className="text-2xl font-bold text-text-main dark:text-white">
                  Financial Report (Created by Me)
                </h2>
                <div className="bg-white dark:bg-background-dark-subtle rounded-xl shadow-sm border border-gray-100 dark:border-white/5 divide-y divide-gray-100 dark:divide-white/10">
                  {financialTasks.map((task: any) => {
                    const amount = Number(task.financial_value || 0);
                    const type = task.finance_type;
                    const isIncome = type === 'income';
                    const isExpense = type === 'expense';
                    if (!amount && !type) return null;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="min-w-0 pr-4">
                          <div className="font-semibold text-text-main dark:text-white truncate">
                            {task.title}
                          </div>
                          {task.due_date && (
                            <div className="text-xs text-text-muted dark:text-white/60">
                              {formatDate(task.due_date)}
                            </div>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          {amount ? (
                            <div
                              className={`text-sm font-bold ${
                                isIncome
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isExpense
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-text-main dark:text-white'
                              }`}
                            >
                              {isExpense ? '-' : '+'}
                              {amount.toFixed(2)}
                            </div>
                          ) : null}
                          {type && (
                            <div className="text-[11px] uppercase tracking-wide text-text-muted dark:text-white/60">
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
                <h2 className="text-2xl font-bold text-text-main dark:text-white">
                  To-Do (Today&apos;s Recurring Tasks)
                </h2>
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
                            ? navigate(`/admin/tasks/task-group/${convId}`)
                            : navigate(`/admin/tasks/${task.id}`)
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
    </AdminLayout>
  );
};
