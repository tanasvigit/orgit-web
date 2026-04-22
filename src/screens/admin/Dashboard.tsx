import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { TaskCard } from '../../components/shared';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { taskService } from '../../services/taskService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';
import { isTaskDeleted } from '../../utils/taskUtils';
import { useTaskTransitionAnimation } from '../../hooks/useTaskTransitionAnimation';
import { TaskTransitionAnimation } from '../../components/dashboard/TaskTransitionAnimation';
import { getTaskStatusCategoryFromTask, TaskStatusCategory } from '../../utils/taskStatus';

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
  const [showAssignedMemberFilter, setShowAssignedMemberFilter] = useState(false);
  const [assignedMemberSearch, setAssignedMemberSearch] = useState('');
  const [selectedAssignedMemberIds, setSelectedAssignedMemberIds] = useState<string[]>([]);
  const assignedMemberFilterRef = useRef<HTMLDivElement>(null);

  // Refs for task transition animation (Self Tasks section)
  const selfTasksToDoIconRef = useRef<HTMLDivElement>(null);
  const selfTasksInProgressIconRef = useRef<HTMLDivElement>(null);
  const selfTasksCompletedIconRef = useRef<HTMLDivElement>(null);
  // Refs for task transition animation (Assigned Tasks section)
  const assignedTasksToDoIconRef = useRef<HTMLDivElement>(null);
  const assignedTasksInProgressIconRef = useRef<HTMLDivElement>(null);
  const assignedTasksCompletedIconRef = useRef<HTMLDivElement>(null);

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

  const selfTasks = dashboardData?.data?.selfTasks;
  const assignedTasks = dashboardData?.data?.assignedTasks;

  // Animation hook (driven by navigation state from Task Details)
  const { shouldAnimate, taskId, fromStatus, toStatus, taskSection, clearAnimationState } = useTaskTransitionAnimation();
  const [isAnimationReady, setIsAnimationReady] = useState(false);

  // Wait until relevant icon refs exist before showing animation.
  useEffect(() => {
    if (!shouldAnimate) {
      setIsAnimationReady(false);
      return;
    }

    const section = taskSection || 'self';
    const from = (fromStatus || 'todo') as 'todo' | 'inprogress';
    const to = (toStatus || 'inprogress') as 'inprogress' | 'completed';
    const refs =
      section === 'assigned'
        ? {
            todo: assignedTasksToDoIconRef,
            inprogress: assignedTasksInProgressIconRef,
            completed: assignedTasksCompletedIconRef,
          }
        : {
            todo: selfTasksToDoIconRef,
            inprogress: selfTasksInProgressIconRef,
            completed: selfTasksCompletedIconRef,
          };

    const sourceRef = refs[from];
    const targetRef = refs[to];
    const check = () => !!sourceRef.current && !!targetRef.current;

    if (check()) {
      setIsAnimationReady(true);
      return;
    }

    setIsAnimationReady(false);
    const delays = [0, 50, 150, 350, 600, 900];
    const timers: ReturnType<typeof setTimeout>[] = [];
    delays.forEach((ms) => {
      timers.push(
        setTimeout(() => {
          if (check()) {
            setIsAnimationReady(true);
            timers.forEach(clearTimeout);
          }
        }, ms)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [shouldAnimate, taskSection, fromStatus, toStatus, isLoading]);

  const currentUserId = user?.id || (user as any)?.userId;

  const refetchAdminDashboard = React.useCallback(() => {
    queryClient.invalidateQueries(['admin-dashboard']);
    refetchDashboard();
  }, [queryClient, refetchDashboard]);

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
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (assignedMemberFilterRef.current && !assignedMemberFilterRef.current.contains(target)) {
        setShowAssignedMemberFilter(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

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

  // Fetch full task details for all visible dashboard tasks so status buckets
  // always match Task Details indicator logic (assignee-based lifecycle).
  useEffect(() => {
    const selfFlat = flattenTasksStructure(selfTasks);
    const assignedFlat = flattenTasksStructure(assignedTasks);
    const allFlat = [...selfFlat, ...assignedFlat].filter((t) => t && t.id);
    const uniqueIds: string[] = [];
    for (const t of allFlat) {
      if (t?.id && !uniqueIds.includes(t.id)) uniqueIds.push(t.id);
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
    if (!selfTasks) return [] as any[];
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
    return all;
  }, [selfTasks]);

  const flattenedAssignedTasksForUser = useMemo(() => {
    if (!assignedTasks) return [] as any[];
    const buckets = ['todo', 'overdue', 'dueSoon', 'inProgress', 'completed'] as const;
    const all: any[] = [];
    Object.values(assignedTasks).forEach((group: any) => {
      if (!group) return;
      buckets.forEach((bucket) => {
        const arr = group[bucket];
        if (Array.isArray(arr)) {
          all.push(...arr);
        }
      });
    });
    return all;
  }, [assignedTasks]);

  const getTaskAssignees = (task: any) => {
    const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
    return assignees
      .map((a: any) => ({
        id: String(a?.id || a?.user_id || a?.userId || '').trim(),
        name: String(a?.name || a?.user_name || a?.username || '').trim() || 'Unknown Member',
      }))
      .filter((a: { id: string; name: string }) => !!a.id);
  };

  const assignedMemberOptions = useMemo(() => {
    const currentId = String(currentUserId || '');
    const rowsMap = new Map<string, { id: string; name: string }>();

    flattenedAssignedTasksForUser.forEach((task: any) => {
      const full = taskDetails[task.id];
      const merged = full ? { ...task, ...full } : task;
      getTaskAssignees(merged).forEach((assignee: { id: string; name: string }) => {
        if (assignee.id === currentId) return;
        if (!rowsMap.has(assignee.id)) rowsMap.set(assignee.id, assignee);
      });
    });

    const list = Array.from(rowsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    const q = assignedMemberSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [flattenedAssignedTasksForUser, taskDetails, assignedMemberSearch, currentUserId]);

  const matchesAssignedMemberFilter = (task: any) => {
    if (selectedAssignedMemberIds.length === 0) return true;
    const memberIds = new Set(getTaskAssignees(task).map((a: { id: string; name: string }) => a.id));
    return selectedAssignedMemberIds.some((id) => memberIds.has(id));
  };

  const isBeforeStartDate = (task: any) => {
    const rawStart = task?.start_date ?? task?.startDate;
    if (!rawStart) return false;
    try {
      const start = new Date(rawStart);
      return new Date() < start;
    } catch {
      return false;
    }
  };

  const selfUserStatusCounts = useMemo(
    () => {
      const counts: Record<TaskStatusCategory, number> = {
        todo: 0,
        scheduled: 0,
        overdue: 0,
        duesoon: 0,
        inprogress: 0,
        completed: 0,
      };
      if (!flattenedSelfTasksForUser.length) return counts;

      flattenedSelfTasksForUser.forEach((task: any) => {
        const full = taskDetails[task.id];
        const merged = full ? { ...task, ...full } : task;
        if (isBeforeStartDate(merged)) return;
        const bucket = (getTaskStatusCategoryFromTask(merged, 3, currentUserId) || 'todo') as TaskStatusCategory;
        counts[bucket] = (counts[bucket] ?? 0) + 1;
      });

      return counts;
    },
    [flattenedSelfTasksForUser, taskDetails]
  );

  const assignedUserStatusCounts = useMemo(() => {
    const counts: Record<TaskStatusCategory, number> = {
      todo: 0,
      scheduled: 0,
      overdue: 0,
      duesoon: 0,
      inprogress: 0,
      completed: 0,
    };
    if (!flattenedAssignedTasksForUser.length) return counts;

    flattenedAssignedTasksForUser.forEach((task: any) => {
      const full = taskDetails[task.id];
      const merged = full ? { ...task, ...full } : task;
      if (!matchesAssignedMemberFilter(merged)) return;
      if (isBeforeStartDate(merged)) return;
      const bucket = (getTaskStatusCategoryFromTask(merged, 3, currentUserId) || 'todo') as TaskStatusCategory;
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    });
    return counts;
  }, [flattenedAssignedTasksForUser, taskDetails, selectedAssignedMemberIds]);

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
      if (view === 'assigned' && !matchesAssignedMemberFilter(merged)) return false;

      const type = merged.task_type || merged.taskType;
      if (type !== 'recurring' && type !== 'recurring_instance') return false;

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
    // For Self Tasks, use per-user lifecycle buckets derived from getTaskStatusCategoryFromTask
    // so each task appears in exactly one bucket (mobile-equivalent behavior).
    if (view === 'self') {
      return selfUserStatusCounts[status] ?? 0;
    }

    return assignedUserStatusCounts[status] ?? 0;
  };

  const getTotalCount = (view: 'self' | 'assigned') => {
    const counts = view === 'self' ? selfUserStatusCounts : assignedUserStatusCounts;
    return (
      (counts.todo ?? 0) +
      (counts.overdue ?? 0) +
      (counts.duesoon ?? 0) +
      (counts.inprogress ?? 0) +
      (counts.completed ?? 0)
    );
  };

  const renderTaskSection = (
    tasks: any[],
    statusCategory: 'overdue' | 'dueSoon' | 'inProgress' | 'completed'
  ) => {
    if (tasks.length === 0) return null;

    return (
      <>
        {tasks.map((task) => {
          const full = taskDetails[task.id];
          const merged = mergeTaskWithFinancial(full ? { ...task, ...full, id: task.id || full.id } : task);
          const derived = (getTaskStatusCategoryFromTask(merged, 3, currentUserId) || 'todo') as TaskStatusCategory;
          const cardStatus: 'scheduled' | 'overdue' | 'duesoon' | 'inprogress' | 'completed' =
            derived === 'scheduled'
              ? 'scheduled'
              : derived === 'overdue'
              ? 'overdue'
              : derived === 'duesoon'
              ? 'duesoon'
              : derived === 'completed'
              ? 'completed'
              : 'inprogress';
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
              clientName={merged.client_name || merged.clientName}
              description={merged.description}
              status={cardStatus}
              dueDate={merged.due_date || merged.dueDate}
              category={merged.category}
              assignees={cardAssignees}
              progress={cardStatus === 'inprogress' ? progress : undefined}
              finance={hasFinance && isCreator ? { amount: merged.financial_value, type: merged.finance_type } : undefined}
              onClick={() => navigate(`/admin/tasks/${task.id}`)}
            />
          );
        })}
      </>
    );
  };

  const renderTaskRow = (
    tasks: any,
    viewType: 'self' | 'assigned',
    title: string,
    toDoIconRef?: React.RefObject<HTMLDivElement>,
    inProgressIconRef?: React.RefObject<HTMLDivElement>,
    completedIconRef?: React.RefObject<HTMLDivElement>
  ) => {
    return (
      <div className="space-y-4 max-[1366px]:space-y-3">
        <div className="mb-4 flex items-center gap-3 max-[1366px]:mb-2.5">
          <div className="w-1 h-8 bg-primary rounded-full"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white md:text-2xl max-[1366px]:text-lg">{title}</h2>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700"></div>
          {viewType === 'assigned' && (
            <div className="relative min-w-[230px]" ref={assignedMemberFilterRef}>
              <button
                type="button"
                onClick={() => setShowAssignedMemberFilter((prev) => !prev)}
                className="w-full flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-700 dark:text-gray-200"
              >
                <span className="truncate">
                  {selectedAssignedMemberIds.length > 0
                    ? `Team (${selectedAssignedMemberIds.length}) selected`
                    : 'Filter team members'}
                </span>
                <span className="material-symbols-outlined text-base">
                  {showAssignedMemberFilter ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {showAssignedMemberFilter && (
                <div className="absolute right-0 z-20 mt-2 w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 shadow-lg">
                  <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                    <input
                      type="text"
                      value={assignedMemberSearch}
                      onChange={(e) => setAssignedMemberSearch(e.target.value)}
                      placeholder="Search member..."
                      className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1.5 space-y-1">
                    {assignedMemberOptions.length > 0 ? assignedMemberOptions.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAssignedMemberIds.includes(member.id)}
                          onChange={() => {
                            setSelectedAssignedMemberIds((prev) =>
                              prev.includes(member.id)
                                ? prev.filter((id) => id !== member.id)
                                : [...prev, member.id]
                            );
                          }}
                        />
                        <span className="text-xs text-gray-800 dark:text-gray-200 truncate">{member.name}</span>
                      </label>
                    )) : (
                      <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">No team members found</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-2 border-t border-gray-100 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAssignedMemberIds([]);
                        setAssignedMemberSearch('');
                      }}
                      className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAssignedMemberFilter(false)}
                      className="text-[11px] font-medium text-primary hover:text-primary/80"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Statistics Cards for this section */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5 max-[1366px]:gap-2.5 max-[1366px]:mb-4">
          {/* To-Do Card (Today’s recurring, not completed) */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=todo`)}
            className="relative mx-auto flex w-full max-w-[220px] flex-col items-center rounded-[10px] border border-gray-200 border-l-[4px] border-l-blue-500 bg-white p-3 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-gray-700 dark:bg-slate-800/95 max-[1366px]:max-w-[200px] max-[1366px]:p-2.5"
          >
            <div ref={toDoIconRef} className="mb-2 flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 max-[1366px]:size-[30px]">
              <span className="material-symbols-outlined text-[18px] max-[1366px]:text-base">today</span>
            </div>
            <span className="mb-1 text-xl font-semibold text-gray-900 dark:text-white max-[1366px]:text-lg">
              {getStatusCount('todo', viewType) + getToDoTasks(viewType).length}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
              TO DO
            </span>
          </button>
          
          {/* In Progress Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=inprogress`)}
            className="relative mx-auto flex w-full max-w-[220px] flex-col items-center rounded-[10px] border border-gray-200 border-l-[4px] border-l-purple-500 bg-white p-3 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-gray-700 dark:bg-slate-800/95 max-[1366px]:max-w-[200px] max-[1366px]:p-2.5"
          >
            <div ref={inProgressIconRef} className="mb-2 flex size-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 max-[1366px]:size-[30px]">
              <span className="material-symbols-outlined text-[18px] max-[1366px]:text-base">pending_actions</span>
            </div>
            <span className="mb-1 text-xl font-semibold text-gray-900 dark:text-white max-[1366px]:text-lg">
              {getStatusCount('inprogress', viewType)}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
              In Progress
            </span>
          </button>
          
          {/* Due Soon Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=duesoon`)}
            className="relative mx-auto flex w-full max-w-[220px] flex-col items-center rounded-[10px] border border-gray-200 border-l-[4px] border-l-amber-500 bg-white p-3 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-gray-700 dark:bg-slate-800/95 max-[1366px]:max-w-[200px] max-[1366px]:p-2.5"
          >
            <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 max-[1366px]:size-[30px]">
              <span className="material-symbols-outlined text-[18px] max-[1366px]:text-base">hourglass_top</span>
            </div>
            <span className="mb-1 text-xl font-semibold text-gray-900 dark:text-white max-[1366px]:text-lg">
              {getStatusCount('duesoon', viewType)}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Due Soon
            </span>
          </button>
          
          {/* Overdue Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=overdue`)}
            className="relative mx-auto flex w-full max-w-[220px] flex-col items-center rounded-[10px] border border-gray-200 border-l-[4px] border-l-red-500 bg-white p-3 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-gray-700 dark:bg-slate-800/95 max-[1366px]:max-w-[200px] max-[1366px]:p-2.5"
          >
            <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 max-[1366px]:size-[30px]">
              <span className="material-symbols-outlined text-[18px] max-[1366px]:text-base">priority_high</span>
            </div>
            <span className="mb-1 text-xl font-semibold text-gray-900 dark:text-white max-[1366px]:text-lg">
              {getStatusCount('overdue', viewType)}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Overdue
            </span>
          </button>
          
          {/* Completed Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=completed`)}
            className="relative mx-auto flex w-full max-w-[220px] flex-col items-center rounded-[10px] border border-gray-200 border-l-[4px] border-l-emerald-500 bg-white p-3 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] dark:border-gray-700 dark:bg-slate-800/95 max-[1366px]:max-w-[200px] max-[1366px]:p-2.5"
          >
            <div ref={completedIconRef} className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 max-[1366px]:size-[30px]">
              <span className="material-symbols-outlined text-[18px] max-[1366px]:text-base">task_alt</span>
            </div>
            <span className="mb-1 text-xl font-semibold text-gray-900 dark:text-white max-[1366px]:text-lg">
              {getStatusCount('completed', viewType)}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
              Completed
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="min-h-screen w-full max-w-7xl flex-1 space-y-6 bg-gray-50 px-4 py-6 dark:bg-gray-900 sm:px-5 md:px-6 md:py-7 max-[1366px]:space-y-4 max-[1366px]:px-2.5 max-[1366px]:py-4">
        {/* Welcome Header */}
        <div className="mb-4 max-[1366px]:mb-3">
          <div className="mb-2 flex items-center justify-between max-[1366px]:mb-1.5">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">
                Welcome, {user?.name || 'Admin'}
              </h1>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 md:text-sm max-[1366px]:mt-0.5 max-[1366px]:text-[11px]">
                Here's an overview of your tasks and progress
              </p>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div className="space-y-6 md:space-y-8 max-[1366px]:space-y-4">
          {/* Self Tasks Row */}
          {renderTaskRow(selfTasks, 'self', 'Self Tasks', selfTasksToDoIconRef, selfTasksInProgressIconRef, selfTasksCompletedIconRef)}
          
          {/* Assigned Tasks Row */}
          {renderTaskRow(assignedTasks, 'assigned', 'Assigned Tasks', assignedTasksToDoIconRef, assignedTasksInProgressIconRef, assignedTasksCompletedIconRef)}

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

          {/* Financial Report  - from getCurrentTasks (self+assigned), merged finance from API/localStorage */}
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
                    Financial Report 
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
                        clientName={merged.client_name || merged.clientName}
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

      {/* Task Transition Animation */}
      {shouldAnimate && isAnimationReady && (
        (() => {
          const section = taskSection || 'self';
          const from = (fromStatus || 'todo') as any;
          const to = (toStatus || 'inprogress') as any;
          const refs =
            section === 'assigned'
              ? {
                  todo: assignedTasksToDoIconRef,
                  inprogress: assignedTasksInProgressIconRef,
                  completed: assignedTasksCompletedIconRef,
                }
              : {
                  todo: selfTasksToDoIconRef,
                  inprogress: selfTasksInProgressIconRef,
                  completed: selfTasksCompletedIconRef,
                };
          const sourceRef = refs[from === 'inprogress' ? 'inprogress' : 'todo'];
          const targetRef = refs[to === 'completed' ? 'completed' : 'inprogress'];
          if (!sourceRef.current || !targetRef.current) return null;
          return (
            <TaskTransitionAnimation
              sourceRef={sourceRef}
              targetRef={targetRef}
              taskId={taskId}
              section={section}
              fromStatus={from}
              toStatus={to}
              onComplete={() => {
                clearAnimationState();
                refetchAdminDashboard();
              }}
            />
          );
        })()
      )}
    </AdminLayout>
  );
};
