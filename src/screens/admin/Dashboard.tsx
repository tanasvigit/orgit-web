import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useQuery, useQueryClient } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { TaskCard } from '../../components/shared';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { dashboardService } from '../../services/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { showLogoutConfirm } from '../../utils/logoutConfirm';
import { taskService } from '../../services/taskService';
import { conversationService } from '../../services/conversationService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';
import { formatTaskPeriodFromTask } from '../../utils/taskPeriod';
import { resolveTaskUnitCardFields } from '../../utils/taskUnitDisplay';
import { isTaskDeleted } from '../../utils/taskUtils';
import { useTaskTransitionAnimation } from '../../hooks/useTaskTransitionAnimation';
import { TaskTransitionAnimation } from '../../components/dashboard/TaskTransitionAnimation';
import { getTaskStatusCategoryFromTask, TaskStatusCategory } from '../../utils/taskStatus';
import { parseDueSoonDays } from '../../utils/dueSoonDays';
import { waitForSocketConnection } from '../../services/socketService';
import { getTaskCreationUserConfig, taskCreationUserConfigQueryKey } from '../../services/userTaskCreationConfigService';
import { useTaskCardDisplayConfig } from '../../hooks/useTaskCardDisplayConfig';
import { DashboardCalendarDayBadge } from '../../components/dashboard/DashboardCalendarDayBadge';
import { DashboardReportsSection } from '../../components/dashboard/DashboardReportsSection';
import {
  getTaskStatusCardCircleClass,
  TaskStatusCardIcon,
} from '../../components/dashboard/TaskStatusCardIcon';

type CalendarDaySnapshot = {
  date: string;
  count: number;
};

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prevPathRef = useRef<string>(location.pathname);
  // Expand/collapse state for D.M. and C.M. sections (combined for both self and assigned)
  const [expandedDM, setExpandedDM] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  // const [expandedCM, setExpandedCM] = useState(false);
  const [taskDetails, setTaskDetails] = useState<Record<string, any>>({});
  const [showAssignedMemberFilter, setShowAssignedMemberFilter] = useState(false);
  const [assignedMemberSearch, setAssignedMemberSearch] = useState('');
  const [selectedAssignedMemberIds, setSelectedAssignedMemberIds] = useState<string[]>([]);
  const assignedMemberFilterRef = useRef<HTMLDivElement>(null);
  const [selfCalendarMonth, setSelfCalendarMonth] = useState(() => new Date());
  const [assignedCalendarMonth, setAssignedCalendarMonth] = useState(() => new Date());

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
    () => dashboardService.getDashboard(),
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
  const dueSoonDays = useMemo(
    () => parseDueSoonDays(dashboardData?.data?.dueSoonDays ?? dashboardData?.dueSoonDays),
    [dashboardData]
  );
  const { data: selfCalendarData, isLoading: isSelfCalendarLoading } = useQuery(
    ['admin-dashboard-calendar', 'self', selfCalendarMonth.getFullYear(), selfCalendarMonth.getMonth() + 1],
    () => dashboardService.getMonthlyCalendar('self', selfCalendarMonth.getFullYear(), selfCalendarMonth.getMonth() + 1),
    { staleTime: 30000 }
  );
  const { data: assignedCalendarData, isLoading: isAssignedCalendarLoading } = useQuery(
    ['admin-dashboard-calendar', 'assigned', assignedCalendarMonth.getFullYear(), assignedCalendarMonth.getMonth() + 1],
    () => dashboardService.getMonthlyCalendar('assigned', assignedCalendarMonth.getFullYear(), assignedCalendarMonth.getMonth() + 1),
    { staleTime: 30000 }
  );
  const { data: taskConversations = [] } = useQuery(
    ['dashboard-task-conversations', 'admin'],
    () => conversationService.getConversations('task'),
    {
      refetchInterval: 30000,
      refetchOnMount: 'always',
    }
  );
  const { data: dashboardEvents = [], refetch: refetchDashboardEvents } = useQuery(
    ['dashboard-events', 'admin'],
    () => dashboardService.getEvents(30),
    { staleTime: 60_000 }
  );
  const { data: allUsers = [] } = useQuery(['dashboard-event-users', 'admin'], () => conversationService.getAllUsers(), {
    staleTime: 5 * 60_000,
  });
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<'event' | 'meeting'>('event');
  const [eventDateTime, setEventDateTime] = useState('');
  const [selectedEventUsers, setSelectedEventUsers] = useState<string[]>([]);
  const [showEventParticipantsPicker, setShowEventParticipantsPicker] = useState(false);
  const eventParticipantsPickerRef = useRef<HTMLDivElement>(null);
  const closeEventParticipantsPicker = useCallback(() => setShowEventParticipantsPicker(false), []);
  useClickOutside(eventParticipantsPickerRef, closeEventParticipantsPicker, showEventParticipantsPicker);
  const currentOrgId = (user as any)?.organizationId || (user as any)?.organization_id;
  const orgUsers = useMemo(
    () =>
      (allUsers as any[]).filter(
        (u: any) => String(u.organization_id ?? u.organizationId ?? '') === String(currentOrgId ?? '')
      ),
    [allUsers, currentOrgId]
  );
  const [savingEvent, setSavingEvent] = useState(false);
  const handleCreateDashboardEvent = async () => {
    try {
      setSavingEvent(true);
      await dashboardService.createEvent({
        title: eventTitle.trim(),
        type: eventType,
        startsAtIso: new Date(eventDateTime).toISOString(),
        participantIds: selectedEventUsers,
      });
      setShowEventForm(false);
      setEventTitle('');
      setEventDateTime('');
      setSelectedEventUsers([]);
      setShowEventParticipantsPicker(false);
      await Promise.all([refetchDashboardEvents(), refetchDashboard()]);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to create event');
    } finally {
      setSavingEvent(false);
    }
  };
  const taskCardDisplay = useTaskCardDisplayConfig();
  const { data: userTaskConfig } = useQuery(taskCreationUserConfigQueryKey, getTaskCreationUserConfig, {
    staleTime: 60_000,
  });

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
  const unreadCountByConversationId = useMemo(() => {
    const map: Record<string, number> = {};
    (taskConversations || []).forEach((conv: any) => {
      const convId = String(conv?.id || conv?.conversationId || '').trim();
      if (!convId) return;
      map[convId] = Number(conv?.unreadCount ?? conv?.unread_count ?? 0) || 0;
    });
    return map;
  }, [taskConversations]);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    const setupTaskConversationListeners = async () => {
      try {
        const socket = await waitForSocketConnection();
        if (!mounted) return;

        const handleNewMessage = (message: any) => {
          const convId = String(message?.conversation_id || '').trim();
          if (!convId) return;
          queryClient.setQueryData(['dashboard-task-conversations', 'admin'], (oldData: any[] = []) => {
            return oldData.map((conv: any) => {
              const id = String(conv?.id || conv?.conversationId || '').trim();
              if (id !== convId) return conv;
              const nextUnread = Number(conv?.unreadCount ?? conv?.unread_count ?? 0) + 1;
              return { ...conv, unreadCount: nextUnread, unread_count: nextUnread };
            });
          });
        };

        const handleConversationMessagesRead = (data: any) => {
          const convId = String(data?.conversationId || '').trim();
          if (!convId) return;
          queryClient.setQueryData(['dashboard-task-conversations', 'admin'], (oldData: any[] = []) => {
            return oldData.map((conv: any) => {
              const id = String(conv?.id || conv?.conversationId || '').trim();
              if (id !== convId) return conv;
              return { ...conv, unreadCount: 0, unread_count: 0 };
            });
          });
        };

        socket.on('new_message', handleNewMessage);
        socket.on('conversation_messages_read', handleConversationMessagesRead);
        cleanup = () => {
          socket.off('new_message', handleNewMessage);
          socket.off('conversation_messages_read', handleConversationMessagesRead);
        };
      } catch {
        // ignore socket setup errors on dashboard
      }
    };

    setupTaskConversationListeners();
    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [queryClient]);

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

  useClickOutside(profileMenuRef, () => setShowProfileMenu(false), showProfileMenu);
  useClickOutside(
    assignedMemberFilterRef,
    () => setShowAssignedMemberFilter(false),
    showAssignedMemberFilter
  );

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
        const bucket = (getTaskStatusCategoryFromTask(merged, dueSoonDays, currentUserId) || 'todo') as TaskStatusCategory;
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
      const bucket = (getTaskStatusCategoryFromTask(merged, dueSoonDays, currentUserId) || 'todo') as TaskStatusCategory;
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
          const derived = (getTaskStatusCategoryFromTask(merged, dueSoonDays, currentUserId) || 'todo') as TaskStatusCategory;
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
          const convId = String(merged.conversation_id || merged.conversationId || '').trim();

          const unitPref =
            userTaskConfig?.taskUnitPreference === 'org_node' || userTaskConfig?.taskUnitPreference === 'org_unit'
              ? 'org_unit'
              : userTaskConfig?.taskUnitPreference || 'org_unit';
          const chosenUnit = resolveTaskUnitCardFields(merged, unitPref);
          return (
            <TaskCard
              key={task.id}
              id={task.id}
              title={merged.title}
              clientName={merged.client_name || merged.clientName}
              tags={merged.tags}
              description={merged.description}
              status={derived}
              dueDate={merged.due_date || merged.dueDate}
              category={merged.category}
              assignees={cardAssignees}
              progress={derived === 'inprogress' ? progress : undefined}
              finance={hasFinance && isCreator ? { amount: merged.financial_value, type: merged.finance_type } : undefined}
              unreadCount={convId ? unreadCountByConversationId[convId] ?? 0 : 0}
              hideUserStatus={!!merged.hide_user_status}
              rawTaskStatus={merged.status}
              taskPeriod={formatTaskPeriodFromTask(merged)}
              frequency={String(merged.recurrence_type || merged.frequency || merged.task_frequency || ((merged.task_type === 'recurring' || merged.taskType === 'recurring' || merged.task_type === 'recurring_instance' || merged.taskType === 'recurring_instance') ? 'Recurring' : 'One-Time'))}
              taskUnitType={chosenUnit.unitType}
              taskUnitName={chosenUnit.unitName}
              taskCardDisplay={taskCardDisplay}
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
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col space-y-2">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="h-5 w-1 shrink-0 rounded-full bg-primary"></div>
          <h2 className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white md:text-base">{title}</h2>
          <div className="h-px min-w-[2rem] flex-1 bg-gray-200 dark:bg-gray-700"></div>
          {viewType === 'assigned' ? (
            <div className="relative w-full min-w-0 shrink-0 sm:w-[200px]" ref={assignedMemberFilterRef}>
              <button
                type="button"
                onClick={() => setShowAssignedMemberFilter((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-slate-800 dark:text-gray-200"
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
                <div className="absolute left-0 z-20 mt-2 w-full min-w-[240px] max-w-[280px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 shadow-lg sm:left-auto sm:right-0">
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
          ) : null}
        </div>

        {/* Statistics Cards for this section */}
        <div className="mb-1 grid grid-cols-5 gap-1">
          {/* To-Do Card (Today’s recurring, not completed) */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=todo`)}
            className="relative flex h-fit w-full min-w-0 flex-col items-center rounded-lg border border-gray-200 border-l-[3px] border-l-blue-500 bg-white px-1.5 py-2 text-center shadow-sm transition-colors duration-200 hover:shadow-md dark:border-gray-700 dark:bg-slate-800/95"
          >
            <div
              ref={toDoIconRef}
              className={`mb-1 flex size-7 items-center justify-center rounded-full ${getTaskStatusCardCircleClass('todo')}`}
            >
              <TaskStatusCardIcon status="todo" size={16} />
            </div>
            <span className="mb-0.5 text-base font-semibold leading-none text-gray-900 dark:text-white">
              {getStatusCount('todo', viewType)}
            </span>
            <span className="w-full truncate px-0.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-600 dark:text-gray-400">
              TO DO
            </span>
          </button>
          
          {/* In Progress Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=inprogress`)}
            className="relative flex h-fit w-full min-w-0 flex-col items-center rounded-lg border border-gray-200 border-l-[3px] border-l-purple-500 bg-white px-1.5 py-2 text-center shadow-sm transition-colors duration-200 hover:shadow-md dark:border-gray-700 dark:bg-slate-800/95"
          >
            <div
              ref={inProgressIconRef}
              className={`mb-1 flex size-7 items-center justify-center rounded-full ${getTaskStatusCardCircleClass('inprogress')}`}
            >
              <TaskStatusCardIcon status="inprogress" size={16} />
            </div>
            <span className="mb-0.5 text-base font-semibold leading-none text-gray-900 dark:text-white">
              {getStatusCount('inprogress', viewType)}
            </span>
            <span className="w-full truncate px-0.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-600 dark:text-gray-400">
              In Progress
            </span>
          </button>
          
          {/* Due Soon Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=duesoon`)}
            className="relative flex h-fit w-full min-w-0 flex-col items-center rounded-lg border border-gray-200 border-l-[3px] border-l-amber-500 bg-white px-1.5 py-2 text-center shadow-sm transition-colors duration-200 hover:shadow-md dark:border-gray-700 dark:bg-slate-800/95"
          >
            <div
              className={`mb-1 flex size-7 items-center justify-center rounded-full ${getTaskStatusCardCircleClass('duesoon')}`}
            >
              <TaskStatusCardIcon status="duesoon" size={16} />
            </div>
            <span className="mb-0.5 text-base font-semibold leading-none text-gray-900 dark:text-white">
              {getStatusCount('duesoon', viewType)}
            </span>
            <span className="w-full truncate px-0.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-600 dark:text-gray-400">
              Due Soon
            </span>
          </button>
          
          {/* Overdue Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=overdue`)}
            className="relative flex h-fit w-full min-w-0 flex-col items-center rounded-lg border border-gray-200 border-l-[3px] border-l-red-500 bg-white px-1.5 py-2 text-center shadow-sm transition-colors duration-200 hover:shadow-md dark:border-gray-700 dark:bg-slate-800/95"
          >
            <div
              className={`mb-1 flex size-7 items-center justify-center rounded-full ${getTaskStatusCardCircleClass('overdue')}`}
            >
              <TaskStatusCardIcon status="overdue" size={16} />
            </div>
            <span className="mb-0.5 text-base font-semibold leading-none text-gray-900 dark:text-white">
              {getStatusCount('overdue', viewType)}
            </span>
            <span className="w-full truncate px-0.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-600 dark:text-gray-400">
              Overdue
            </span>
          </button>
          
          {/* Completed Card - clickable */}
          <button
            type="button"
            onClick={() => navigate(`/admin/tasks?view=${viewType}&status=completed`)}
            className="relative flex h-fit w-full min-w-0 flex-col items-center rounded-lg border border-gray-200 border-l-[3px] border-l-emerald-500 bg-white px-1.5 py-2 text-center shadow-sm transition-colors duration-200 hover:shadow-md dark:border-gray-700 dark:bg-slate-800/95"
          >
            <div
              ref={completedIconRef}
              className={`mb-1 flex size-7 items-center justify-center rounded-full ${getTaskStatusCardCircleClass('completed')}`}
            >
              <TaskStatusCardIcon status="completed" size={16} />
            </div>
            <span className="mb-0.5 text-base font-semibold leading-none text-gray-900 dark:text-white">
              {getStatusCount('completed', viewType)}
            </span>
            <span className="w-full truncate px-0.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-600 dark:text-gray-400">
              Completed
            </span>
          </button>
        </div>
      </div>
    );
  };

  const renderCalendarSection = (
    title: string,
    monthDate: Date,
    onShiftMonth: (delta: number) => void,
    selfDaysRaw: CalendarDaySnapshot[] | undefined,
    assignedDaysRaw: CalendarDaySnapshot[] | undefined,
    loading: boolean
  ) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const selfDays = Array.isArray(selfDaysRaw) ? selfDaysRaw : [];
    const assignedDays = Array.isArray(assignedDaysRaw) ? assignedDaysRaw : [];
    const assignedByDate = new Map<string, number>();
    assignedDays.forEach((d) => {
      assignedByDate.set(d.date, typeof d.count === 'number' ? d.count : 0);
    });
    const days = selfDays.map((d) => ({
      date: d.date,
      selfCount: typeof d.count === 'number' ? d.count : 0,
      assignedCount: assignedByDate.get(d.date) || 0,
    }));
    const cells: Array<CalendarDaySnapshot | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    days.forEach((d: any) => cells.push(d));
    while (cells.length % 7 !== 0) cells.push(null);
    const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthDate);

    const dueDayBox = (day: any) => (
      <DashboardCalendarDayBadge
        selfCount={day.selfCount || 0}
        assignedCount={day.assignedCount || 0}
      />
    );

    return (
      <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800/95 p-2.5 sm:p-3">
        <div className="mb-2 flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white sm:text-sm">{title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 self-start sm:self-center">
            <button type="button" onClick={() => onShiftMonth(-1)} className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="material-icons-outlined text-sm">chevron_left</span>
            </button>
            <span className="min-w-[6.5rem] text-center text-[11px] font-medium text-gray-700 dark:text-gray-300 sm:min-w-[7.5rem]">{monthLabel}</span>
            <button type="button" onClick={() => onShiftMonth(1)} className="rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="material-icons-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-4 text-xs text-gray-500 dark:text-gray-400">
            Loading calendar...
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-0.5 grid shrink-0 grid-cols-7 gap-0.5 sm:gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                <div key={w} className="py-0.5 text-center text-[8px] font-semibold text-gray-500 dark:text-gray-400 sm:text-[9px]">
                  <span className="sm:hidden">{w.charAt(0)}</span>
                  <span className="hidden sm:inline">{w}</span>
                </div>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-0.5 sm:gap-1">
            {cells.map((day: any, idx) => (
              <div
                key={`${day?.date || 'blank'}-${idx}`}
                className={`min-h-[2.5rem] rounded border p-0.5 sm:min-h-[2.75rem] sm:p-1 ${day ? 'border-gray-200 dark:border-gray-700' : 'border-transparent'}`}
              >
                {day ? (
                  <>
                    <div className="text-[9px] font-bold leading-none text-gray-700 dark:text-gray-200 sm:text-[10px]">{new Date(day.date + 'T12:00:00').getDate()}</div>
                    {dueDayBox(day)}
                  </>
                ) : null}
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col overflow-x-hidden bg-gray-50 px-3 py-3 pb-24 dark:bg-gray-900 sm:px-5 md:px-6 md:py-4 lg:pb-20">
        {/* Welcome Header */}
        <div className="mb-2 shrink-0 max-[1366px]:mb-1.5">
          <div className="mb-2 flex items-center justify-between max-[1366px]:mb-1.5">
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className="flex items-center gap-3 text-left"
              >
                {user?.profilePhotoUrl || (user as any)?.profile_photo || (user as any)?.profile_photo_url ? (
                  <img
                    src={(user as any)?.profilePhotoUrl || (user as any)?.profile_photo || (user as any)?.profile_photo_url}
                    alt={user?.name || 'Admin'}
                    className="h-11 w-11 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
                    {String(user?.name || 'A').trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white sm:text-xl md:text-2xl">
                    Hello {user?.name || 'Admin'}
                  </h1>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
                    Here's an overview of your tasks and progress
                  </p>
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-slate-800 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/profile');
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-slate-700"
                  >
                    View/Edit Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      showLogoutConfirm(toast, logout, navigate);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:gap-5">
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2 lg:items-stretch">
            <section className="flex min-h-0 min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-slate-800/95 sm:p-3 lg:h-full">
              <div className="mb-2 shrink-0">
                <h3 className="text-xs font-semibold text-gray-900 dark:text-white sm:text-sm">Dashboard</h3>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-rows-2 lg:gap-0">
                <div className="flex min-h-0 flex-1 flex-col lg:pb-3">
                  {renderTaskRow(selfTasks, 'self', 'Self Tasks', selfTasksToDoIconRef, selfTasksInProgressIconRef, selfTasksCompletedIconRef)}
                </div>
                <div className="flex min-h-0 flex-1 flex-col border-t border-gray-100 pt-3 dark:border-gray-700 lg:pt-3">
                  {renderTaskRow(assignedTasks, 'assigned', 'Assigned Tasks', assignedTasksToDoIconRef, assignedTasksInProgressIconRef, assignedTasksCompletedIconRef)}
                </div>
              </div>
            </section>
            <section className="flex min-h-[320px] min-w-0 flex-col lg:min-h-0 lg:h-full">
              {renderCalendarSection(
                'Calendar',
                selfCalendarMonth,
                (delta) => {
                  setSelfCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
                  setAssignedCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
                },
                selfCalendarData?.days,
                assignedCalendarData?.days,
                isSelfCalendarLoading || isAssignedCalendarLoading
              )}
            </section>
          </div>
        </div>

        <div className="mt-4 shrink-0 w-full">
          <DashboardReportsSection
            tasks={getCurrentTasks}
            creatorUserId={user?.id || (user as any)?.userId}
            dueSoonDays={dueSoonDays}
          />
        </div>

        <div className="mt-4 shrink-0 space-y-6 md:space-y-8 max-[1366px]:mt-3 max-[1366px]:space-y-4">
          <div className="h-fit rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800/95 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Events & Meetings</h3>
              <button
                type="button"
                onClick={() => setShowEventForm((v) => !v)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
              >
                {showEventForm ? 'Close' : 'Add'}
              </button>
            </div>
            {showEventForm && (
              <div className="mb-4 overflow-hidden rounded-2xl border border-[#E5E7EB]">
                <div className="flex items-center justify-between bg-primary px-4 py-3">
                  <h4 className="text-sm font-bold text-white">Create Event / Meeting</h4>
                  <span className="text-[11px] font-semibold text-white/90">Task-create style</span>
                </div>
                <div className="space-y-3 bg-[#F9FAFB] p-4">
                  <div className="rounded-xl border border-[#E7D9FF] bg-[#F8F5FF] px-4 py-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Basic Info</div>
                    <label className="mb-1 mt-3 block text-sm font-semibold text-[#1F2937]">Title</label>
                    <input
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Event/Meeting title"
                      className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <label className="mb-1 mt-3 block text-sm font-semibold text-[#1F2937]">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={eventDateTime}
                      onChange={(e) => setEventDateTime(e.target.value)}
                      className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>

                  <div className="rounded-xl border border-[#E7D9FF] bg-[#F8F5FF] px-4 py-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Type & Participants</div>
                    <label className="mb-1 mt-3 block text-sm font-semibold text-[#1F2937]">Type</label>
                    <div className="flex flex-wrap gap-2">
                      {(['event', 'meeting'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setEventType(type)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                            eventType === type
                              ? 'border-primary bg-primary text-white'
                              : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6]'
                          }`}
                        >
                          {type === 'event' ? 'Event' : 'Meeting'}
                        </button>
                      ))}
                    </div>
                    <div ref={eventParticipantsPickerRef}>
                      <button
                        type="button"
                        onClick={() => setShowEventParticipantsPicker((v) => !v)}
                        className="mt-3 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 text-left text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        Participants: {selectedEventUsers.length > 0 ? `${selectedEventUsers.length} selected` : 'Select users'}
                      </button>
                      {selectedEventUsers.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {orgUsers
                            .filter((u: any) => selectedEventUsers.includes(String(u.id)))
                            .map((u: any) => (
                              <span
                                key={u.id}
                                className="inline-flex items-center gap-1 rounded-full border border-[#DDD6FE] bg-[#F3E8FF] px-2.5 py-1 text-xs font-semibold text-primary"
                              >
                                {u.name || u.mobile}
                              </span>
                            ))}
                        </div>
                      )}
                      {showEventParticipantsPicker && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white">
                        {orgUsers.map((u: any) => {
                          const uid = String(u.id);
                          const checked = selectedEventUsers.includes(uid);
                          return (
                            <label
                              key={uid}
                              className="flex cursor-pointer items-center justify-between border-b border-[#F3F4F6] px-3 py-2 text-sm last:border-b-0"
                            >
                              <span className="text-[#1F2937]">{u.name || u.mobile}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  setSelectedEventUsers((prev) =>
                                    e.target.checked ? [...prev, uid] : prev.filter((id) => id !== uid)
                                  )
                                }
                                className="h-4 w-4 rounded border-[#C4B5FD] accent-primary"
                              />
                            </label>
                          );
                        })}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!eventTitle.trim() || !eventDateTime || savingEvent}
                    onClick={handleCreateDashboardEvent}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {savingEvent ? 'Saving...' : 'Create Event'}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {(dashboardEvents as any[]).length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No upcoming events or meetings.</p>
              ) : (
                (dashboardEvents as any[]).map((ev: any) => (
                  <div key={ev.id} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{ev.title}</p>
                      <span className="text-[11px] uppercase text-primary font-semibold">{ev.type}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {new Date(ev.starts_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

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
                className="w-full flex h-fit items-center justify-between p-3 bg-white dark:bg-slate-800/95 rounded-xl group transition-colors duration-200 border border-gray-200 dark:border-gray-700 border-l-[4px] border-l-primary shadow-sm hover:shadow-md"
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
