import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery, useQueries, useQueryClient, useMutation } from 'react-query';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { dashboardService } from '../../services/dashboardService';
import { masterDataService, TaskServiceItem } from '../../services/masterDataService';
import { entityListService } from '../../services/entityListService';
import { waitForSocketConnection } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { TaskGroupChatConversation } from '../messaging/TaskGroupChatConversation';
import { BulkAssignUsersModal } from '../../components/tasks/BulkAssignUsersModal';
import { BulkTaskActionsMenu } from '../../components/tasks/BulkTaskActionsMenu';
import { taskBulkService } from '../../services/taskBulkService';
import { isTaskDeleted } from '../../utils/taskUtils';
import { getTaskStatusCategoryFromTask, TaskStatusCategory } from '../../utils/taskStatus';
import { formatFrequencyLabel } from '../../utils/taskPeriod';
import { parseDueSoonDays } from '../../utils/dueSoonDays';
import { getLastTasksDueSoonDays } from '../../services/taskService';
import { resolveTaskTitleWithPeriod } from '../../utils/taskPeriod';
import { resolveTaskUnitForPreference } from '../../utils/taskUnitDisplay';
import { getTaskCreationUserConfig, taskCreationUserConfigQueryKey } from '../../services/userTaskCreationConfigService';
import { useClickOutside } from '../../hooks/useClickOutside';
import { FilterChipScrollRow } from '../../components/shared/FilterChipScrollRow';
import {
  getTaskStatusCardCircleClass,
  TaskStatusCardIcon,
  type DashboardTaskStatStatus,
} from '../../components/dashboard/TaskStatusCardIcon';
import { taskStatusToAppIcon } from '../../constants/appIcons';
import { useTaskCardDisplayConfig } from '../../hooks/useTaskCardDisplayConfig';
import type { TaskCardDisplayConfig } from '../../utils/taskCardDisplayConfig';
import { resolveTaskCardMembers, type TaskCardMember, getProfileInitials } from '../../utils/taskCardMembers';
import {
  sortConversationsByRecentActivity,
  sortTaskDashboardCards,
  type TaskDashboardCardEntry,
} from '../../utils/taskDashboardSort';
import {
  bumpTaskDashboardActivity,
  isTaskRecentlyActiveForFilter,
  type TaskActivityBumpMap,
} from '../../utils/taskDashboardActivity';
import { normalizeConvId } from '../../utils/notificationConvId';
import { timestampToMs } from '../../utils/chatTime';

type TaskDashboardStatus = TaskStatusCategory;

function TaskCardProfileAvatar({ member }: { member: TaskCardMember }) {
  const initial = getProfileInitials(member.name);

  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-gray-200 text-[9px] font-semibold tracking-tight text-gray-700 dark:bg-gray-700 dark:text-gray-200"
      title={`Owner: ${member.name}`}
    >
      {member.photoUrl ? (
        <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

function TaskDashboardCardBody({
  display,
  displayTitle,
  taskStatusCategory,
  taskTagOrClient,
  taskDueLabel,
  taskFrequencyLabel,
  taskUnitLabel,
  owner,
  assignees,
  titleClassName,
}: {
  display: TaskCardDisplayConfig;
  displayTitle: string;
  taskStatusCategory: TaskDashboardStatus | null;
  taskTagOrClient: string;
  taskDueLabel: string;
  taskFrequencyLabel: string;
  taskUnitLabel: string | null;
  owner?: TaskCardMember | null;
  assignees?: TaskCardMember[];
  titleClassName?: string;
}) {
  const showStatusIcon = display.statusIcon && !!taskStatusCategory;
  const showTag = display.tagOrClient && !!taskTagOrClient;
  const showDue = display.dueDate && !!taskDueLabel;
  const showFreq = display.frequency && !!taskFrequencyLabel;
  const showUnit = display.taskUnit && !!taskUnitLabel;
  const normalizedAssignees = Array.isArray(assignees) ? assignees.filter((a) => !!a?.id) : [];
  const showOwner = display.assigneeProfiles && !!owner?.id;
  const showAssigneeGroup = display.assigneeProfiles && normalizedAssignees.length > 0;
  const showHeaderRow = display.title || showStatusIcon || showOwner;
  const showAssigneeRow = showAssigneeGroup;
  const showSecondRow = showTag || showDue;
  const showThirdRow = showFreq || showUnit;

  return (
    <div className="w-full">
      <div className="grid w-full grid-cols-[minmax(0,2fr)_auto] gap-x-2 gap-y-1">
      {showHeaderRow ? (
        <>
          {display.title || showOwner ? (
            <div className="flex min-w-0 items-center gap-1.5">
              {showOwner && owner ? <TaskCardProfileAvatar member={owner} /> : null}
              {display.title ? (
                <h4
                  className={
                    titleClassName ||
                    'min-w-0 flex-1 text-xs font-bold text-gray-900 dark:text-white truncate'
                  }
                >
                  {displayTitle}
                </h4>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          ) : (
            <div />
          )}
          <div className="flex justify-end">
            {showStatusIcon && taskStatusCategory ? (
              <TaskStatusIcon category={taskStatusCategory} />
            ) : null}
          </div>
        </>
      ) : null}

      {showAssigneeRow ? (
        <div className="col-span-2 pt-0.5">
          <TaskCardAssigneeGroup assignees={normalizedAssignees} align="start" />
        </div>
      ) : null}

      {showSecondRow ? (
        <>
          {showTag ? (
            <p className="min-w-0 text-[11px] text-gray-700 dark:text-gray-300 truncate">{taskTagOrClient}</p>
          ) : (
            <div />
          )}
          {showDue ? (
            <p className="text-[11px] text-right text-gray-500 dark:text-gray-400 truncate">{taskDueLabel}</p>
          ) : (
            <div />
          )}
        </>
      ) : null}

      {showThirdRow ? (
        <>
          {showFreq ? (
            <p className="min-w-0 text-[11px] text-gray-500 dark:text-gray-400 truncate">{taskFrequencyLabel}</p>
          ) : (
            <div />
          )}
          {showUnit ? (
            <p className="text-[11px] text-right text-gray-500 dark:text-gray-400 truncate">{taskUnitLabel}</p>
          ) : (
            <div />
          )}
        </>
      ) : null}
      </div>
    </div>
  );
}

function TaskCardAssigneeGroup({
  assignees,
  align = 'end',
}: {
  assignees: Array<{ id: string; name: string; photoUrl?: string | null }>;
  align?: 'start' | 'end';
}) {
  const visible = assignees.slice(0, 2);
  const extra = Math.max(0, assignees.length - visible.length);

  const getInitial = (name?: string) => getProfileInitials(name);

  return (
    <div className={`flex items-center ${align === 'start' ? 'justify-start' : 'justify-end'}`}>
      <div className="flex items-center -space-x-2">
        {visible.map((a) => (
          <span
            key={a.id}
            className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gray-200 text-[9px] font-semibold tracking-tight text-gray-700 shadow-sm dark:border-slate-800 dark:bg-gray-700 dark:text-gray-200"
            title={a.name}
          >
            {a.photoUrl ? (
              <img src={a.photoUrl} alt={a.name} className="h-full w-full object-cover" />
            ) : (
              getInitial(a.name)
            )}
          </span>
        ))}
        {extra > 0 ? (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] font-bold text-gray-600 shadow-sm dark:border-slate-800 dark:bg-gray-600 dark:text-gray-100"
            title={`${extra} more assignees`}
          >
            +{extra}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TaskDashboardUnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="absolute -top-2 right-2 z-[5] flex h-5 min-w-[20px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1.5 text-[11px] font-bold text-white dark:border-gray-900"
      aria-label={`${count} unread messages in task chat`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

const STATUS_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  scheduled: 'Scheduled',
  todo: 'To Do',
  inprogress: 'In Progress',
  duesoon: 'Due Soon',
  overdue: 'Overdue',
  completed: 'Completed',
};
const STATUS_COLORS: Record<Exclude<StatusFilter, 'all'>, string> = {
  scheduled: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  todo: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  inprogress: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  duesoon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};
const STATUS_ICON_COLORS: Record<Exclude<StatusFilter, 'all'>, string> = {
  scheduled: 'text-indigo-600 dark:text-indigo-300',
  todo: 'text-blue-600 dark:text-blue-300',
  inprogress: 'text-purple-600 dark:text-purple-300',
  duesoon: 'text-amber-600 dark:text-amber-300',
  overdue: 'text-red-600 dark:text-red-300',
  completed: 'text-emerald-600 dark:text-emerald-300',
};

export type StatusFilter = 'all' | TaskDashboardStatus;
type ViewFilter = 'all' | 'self' | 'assigned';

function TaskStatusIcon({ category }: { category: Exclude<StatusFilter, 'all'> }) {
  const appIcon = taskStatusToAppIcon(category);
  const title = STATUS_LABELS[category];
  if (appIcon) {
    return (
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${getTaskStatusCardCircleClass(category as DashboardTaskStatStatus)}`}
        title={title}
      >
        <TaskStatusCardIcon status={category as DashboardTaskStatStatus} size={25} />
      </span>
    );
  }
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 ring-1 ring-indigo-200/70 dark:bg-indigo-900/30 dark:ring-indigo-800/50"
      title={title}
    >
      <span
        className={`material-icons-round text-[25px] ${STATUS_ICON_COLORS[category]}`}
        aria-hidden
      >
        event_note
      </span>
    </span>
  );
}

export const TaskDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId: selectedConversationId } = useParams<{ conversationId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { taskChatUnreadByConvId, clearConversationUnread } = useNotifications();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const enableBulkUploadUI = false;
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloadingTaskTemplate, setIsDownloadingTaskTemplate] = useState(false);
  const [isBulkUploadingTasks, setIsBulkUploadingTasks] = useState(false);
  const bulkTaskFileInputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showTeamMemberFilter, setShowTeamMemberFilter] = useState(false);
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
  const teamMemberFilterRef = useRef<HTMLDivElement>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTaskId, setRejectTaskId] = useState<string | null>(null);
  const [rejectTaskTitle, setRejectTaskTitle] = useState('');
  const [rejectConvId, setRejectConvId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const socketRef = React.useRef<any>(null);
  const activityBumpRef = useRef<TaskActivityBumpMap>(new Map());
  const [activityBumpTick, setActivityBumpTick] = useState(0);
  const taskIdByConvIdRef = useRef<Record<string, string>>({});
  const taskByConvIdRef = useRef<Record<string, any>>({});

  const recordTaskActivity = useCallback(
    (ids: { taskId?: string | null; conversationId?: string | null; atMs?: number }) => {
      bumpTaskDashboardActivity(activityBumpRef.current, ids);
      setActivityBumpTick((n) => n + 1);
    },
    []
  );

  // Track first successful fetch instead of fetch transition (prevents showing stale cache on first paint).
  const [hasConversationsFetchedSinceMount, setHasConversationsFetchedSinceMount] = useState(false);
  const [hasTasksFetchedSinceMount, setHasTasksFetchedSinceMount] = useState(false);
  const { data: userTaskConfig } = useQuery(taskCreationUserConfigQueryKey, getTaskCreationUserConfig, {
    staleTime: 60_000,
  });
  const taskCardDisplay = useTaskCardDisplayConfig();

  // Scheduled indicator must come from backend lifecycle fields (DB),
  // not from client-side date comparisons.
  const { data: dashboardData } = useQuery(
    ['task-dashboard-data'],
    () => dashboardService.getDashboard(),
    {
      staleTime: 30000,
    }
  );

  const resolveTaskClientName = (taskLike: any): string => {
    if (!taskLike) return '';
    const raw =
      taskLike.client_name ??
      taskLike.clientName ??
      taskLike.entity_name ??
      taskLike.entityName;
    return typeof raw === 'string' ? raw.trim() : '';
  };

  const resolveTaskUnitDisplay = (taskLike: any) => {
    const preference =
      userTaskConfig?.taskUnitPreference === 'org_node' || userTaskConfig?.taskUnitPreference === 'org_unit'
        ? 'org_unit'
        : userTaskConfig?.taskUnitPreference || 'org_unit';
    return resolveTaskUnitForPreference(taskLike, preference);
  };

  const resolveTaskTagOrClient = (taskLike: any): string => {
    const tagText = Array.isArray(taskLike?.tags)
      ? taskLike.tags.filter(Boolean).join(', ')
      : typeof taskLike?.tags === 'string'
      ? taskLike.tags.trim()
      : '';
    return (tagText || resolveTaskClientName(taskLike) || '').trim();
  };

  const resolveTaskDueDateLabel = (taskLike: any): string => {
    const source = taskLike?.due_date || taskLike?.dueDate;
    if (!source) return '';
    const date = new Date(source);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const resolveTaskFrequencyLabel = (taskLike: any): string => {
    const isRecurring =
      taskLike?.task_type === 'recurring' ||
      taskLike?.taskType === 'recurring' ||
      taskLike?.task_type === 'recurring_instance' ||
      taskLike?.taskType === 'recurring_instance' ||
      !!taskLike?.recurrence_type;
    return formatFrequencyLabel(
      taskLike?.recurrence_type ||
        taskLike?.frequency ||
        taskLike?.task_frequency ||
        (isRecurring ? 'Recurring' : 'One-Time')
    );
  };

  // Fetch all task services (recurring + one_time) for search suggestions
  const { data: taskServicesData } = useQuery(
    'task-services-all',
    async () => {
      const [recurring, oneTime] = await Promise.all([
        masterDataService.getTaskServices('recurring'),
        masterDataService.getTaskServices('one_time'),
      ]);
      const recurringList = (recurring.data?.data ?? recurring.data ?? []) as TaskServiceItem[];
      const oneTimeList = (oneTime.data?.data ?? oneTime.data ?? []) as TaskServiceItem[];
      const byId = new Map<string, TaskServiceItem>();
      [...recurringList, ...oneTimeList].forEach((s) => {
        if (s?.id && !byId.has(s.id)) byId.set(s.id, s);
      });
      return Array.from(byId.values());
    },
    { staleTime: 5 * 60 * 1000 }
  );
  const allTaskServices: TaskServiceItem[] = Array.isArray(taskServicesData) ? taskServicesData : [];

  // Fetch client matrix so Task Groups search can also suggest client/entity names
  const { data: clientMatrixData } = useQuery(
    'client-service-matrix-for-task-dashboard',
    async () => {
      const res = await entityListService.matrix();
      return res.data?.data || res.data || {};
    },
    { staleTime: 5 * 60 * 1000 }
  );
  const clientMatrixClients = (clientMatrixData as any)?.clients || [];
  const dashboardTagSuggestions = useMemo(() => {
    const out = new Set<string>();
    const cachedDashboardData = queryClient.getQueryData(['task-dashboard-data']) as any;
    const data = cachedDashboardData?.data || {};
    const groups = ['selfTasks', 'assignedTasks'];
    const buckets = ['general', 'documentManagement', 'complianceManagement'];
    const statuses = ['scheduled', 'todo', 'overdue', 'dueSoon', 'inProgress', 'completed'];
    groups.forEach((g) => {
      buckets.forEach((b) => {
        statuses.forEach((s) => {
          const list = data?.[g]?.[b]?.[s];
          if (!Array.isArray(list)) return;
          list.forEach((t: any) => {
            const tags = Array.isArray(t?.tags)
              ? t.tags
              : typeof t?.tags === 'string'
              ? t.tags.split(',').map((x: string) => x.trim())
              : [];
            tags.filter(Boolean).forEach((tag: string) => out.add(tag));
          });
        });
      });
    });
    return Array.from(out).slice(0, 40);
  }, [queryClient, searchQuery]);

  // Google-like suggestions: show Services, Clients and Task Tags
  // When focused with empty query show top items; when typing filter by text
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const serviceItems =
      allTaskServices.map((s) => ({
        id: s.id,
        title: s.title,
        frequency: (s as any).frequency,
        type: 'service' as const,
      })) || [];

    const clientItems =
      clientMatrixClients.map((c: any) => ({
        id: c.id,
        title: c.name,
        code: c.code,
        type: 'client' as const,
      })) || [];

    const tagItems =
      dashboardTagSuggestions.map((tag) => ({
        id: `tag-${tag}`,
        title: tag,
        type: 'tag' as const,
      })) || [];

    let combined = [...serviceItems, ...clientItems, ...tagItems];

    if (q) {
      combined = combined.filter((item) => (item.title || '').toLowerCase().includes(q));
    }

    return combined.slice(0, 25);
  }, [searchQuery, allTaskServices, clientMatrixClients, dashboardTagSuggestions]);

  // Status filter from URL (dashboard card navigation) or local state
  const statusFromUrl = searchParams.get('status');
  const viewFromUrl = searchParams.get('view');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const v = (statusFromUrl || '').toLowerCase();
    if (
      v === 'all' ||
      v === 'scheduled' ||
      v === 'todo' ||
      v === 'overdue' ||
      v === 'duesoon' ||
      v === 'inprogress' ||
      v === 'completed'
    ) {
      return v as StatusFilter;
    }
    return 'all';
  });

  const [viewFilter, setViewFilter] = useState<ViewFilter>(() => {
    const v = (viewFromUrl || '').toLowerCase();
    if (v === 'all' || v === 'self' || v === 'assigned') return v as ViewFilter;
    return 'all';
  });

  // Sync filters from URL (dashboard deep links) or reset when opened from sidebar notification badge
  useEffect(() => {
    if ((location.state as { resetTaskFilters?: boolean } | null)?.resetTaskFilters) {
      setStatusFilter('all');
      setViewFilter('all');
      setSearchQuery('');
      setSelectedTeamMemberIds([]);
      setSearchParams({});
      navigate(location.pathname, { replace: true, state: null });
      return;
    }

    const statusParam = (searchParams.get('status') || '').toLowerCase();
    const viewParam = (searchParams.get('view') || '').toLowerCase();

    if (
      statusParam === 'all' ||
      statusParam === 'scheduled' ||
      statusParam === 'todo' ||
      statusParam === 'overdue' ||
      statusParam === 'duesoon' ||
      statusParam === 'inprogress' ||
      statusParam === 'completed'
    ) {
      setStatusFilter(statusParam as StatusFilter);
    } else if (!statusParam) {
      setStatusFilter('all');
    }

    if (viewParam === 'self' || viewParam === 'assigned') {
      setViewFilter(viewParam as ViewFilter);
    } else {
      setViewFilter('all');
    }
  }, [searchParams, location.state, location.pathname, navigate, setSearchParams]);

  const closeSearchSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }, []);

  useClickOutside(suggestionsRef, closeSearchSuggestions, showSuggestions);
  useClickOutside(
    teamMemberFilterRef,
    () => setShowTeamMemberFilter(false),
    showTeamMemberFilter
  );

  const dashboardTaskIdsForView = useMemo(() => {
    if (!dashboardData?.data) return null;
    if (viewFilter === 'all') return null;

    const sectionKey = viewFilter === 'self' ? 'selfTasks' : 'assignedTasks';
    const section = (dashboardData.data as any)[sectionKey];
    if (!section) return null;

    const ids = new Set<string>();

    Object.values(section).forEach((categoryGroup: any) => {
      if (!categoryGroup) return;
      // Collect every task id from the selected view section, independent of status bucket.
      // Status is applied later using getTaskStatusForFilter(task) so it matches Task Details.
      Object.values(categoryGroup).forEach((bucket: any) => {
        if (Array.isArray(bucket)) {
          bucket.forEach((t: any) => {
            if (t?.id) ids.add(String(t.id));
          });
        }
      });
    });

    return ids;
  }, [dashboardData, viewFilter]);

  // Fetch task conversations only.
  // refetchOnMount: "always" + staleTime: 0 so we never render stale cached data on mount; fresh fetch runs first.
  const { data: conversations = [], isLoading: isConversationsLoading, isFetching: isConversationsFetching } = useQuery(
    ['conversations', 'task'],
    () => conversationService.getConversations('task'),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      refetchOnMount: 'always',
      staleTime: 0,
      keepPreviousData: false,
    }
  );

  // Fetch tasks directly (to show newly assigned tasks that might not have conversations yet).
  // refetchOnMount + staleTime: 0 so Pending Tasks never show stale cache (e.g. completed tasks).
  const { data: directTasks = [], isLoading: isDirectTasksLoading, isFetching: isDirectTasksFetching } = useQuery(
    'tasks',
    () => taskService.getTasks(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      refetchOnMount: 'always',
      staleTime: 0,
    }
  );

  const [tasksDueSoonDays, setTasksDueSoonDays] = useState(3);
  useEffect(() => {
    if (!isDirectTasksLoading) {
      setTasksDueSoonDays(getLastTasksDueSoonDays());
    }
  }, [isDirectTasksLoading, directTasks]);

  const dueSoonDays = useMemo(() => {
    if (dashboardData) {
      return parseDueSoonDays(dashboardData?.data?.dueSoonDays ?? dashboardData?.dueSoonDays);
    }
    return tasksDueSoonDays;
  }, [dashboardData, tasksDueSoonDays]);

  const getTaskStatusForFilter = (task: any): TaskDashboardStatus | null => {
    if (!task) return null;
    const currentUserId = user?.id || (user as any)?.userId;
    return getTaskStatusCategoryFromTask(task, dueSoonDays, currentUserId);
  };

  // Set "fetched since mount" when loading has finished and we have data (so we never render stale cache first).
  useEffect(() => {
    if (!isConversationsLoading && conversations) {
      setHasConversationsFetchedSinceMount(true);
    }
  }, [isConversationsLoading, conversations]);
  useEffect(() => {
    if (!isDirectTasksLoading && directTasks) {
      setHasTasksFetchedSinceMount(true);
    }
  }, [isDirectTasksLoading, directTasks]);

  // Filter to only task groups
  const taskGroups = useMemo(() => {
    // Prevent rendering cached conversations on first mount
    if (!hasConversationsFetchedSinceMount) return [];

    return conversations.filter(conv => conv.isTaskGroup || conv.is_task_group);
  }, [conversations, hasConversationsFetchedSinceMount]);

  // Fetch conversation details for each task group to get taskId (from task details page)
  const detailsResults = useQueries(
    taskGroups.map((conv) => ({
      queryKey: ['conversation-details', conv.id || conv.conversationId],
      queryFn: () => conversationService.getConversationDetails(conv.id || conv.conversationId),
      enabled: !!(conv.id || conv.conversationId),
    }))
  );

  // Build convId -> taskId from details
  const taskIdByConvId = useMemo(() => {
    const map: Record<string, string> = {};
    taskGroups.forEach((conv, i) => {
      const convId = conv.id || conv.conversationId;
      const details = detailsResults[i]?.data as any;
      const taskId = details?.taskId || details?.task_id;
      if (convId && taskId) map[convId] = taskId;
    });
    return map;
  }, [taskGroups, detailsResults]);

  // Fetch full task rows for both task-group cards and direct task cards so
  // fields like Excel-uploaded `task_unit` are available everywhere.
  const taskDetailIds = useMemo(() => {
    const conversationTaskIds = Object.values(taskIdByConvId).filter(Boolean).map(String);
    const directTaskIds = (Array.isArray(directTasks) ? directTasks : [])
      .map((task: any) => String(task?.id || '').trim())
      .filter(Boolean);
    return [...new Set([...conversationTaskIds, ...directTaskIds])];
  }, [taskIdByConvId, directTasks]);

  // Fetch task details for each task (status comes from task details). Do not retry 404 (deleted task).
  const taskDetailsQueries = useQueries(
    taskDetailIds.map((taskId) => ({
      queryKey: ['task', taskId],
      queryFn: () => taskService.getTask(taskId),
      enabled: !!taskId,
      retry: (failureCount: number, error: any) => {
        const status = error?.response?.status;
        if (status === 404) return false;
        return failureCount < 2;
      },
    }))
  );

  // Loading flags to control initial UI and prevent flicker.
  // Require "fetched since mount" so we never render stale cache on first paint (React Query can return cache before refetch starts).
  const isTaskDetailsLoading = taskDetailsQueries.some((q) => q.isLoading);
  const isTaskDetailsFetching = taskDetailsQueries.some((q) => q.isFetching);
  const isConversationDetailsLoading = detailsResults.some((q) => q.isLoading);
  const isConversationDetailsFetching = detailsResults.some((q) => q.isFetching);
  const isTaskGroupsLoading =
    !hasConversationsFetchedSinceMount ||
    (isConversationsLoading || isConversationsFetching) ||
    (isConversationDetailsLoading || isConversationDetailsFetching) ||
    (isTaskDetailsLoading || isTaskDetailsFetching);
  const isPendingTasksLoading =
    !hasTasksFetchedSinceMount || isDirectTasksLoading || isDirectTasksFetching;

  // Map convId -> task (from task details). Use string keys so lookups work whether conv.id is number or string.
  const taskByConvId = useMemo(() => {
    const taskByTaskId: Record<string, any> = {};
    taskDetailIds.forEach((taskId, i) => {
      const data = taskDetailsQueries[i]?.data;
      if (data) taskByTaskId[String(taskId)] = data;
    });
    const map: Record<string, any> = {};
    Object.entries(taskIdByConvId).forEach(([convId, taskId]) => {
      if (taskByTaskId[String(taskId)]) map[String(convId)] = taskByTaskId[String(taskId)];
    });
    return map;
  }, [taskIdByConvId, taskDetailIds, taskDetailsQueries]);

  useEffect(() => {
    taskIdByConvIdRef.current = taskIdByConvId;
  }, [taskIdByConvId]);

  useEffect(() => {
    taskByConvIdRef.current = taskByConvId;
  }, [taskByConvId]);

  const taskDetailsById = useMemo(() => {
    const map: Record<string, any> = {};
    taskDetailIds.forEach((taskId, i) => {
      const data = taskDetailsQueries[i]?.data;
      if (data) map[String(taskId)] = data;
    });
    return map;
  }, [taskDetailIds, taskDetailsQueries]);

  const mergeTaskWithDetails = (task: any) => {
    if (!task?.id) return task;
    const details = taskDetailsById[String(task.id)];
    if (!details) return task;
    return {
      ...task,
      ...details,
      id: task.id || details.id,
      conversation_id: task.conversation_id || details.conversation_id || details.conversationId,
      conversationId: task.conversationId || details.conversationId || details.conversation_id,
    };
  };

  const getTaskAssigneeEntries = (task: any) => {
    if (!task) return [] as Array<{ id: string; name: string }>;
    const assignees = Array.isArray(task.assignees) ? task.assignees : [];
    return assignees
      .map((a: any) => ({
        id: String(a?.id || a?.user_id || a?.userId || '').trim(),
        name: String(a?.name || a?.user_name || a?.username || '').trim(),
      }))
      .filter((a: { id: string; name: string }) => !!a.id);
  };

  const teamMemberOptions = useMemo(() => {
    const currentUserId = String(user?.id || (user as any)?.userId || '');
    const optionsMap = new Map<string, { id: string; name: string }>();
    const allTasks = [
      ...(Object.values(taskByConvId || {}) as any[]),
      ...(Array.isArray(directTasks) ? directTasks.map(mergeTaskWithDetails) : []),
    ];

    allTasks.forEach((task: any) => {
      getTaskAssigneeEntries(task).forEach((a) => {
        if (!a.id || a.id === currentUserId) return;
        if (!optionsMap.has(a.id)) {
          optionsMap.set(a.id, { id: a.id, name: a.name || 'Unknown Member' });
        }
      });
    });

    const search = teamMemberSearch.trim().toLowerCase();
    const rows = Array.from(optionsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (!search) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(search));
  }, [taskByConvId, directTasks, user, teamMemberSearch]);

  const taskMatchesSelectedMembers = (task: any) => {
    if (selectedTeamMemberIds.length === 0) return true;
    const memberIds = new Set(getTaskAssigneeEntries(task).map((a) => a.id));
    return selectedTeamMemberIds.some((id) => memberIds.has(id));
  };

  // Get task IDs that already have conversations
  const tasksWithConversations = useMemo(() => {
    return new Set(Object.values(taskIdByConvId).filter(Boolean));
  }, [taskIdByConvId]);

    // Get tasks without conversations (newly assigned tasks)
  const tasksWithoutConversations = useMemo(() => {
    if (!hasTasksFetchedSinceMount) return [];
    if (!Array.isArray(directTasks)) return [];
    const currentUserId = user?.id || (user as any)?.userId;
    let filtered = directTasks.map(mergeTaskWithDetails).filter((task: any) => {
      if (!task?.id) return false;
      // Skip if task already has a conversation
      if (tasksWithConversations.has(task.id)) return false;
      // Skip deleted tasks
      if (isTaskDeleted(task)) return false;
      // Only show tasks where current user is an assignee
      const assignees = Array.isArray(task.assignees) ? task.assignees : [];
      const isAssigned = assignees.some((a: any) => {
        const assigneeId = a.id || a.user_id || a.userId;
        return assigneeId === currentUserId;
      });
      // Also check current_user_status
      const hasCurrentUserStatus = task.current_user_status != null;
      return isAssigned || hasCurrentUserStatus;
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((task: any) => {
        const titleMatch = task.title?.toLowerCase().includes(query);
        const clientMatch = task.client_name?.toLowerCase().includes(query);
        const descMatch = task.description?.toLowerCase().includes(query);
        const tags = Array.isArray(task?.tags)
          ? task.tags.join(' ').toLowerCase()
          : typeof task?.tags === 'string'
          ? task.tags.toLowerCase()
          : '';
        const tagMatch = tags.includes(query);
        return titleMatch || clientMatch || descMatch || tagMatch;
      });
    }

    // Assigned view: filter by selected team members (multi-select).
    if (viewFilter === 'assigned' && selectedTeamMemberIds.length > 0) {
      filtered = filtered.filter((task: any) => taskMatchesSelectedMembers(task));
    }

    const activityBumpMap = activityBumpRef.current;

    // Status filter: always use per-user lifecycle categorization (same as Task Details).
    // Recently active tasks stay visible briefly when status changes (e.g. todo → in progress).
    if (statusFilter !== 'all') {
      filtered = filtered.filter((task: any) => {
        const category = getTaskStatusForFilter(task);
        if (category !== statusFilter && !isTaskRecentlyActiveForFilter(activityBumpMap, task?.id)) {
          return false;
        }
        if (dashboardTaskIdsForView && dashboardTaskIdsForView.size > 0) {
          if (task?.id && dashboardTaskIdsForView.has(String(task.id))) return true;
          return isTaskRecentlyActiveForFilter(activityBumpMap, task?.id);
        }
        return true;
      });
    } else if (dashboardTaskIdsForView && dashboardTaskIdsForView.size > 0) {
      filtered = filtered.filter((task: any) => {
        if (task?.id && dashboardTaskIdsForView.has(String(task.id))) return true;
        return isTaskRecentlyActiveForFilter(activityBumpMap, task?.id);
      });
    }

    return filtered;
  }, [
    directTasks,
    tasksWithConversations,
    user,
    searchQuery,
    statusFilter,
    hasTasksFetchedSinceMount,
    viewFilter,
    selectedTeamMemberIds,
    activityBumpTick,
    dashboardTaskIdsForView,
  ]);

  // Task IDs that failed to load (e.g. 404 = deleted) — exclude those convs from list
  const failedTaskIds = useMemo(
    () => new Set(
      taskDetailIds.filter((_, i) => taskDetailsQueries[i]?.isError === true)
    ),
    [taskDetailIds, taskDetailsQueries]
  );

  // Filter task groups by search and by status (using task details). Hide deleted tasks and convs whose task no longer exists (404).
  // Guard: do not run until a fetch has completed since mount and all dependent queries are done; avoids stale cache on reload.
  const filteredTaskGroups = useMemo(() => {
    if (
      !hasConversationsFetchedSinceMount ||
      isConversationsLoading ||
      isConversationsFetching ||
      isConversationDetailsLoading ||
      isConversationDetailsFetching ||
      isTaskDetailsLoading ||
      isTaskDetailsFetching
    ) {
      return [];
    }
      let filtered = taskGroups.filter(conv => {
      const convId = conv.id ?? conv.conversationId;
      const key = convId != null ? String(convId) : '';
      const taskId = key ? taskIdByConvId[key] : undefined;
      if (taskId && failedTaskIds.has(taskId)) return false;
      const task = key ? taskByConvId[key] : undefined;
      if (task && isTaskDeleted(task)) return false;

      const activityBumpMap = activityBumpRef.current;

      // Align with dashboard metric selection (Self / Assigned + status),
      // but keep recently active tasks visible when filters would hide them.
      if (dashboardTaskIdsForView && dashboardTaskIdsForView.size > 0) {
        const inView =
          !!(task?.id && dashboardTaskIdsForView.has(String(task.id))) ||
          isTaskRecentlyActiveForFilter(activityBumpMap, task?.id);
        if (!inView) return false;
        if (statusFilter !== 'all') {
          const category = getTaskStatusForFilter(task);
          return (
            category === statusFilter ||
            isTaskRecentlyActiveForFilter(activityBumpMap, task?.id)
          );
        }
        return true;
      }

      return true;
    });

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => {
        const nameMatch = conv.name?.toLowerCase().includes(query);
        const lastMessageMatch = conv.lastMessage?.content?.toLowerCase().includes(query);
        const memberMatch = conv.otherMembers?.some(member =>
          member.name?.toLowerCase().includes(query)
        );
        const convId = conv.id ?? conv.conversationId;
        const key = convId != null ? String(convId) : '';
        const task = key ? taskByConvId[key] : undefined;
        const taskTitleMatch = task?.title?.toLowerCase().includes(query);
        const taskClientMatch = task?.client_name?.toLowerCase().includes(query);
        return nameMatch || lastMessageMatch || memberMatch || taskTitleMatch || taskClientMatch;
      });
    }

    // Assigned view: filter by selected team members (multi-select).
    if (viewFilter === 'assigned' && selectedTeamMemberIds.length > 0) {
      filtered = filtered.filter((conv: any) => {
        const convId = conv.id ?? conv.conversationId;
        const key = convId != null ? String(convId) : '';
        const task = key ? taskByConvId[key] : undefined;
        return taskMatchesSelectedMembers(task);
      });
    }

    // When not driven by a dashboard metric, apply local status categorization
    const activityBumpMap = activityBumpRef.current;
    if (!dashboardTaskIdsForView || dashboardTaskIdsForView.size === 0) {
      if (statusFilter !== 'all') {
        filtered = filtered.filter(conv => {
          const convId = conv.id ?? conv.conversationId;
          const key = convId != null ? String(convId) : '';
          const task = key ? taskByConvId[key] : undefined;
          const category = getTaskStatusForFilter(task);
          return (
            category === statusFilter ||
            isTaskRecentlyActiveForFilter(activityBumpMap, task?.id)
          );
        });
      }
    }

    return sortConversationsByRecentActivity(filtered, taskByConvId, activityBumpMap);
  }, [
    taskGroups,
    searchQuery,
    statusFilter,
    taskByConvId,
    taskIdByConvId,
    failedTaskIds,
    dashboardTaskIdsForView,
    hasConversationsFetchedSinceMount,
    isConversationsLoading,
    isConversationsFetching,
    isConversationDetailsLoading,
    isConversationDetailsFetching,
    isTaskDetailsLoading,
    isTaskDetailsFetching,
    viewFilter,
    selectedTeamMemberIds,
    activityBumpTick,
  ]);

  const unreadCountByConversationId = useMemo(() => {
    const map: Record<string, number> = {};
    (conversations || []).forEach((conv: any) => {
      const convId = normalizeConvId(conv?.id ?? conv?.conversationId);
      if (!convId) return;
      map[convId] = Number(conv?.unreadCount ?? conv?.unread_count ?? 0) || 0;
    });
    return map;
  }, [conversations]);

  const getTaskCardUnreadCount = useCallback(
    (convId: string | number | null | undefined) => {
      const key = normalizeConvId(convId);
      if (!key) return 0;
      return taskChatUnreadByConvId[key] ?? unreadCountByConversationId[key] ?? 0;
    },
    [taskChatUnreadByConvId, unreadCountByConversationId]
  );

  const sortedTaskCardEntries = useMemo(() => {
    const entries: TaskDashboardCardEntry[] = [];

    filteredTaskGroups.forEach((conv: any) => {
      const convId = conv.id ?? conv.conversationId ?? '';
      const key = convId != null ? String(convId) : '';
      entries.push({
        kind: 'group',
        conv,
        task: key ? taskByConvId[key] : undefined,
      });
    });

    tasksWithoutConversations.forEach((task: any) => {
      entries.push({ kind: 'direct', task });
    });

    return sortTaskDashboardCards(entries, activityBumpRef.current);
  }, [filteredTaskGroups, tasksWithoutConversations, taskByConvId, activityBumpTick]);

  const currentUserId = user?.id || (user as any)?.userId;

  const canBulkSelectTask = useCallback(
    (task: any): boolean => {
      if (!task?.id || isTaskDeleted(task)) return false;
      const creatorId = task.created_by || task.creator_id;
      if (creatorId != null && String(creatorId) === String(currentUserId)) return true;
      if (task.current_user_status != null) return true;
      const assignees = Array.isArray(task.assignees) ? task.assignees : [];
      return assignees.some((a: any) => {
        const id = a?.id || a?.user_id || a?.userId;
        return id != null && String(id) === String(currentUserId);
      });
    },
    [currentUserId]
  );

  const selectableTaskEntries = useMemo(() => {
    const entries: { taskId: string; title: string }[] = [];
    const seen = new Set<string>();
    filteredTaskGroups.forEach((conv: any) => {
      const convId = conv.id ?? conv.conversationId;
      const key = convId != null ? String(convId) : '';
      const task = key ? taskByConvId[key] : undefined;
      if (task?.id && canBulkSelectTask(task) && !seen.has(String(task.id))) {
        seen.add(String(task.id));
        entries.push({
          taskId: String(task.id),
          title: task.title || conv.name || 'Task',
        });
      }
    });
    tasksWithoutConversations.forEach((task: any) => {
      if (task?.id && canBulkSelectTask(task) && !seen.has(String(task.id))) {
        seen.add(String(task.id));
        entries.push({ taskId: String(task.id), title: task.title || 'Untitled Task' });
      }
    });
    return entries;
  }, [filteredTaskGroups, tasksWithoutConversations, taskByConvId, canBulkSelectTask]);

  const allDashboardTasksById = useMemo(() => {
    const map = new Map<string, any>();
    Object.values(taskByConvId || {}).forEach((task: any) => {
      if (task?.id) map.set(String(task.id), task);
    });
    tasksWithoutConversations.forEach((task: any) => {
      if (task?.id) map.set(String(task.id), task);
    });
    return map;
  }, [taskByConvId, tasksWithoutConversations]);

  const selectedTasksForBulk = useMemo(
    () =>
      Array.from(selectedTaskIds)
        .map((taskId) => allDashboardTasksById.get(String(taskId)))
        .filter(Boolean),
    [selectedTaskIds, allDashboardTasksById]
  );

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const exitBulkSelectMode = () => {
    setBulkSelectMode(false);
    setSelectedTaskIds(new Set());
    setShowBulkAssignModal(false);
  };

  const invalidateAfterBulkAction = () => {
    Array.from(selectedTaskIds).forEach((taskId) => recordTaskActivity({ taskId }));
    exitBulkSelectMode();
    queryClient.invalidateQueries(['conversations', 'task']);
    queryClient.invalidateQueries('tasks');
    queryClient.invalidateQueries(['task-dashboard-data']);
    queryClient.invalidateQueries('dashboard');
    queryClient.invalidateQueries(['admin-dashboard']);
    queryClient.invalidateQueries(['dashboard-statistics']);
    queryClient.invalidateQueries(['admin-dashboard-statistics']);
  };

  const selectAllVisibleTasks = () => {
    setSelectedTaskIds(new Set(selectableTaskEntries.map((e) => e.taskId)));
  };

  // Update conversation with new message (matching mobile pattern)
  const updateConversationWithNewMessage = (message: any) => {
    if (!message.conversation_id || !message.id) {
      console.warn('⚠️ Invalid message received, skipping:', message);
      return;
    }

    queryClient.setQueryData(['conversations', 'task'], (oldData: any[] = []) => {
      const conversationId = message.conversation_id;
      const conversationIndex = oldData.findIndex(
        (conv: any) =>
          String(conv.id || conv.conversationId) === String(conversationId)
      );

      if (conversationIndex === -1) {
        // Conversation not found, refetch to get it
        queryClient.invalidateQueries(['conversations', 'task']);
        return oldData;
      }

      const updated = [...oldData];
      const conversation = { ...updated[conversationIndex] };

      // Update last message
      conversation.lastMessage = {
        id: message.id,
        content: message.content,
        sender_id: message.sender_id || message.senderId,
        sender_name: message.sender_name || message.senderName,
        message_type: message.message_type || message.messageType,
        created_at: message.created_at || message.createdAt,
        status: message.status,
      };
      conversation.last_message = conversation.lastMessage;
      conversation.lastMessageTime = message.created_at || message.createdAt;
      conversation.last_message_time = conversation.lastMessageTime;

      // Increment unread count if message is from another user
      const currentUserId = user?.id;
      const isMyMessage = (message.sender_id || message.senderId) === currentUserId;
      if (!isMyMessage) {
        conversation.unreadCount = (conversation.unreadCount || conversation.unread_count || 0) + 1;
        conversation.unread_count = conversation.unreadCount;
      }

      updated[conversationIndex] = conversation;

      const messageTime = message.created_at || message.createdAt;
      const atMs = timestampToMs(messageTime, Date.now());
      let linkedTaskId: string | undefined;
      for (const [cid, tid] of Object.entries(taskIdByConvIdRef.current)) {
        if (String(cid) === String(conversationId)) {
          linkedTaskId = tid;
          break;
        }
      }
      bumpTaskDashboardActivity(activityBumpRef.current, {
        conversationId: String(conversationId),
        taskId: linkedTaskId,
        atMs,
      });
      setActivityBumpTick((n) => n + 1);

      return sortConversationsByRecentActivity(
        updated,
        taskByConvIdRef.current,
        activityBumpRef.current
      );
    });
  };

  // Setup socket listeners for real-time updates
  useEffect(() => {
    let isMounted = true;

    const setupSocketListeners = async () => {
      try {
        const socket = await waitForSocketConnection();
        if (!isMounted) return;
        
        console.log('✅ Socket connected in TaskDashboardScreen');
        
        const handleNewMessage = (message: any) => {
          console.log('📨 New message received in TaskDashboardScreen:', {
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            userId: user?.id,
          });
          
          if (!message.conversation_id || !message.id) {
            console.warn('⚠️ Invalid message received, skipping:', message);
            return;
          }
          
          updateConversationWithNewMessage(message);
        };

        const handleMessageStatusUpdate = (update: any) => {
          console.log('📊 Message status update in TaskDashboardScreen:', update);
          
          if (update.conversationId && update.messageId) {
            queryClient.setQueryData(['conversations', 'task'], (oldData: any[] = []) => {
              const updated = oldData.map((conv: any) => {
                if ((conv.id || conv.conversationId) === update.conversationId) {
                  const lastMsg = conv.lastMessage || conv.last_message;
                  if (lastMsg && typeof lastMsg === 'object' && lastMsg.id === update.messageId) {
                    return {
                      ...conv,
                      lastMessage: {
                        ...lastMsg,
                        status: update.status,
                      },
                      last_message: {
                        ...lastMsg,
                        status: update.status,
                      },
                    };
                  }
                }
                return conv;
              });
              
              return sortConversationsByRecentActivity(
                updated,
                taskByConvIdRef.current,
                activityBumpRef.current
              );
            });
          }
        };

        const handleConversationMessagesRead = (data: any) => {
          console.log('Conversation messages read:', data);
          const readerId = data?.userId ?? data?.readByUserId;
          const currentUserId = user?.id ?? user?.userId;
          if (!readerId || String(readerId) !== String(currentUserId)) return;
          if (data.conversationId) {
            clearConversationUnread(String(data.conversationId));
            queryClient.setQueryData(['conversations', 'task'], (oldData: any[] = []) => {
              const updated = oldData.map((conv: any) => {
                if (String(conv.id || conv.conversationId) === String(data.conversationId)) {
                  return {
                    ...conv,
                    unreadCount: 0,
                    unread_count: 0,
                  };
                }
                return conv;
              });

              return sortConversationsByRecentActivity(
                updated,
                taskByConvIdRef.current,
                activityBumpRef.current
              );
            });
          }
        };
        const handleTaskStatusChanged = (data: any) => {
          const taskId = data?.taskId;
          const atMs = timestampToMs(data?.computedAt, Date.now());
          if (taskId) {
            let linkedConvId: string | undefined;
            for (const [cid, tid] of Object.entries(taskIdByConvIdRef.current)) {
              if (String(tid) === String(taskId)) {
                linkedConvId = cid;
                break;
              }
            }
            recordTaskActivity({ taskId: String(taskId), conversationId: linkedConvId, atMs });
            const iso = new Date(atMs).toISOString();
            queryClient.setQueryData(['task', String(taskId)], (old: any) =>
              old ? { ...old, updated_at: iso, updatedAt: iso } : old
            );
            queryClient.setQueryData(['conversations', 'task'], (oldData: any[] = []) => {
              const updated = oldData.map((conv: any) => {
                const convId = String(conv.id || conv.conversationId || '');
                if (linkedConvId && convId === String(linkedConvId)) {
                  return {
                    ...conv,
                    lastMessageTime: iso,
                    last_message_time: iso,
                  };
                }
                return conv;
              });
              return sortConversationsByRecentActivity(
                updated,
                taskByConvIdRef.current,
                activityBumpRef.current
              );
            });
          }
          queryClient.invalidateQueries('tasks');
          queryClient.invalidateQueries(['task']);
          queryClient.invalidateQueries('dashboard-data');
        };

        socket.on('new_message', handleNewMessage);
        socket.on('message_status_update', handleMessageStatusUpdate);
        socket.on('conversation_messages_read', handleConversationMessagesRead);
        const handleAssigneesAdded = (data: any) => {
          recordTaskActivity({
            taskId: data?.taskId,
            conversationId: data?.conversationId,
          });
          queryClient.invalidateQueries(['conversations', 'task']);
          queryClient.invalidateQueries('tasks');
        };

        socket.on('task:status_changed', handleTaskStatusChanged);
        socket.on('task:recurrence_created', handleTaskStatusChanged);
        socket.on('task:assignees_added', handleAssigneesAdded);

        socketRef.current = socket;

        return () => {
          socket.off('new_message', handleNewMessage);
          socket.off('message_status_update', handleMessageStatusUpdate);
          socket.off('conversation_messages_read', handleConversationMessagesRead);
          socket.off('task:status_changed', handleTaskStatusChanged);
          socket.off('task:recurrence_created', handleTaskStatusChanged);
          socket.off('task:assignees_added', handleAssigneesAdded);
        };
      } catch (error) {
        console.error('Socket setup error:', error);
      }
    };

    setupSocketListeners();

    return () => {
      isMounted = false;
    };
  }, [queryClient, user, clearConversationUnread, recordTaskActivity]);

  const setStatusFilterAndUrl = (filter: StatusFilter) => {
    setStatusFilter(filter);
    const params: Record<string, string> = {};
    if (filter !== 'all') {
      params.status = filter;
    }
    if (viewFilter !== 'all') {
      params.view = viewFilter;
    }
    setSearchParams(params);
  };

  const handleDownloadTaskTemplate = async () => {
    setIsDownloadingTaskTemplate(true);
    try {
      await taskBulkService.getTemplate();
      toast.success('Task template downloaded. Fill it and upload to bulk create tasks.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to download template');
    } finally {
      setIsDownloadingTaskTemplate(false);
    }
  };

  const taskBulkUploadMutation = useMutation(
    (file: File) => taskBulkService.uploadFile(file),
    {
      onSuccess: async (res) => {
        const data = res.data?.data;
        // If backend returns validationErrors, surface them immediately (mapping/format issues).
        if (data?.validationErrors && Array.isArray(data.validationErrors) && data.validationErrors.length > 0) {
          data.validationErrors.slice(0, 8).forEach((e: any) => {
            const msg = e?.message || 'Validation error';
            toast.error(msg);
          });
          if (data.validationErrors.length > 8) {
            toast.error(`… and ${data.validationErrors.length - 8} more validation error(s)`);
          }
        }

        if (!data?.uploadId) {
          toast.error('Upload was rejected. Please fix the template errors and re-upload.');
          if (bulkTaskFileInputRef.current) bulkTaskFileInputRef.current.value = '';
          setIsBulkUploadingTasks(false);
          return;
        }
        try {
          const status = await taskBulkService.pollUntilDone(data.uploadId);
          if (status.status === 'completed') {
            toast.success(`Processed ${status.processedCount} of ${status.totalRows} task(s).`);
          }
          if (status.failedCount > 0) {
            toast.info(`${status.failedCount} row(s) failed.`);
          }
          if (status.errors?.length) {
            status.errors.slice(0, 5).forEach((e: { rowIndex: number; message: string }) =>
              toast.error(e.message || `Row ${e.rowIndex}`)
            );
            if (status.errors.length > 5) {
              toast.error(`… and ${status.errors.length - 5} more errors`);
            }
          }
        } catch (err: any) {
          toast.error(err?.message || 'Failed to get upload status');
        }
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['conversations', 'task']);
        if (bulkTaskFileInputRef.current) bulkTaskFileInputRef.current.value = '';
        setIsBulkUploadingTasks(false);
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Upload failed');
        setIsBulkUploadingTasks(false);
      },
    }
  );

  const handleBulkTaskFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      toast.error('Please select an Excel file (.xlsx or .xls)');
      e.target.value = '';
      return;
    }
    setIsBulkUploadingTasks(true);
    taskBulkUploadMutation.mutate(file);
  };

  // Task group list content (left sidebar)
  const taskGroupListContent = (
    <div className="flex flex-col h-full min-h-0 bg-background-light dark:bg-background-dark">
      {/* Header with Filters */}
      <div className="shrink-0 p-2.5 pb-2 border-b border-border-light dark:border-border-dark bg-white dark:bg-surface-dark/50 backdrop-blur-sm z-10">
        {/* Row 1: Tasks heading + search */}
        <div className="flex items-center gap-2 mb-2">
          <h1 className="shrink-0 text-base font-bold tracking-tight text-gray-900 dark:text-white">Tasks</h1>
          <div className="relative z-30 min-w-0 flex-1" ref={suggestionsRef}>
            <div
              className={`relative flex items-center rounded-xl border bg-white dark:bg-surface-dark transition-all duration-200 ${
                showSuggestions && suggestions.length > 0
                  ? 'border-primary/40 shadow-md shadow-primary/5 dark:shadow-primary/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
              }`}
            >
              <span className="absolute left-3 flex items-center text-gray-400 dark:text-gray-500 pointer-events-none">
                <span className="material-icons-outlined text-lg">search</span>
              </span>
              <input
                ref={searchInputRef}
                className="w-full pl-9 pr-8 py-2 bg-transparent border-0 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 focus:outline-none rounded-xl"
                placeholder="Search tasks (e.g. G, GS for GSTR 1, GSTR 9…)"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (!showSuggestions || suggestions.length === 0) {
                    if (e.key === 'Escape') setShowSuggestions(false);
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const item = suggestions[highlightedIndex >= 0 ? highlightedIndex : 0];
                    if (item?.title) {
                      setSearchQuery(item.title);
                      setShowSuggestions(false);
                      setHighlightedIndex(-1);
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false);
                    setHighlightedIndex(-1);
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSuggestions(false);
                    setHighlightedIndex(-1);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                  aria-label="Clear search"
                >
                  <span className="material-icons-outlined text-base">close</span>
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-primary/40 bg-white shadow-lg shadow-primary/5 dark:border-gray-600 dark:bg-surface-dark dark:shadow-primary/10">
                <div className="max-h-60 overflow-y-auto py-1">
                  {suggestions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSearchQuery(item.title || '');
                        setShowSuggestions(false);
                        setHighlightedIndex(-1);
                        searchInputRef.current?.focus();
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                        index === highlightedIndex
                          ? 'bg-gray-100 dark:bg-gray-700/80 text-gray-900 dark:text-white'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <span className="material-icons-outlined text-[22px] text-gray-400 dark:text-gray-500 shrink-0">
                        {item.type === 'client' ? 'business' : item.type === 'tag' ? 'sell' : 'assignment'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium truncate block">
                          {item.title}
                        </span>
                        {item.type === 'client' && item.code && (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate block">
                            Client • {item.code}
                          </span>
                        )}
                        {item.type === 'service' && item.frequency && (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate block">
                            Service • {item.frequency}
                          </span>
                        )}
                        {item.type === 'tag' && (
                          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate block">
                            Tag
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {viewFilter === 'assigned' && (
          <div className="mb-2.5 relative" ref={teamMemberFilterRef}>
            <button
              type="button"
              onClick={() => setShowTeamMemberFilter((prev) => !prev)}
              className="w-full flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark px-3 py-2 text-xs text-left text-gray-800 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
            >
              <span className="truncate">
                {selectedTeamMemberIds.length > 0
                  ? `Team Members (${selectedTeamMemberIds.length}) selected`
                  : 'Filter by Team Members'}
              </span>
              <span className="material-icons-outlined text-base text-gray-500">
                {showTeamMemberFilter ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {showTeamMemberFilter && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark shadow-lg">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <input
                    type="text"
                    value={teamMemberSearch}
                    onChange={(e) => setTeamMemberSearch(e.target.value)}
                    placeholder="Search team member..."
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto p-1.5 space-y-1">
                  {teamMemberOptions.length > 0 ? (
                    teamMemberOptions.map((member) => {
                      const checked = selectedTeamMemberIds.includes(member.id);
                      return (
                        <label
                          key={member.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedTeamMemberIds((prev) =>
                                prev.includes(member.id)
                                  ? prev.filter((id) => id !== member.id)
                                  : [...prev, member.id]
                              );
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-xs text-gray-800 dark:text-gray-200 truncate">{member.name}</span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">No team members found</div>
                  )}
                </div>
                <div className="flex items-center justify-between px-2.5 py-2 border-t border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeamMemberIds([]);
                      setTeamMemberSearch('');
                    }}
                    className="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTeamMemberFilter(false)}
                    className="text-[11px] font-medium text-primary hover:text-primary/80"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Row 2: All | Self | Assigned */}
        <div className="flex items-center justify-center gap-1 mb-2">
          {([
            { key: 'all', label: 'All' },
            { key: 'self', label: 'Self Tasks' },
            { key: 'assigned', label: 'Assigned Tasks' },
          ] as const).map(({ key, label }) => {
            const isActive = viewFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setViewFilter(key as ViewFilter);
                }}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all duration-200 ${
                  isActive
                    ? 'bg-slate-700 text-white border-slate-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Row 3: Status filters with scroll arrows */}
        <FilterChipScrollRow>
              {([
                { key: 'all', label: 'All', color: 'gray' },
                { key: 'scheduled', label: 'Scheduled', color: 'indigo' },
                { key: 'todo', label: 'To Do', color: 'blue' },
                { key: 'inprogress', label: 'In Progress', color: 'purple' },
                { key: 'duesoon', label: 'Due Soon', color: 'orange' },
                { key: 'overdue', label: 'Overdue', color: 'red' },
                { key: 'completed', label: 'Completed', color: 'green' },
              ] as const).map(({ key, label, color }) => {
                const isActive = statusFilter === key;
                const colorClasses = {
                  gray: isActive ? 'bg-gray-600 text-white border-gray-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
                  blue: isActive ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/30' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                  indigo: isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/30' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
                  purple: isActive ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/30' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                  orange: isActive ? 'bg-orange-600 text-white border-orange-600 shadow-orange-500/30' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
                  red: isActive ? 'bg-red-600 text-white border-red-600 shadow-red-500/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                  green: isActive ? 'bg-green-600 text-white border-green-600 shadow-green-500/30' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
                };

                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilterAndUrl(key as StatusFilter)}
                    className={`shrink-0 flex items-center px-2 py-1 rounded-full text-[9px] font-semibold border transition-all duration-200 hover:scale-105 active:scale-95 ${
                      isActive
                        ? `${colorClasses[color]} shadow-lg`
                        : `${colorClasses[color]} hover:shadow-md`
                    }`}
                  >
                    <span>{label}</span>
                  </button>
                );
              })}
        </FilterChipScrollRow>

        {bulkSelectMode && (
          <div className="mt-2.5 mb-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
              {selectedTaskIds.size} of {selectableTaskEntries.length} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAllVisibleTasks}
                disabled={selectableTaskEntries.length === 0}
                className="min-h-[32px] px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 disabled:opacity-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedTaskIds(new Set())}
                className="min-h-[32px] px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-slate-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100"
              >
                Clear
              </button>
              <div className="ml-auto">
                <BulkTaskActionsMenu
                  selectedTasks={selectedTasksForBulk}
                  currentUserId={String(currentUserId || '')}
                  userRole={user?.role}
                  dueSoonDays={tasksDueSoonDays}
                  disabled={selectedTaskIds.size === 0}
                  onAddMembers={() => setShowBulkAssignModal(true)}
                  onActionComplete={invalidateAfterBulkAction}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Upload Tasks - Admin/Super Admin only */}
      {isAdminOrSuperAdmin && enableBulkUploadUI && (
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <span className="material-icons-outlined text-primary text-lg">upload_file</span>
              Bulk create tasks
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadTaskTemplate}
                disabled={isDownloadingTaskTemplate}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-icons-outlined text-base">download</span>
                {isDownloadingTaskTemplate ? 'Downloading...' : 'Download template'}
              </button>
              <input
                ref={bulkTaskFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleBulkTaskFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => bulkTaskFileInputRef.current?.click()}
                disabled={isBulkUploadingTasks}
                className="px-3 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
              >
                <span className="material-icons-outlined text-base">upload</span>
                {isBulkUploadingTasks ? 'Uploading...' : 'Upload file'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pt-2 pb-2 space-y-2">
        {/* Loading state to avoid flicker / incorrect default actions */}
        {isTaskGroupsLoading && (
          <div>
            <h3 className="flex items-center text-[11px] font-bold text-primary uppercase tracking-wider mb-2 px-1">
              <span className="material-icons-round text-sm mr-1">groups</span>
              Tasks
            </h3>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark animate-pulse flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-2 w-1/2 rounded bg-gray-100 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isTaskGroupsLoading && !isPendingTasksLoading && sortedTaskCardEntries.length > 0 ? (
          <div>
            <div className="flex items-center justify-between gap-2 mt-2 mb-2 px-1">
              <h3 className="flex items-center min-w-0 text-[11px] font-bold text-primary uppercase tracking-wider">
                <span className="material-icons-round text-sm mr-1">groups</span>
                Tasks ({sortedTaskCardEntries.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (bulkSelectMode) exitBulkSelectMode();
                  else setBulkSelectMode(true);
                }}
                className={`shrink-0 h-7 px-2 rounded-lg flex items-center gap-1 text-[10px] font-semibold border transition-colors ${
                  bulkSelectMode
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                title={bulkSelectMode ? 'Cancel selection' : 'Select tasks to assign users'}
              >
                <span className="material-icons-outlined text-base">
                  {bulkSelectMode ? 'close' : 'checklist'}
                </span>
                {bulkSelectMode ? 'Cancel' : 'Select'}
              </button>
            </div>
            <div className="space-y-1">
              {sortedTaskCardEntries.map((entry) => {
                if (entry.kind === 'group') {
                  const conv = entry.conv;
                  const convId = conv.id ?? conv.conversationId ?? '';
                  const convName = conv.name || 'Task Group';
                  const task = entry.task ?? (convId ? taskByConvId[String(convId)] : undefined);
                  const taskStatusCategory = getTaskStatusForFilter(task);
                  const displayTaskTitle = resolveTaskTitleWithPeriod(task, convName);
                  const taskTagOrClient = resolveTaskTagOrClient(task);
                  const taskDueLabel = resolveTaskDueDateLabel(task);
                  const taskFrequencyLabel = resolveTaskFrequencyLabel(task);
                  const taskUnitLabel = resolveTaskUnitDisplay(task);
                  const { owner: taskOwner, assignees: taskAssignees } = resolveTaskCardMembers(task);
                  const isSelected = selectedConversationId === convId;
                  const taskIdStr = task?.id ? String(task.id) : '';
                  const bulkEligible = taskIdStr && canBulkSelectTask(task);
                  const taskChecked = bulkSelectMode && taskIdStr && selectedTaskIds.has(taskIdStr);
                  const taskUnreadCount = getTaskCardUnreadCount(convId);

                  return (
                    <div
                      key={`group-${convId}`}
                      className={`group relative h-fit rounded-xl border p-2.5 transition-colors duration-200 cursor-pointer hover:bg-white dark:hover:bg-surface-dark hover:shadow-sm ${
                        taskChecked
                          ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
                          : isSelected
                          ? 'bg-primary/10 dark:bg-primary/20 border-primary shadow-md'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => {
                        if (bulkSelectMode && bulkEligible && taskIdStr) {
                          toggleTaskSelection(taskIdStr);
                          return;
                        }
                        navigate(isAdmin ? `/admin/tasks/task-group/${convId}` : `/tasks/task-group/${convId}`);
                      }}
                    >
                      {taskCardDisplay.unreadBadge ? <TaskDashboardUnreadBadge count={taskUnreadCount} /> : null}
                      <div className="flex items-start gap-3">
                        {bulkSelectMode && bulkEligible ? (
                          <input
                            type="checkbox"
                            checked={!!taskChecked}
                            readOnly
                            className="mt-4 shrink-0 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary pointer-events-none"
                          />
                        ) : null}
                        <div className="flex-1 min-w-0">
                          <TaskDashboardCardBody
                            display={taskCardDisplay}
                            displayTitle={displayTaskTitle}
                            taskStatusCategory={taskStatusCategory}
                            taskTagOrClient={taskTagOrClient}
                            taskDueLabel={taskDueLabel}
                            taskFrequencyLabel={taskFrequencyLabel}
                            taskUnitLabel={taskUnitLabel}
                            owner={taskOwner}
                            assignees={taskAssignees}
                            titleClassName="min-w-0 text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-primary dark:group-hover:text-primary/80 transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                const task = entry.task;
                const taskId = task.id;
                const taskTitle = resolveTaskTitleWithPeriod(task, 'Untitled Task');
                const taskStatusCategory = getTaskStatusForFilter(task);
                const taskConversationId = task.conversation_id || task.conversationId;
                const taskTagOrClient = resolveTaskTagOrClient(task);
                const taskDueLabel = resolveTaskDueDateLabel(task);
                const taskFrequencyLabel = resolveTaskFrequencyLabel(task);
                const taskUnitLabel = resolveTaskUnitDisplay(task);
                const { owner: taskOwner, assignees: taskAssignees } = resolveTaskCardMembers(task);
                const bulkEligible = canBulkSelectTask(task);
                const taskChecked = bulkSelectMode && selectedTaskIds.has(String(taskId));
                const taskUnreadCount = getTaskCardUnreadCount(taskConversationId);

                return (
                  <div
                    key={`direct-${taskId}`}
                    className={`group relative h-fit rounded-xl border p-2.5 transition-colors duration-200 hover:bg-white dark:hover:bg-surface-dark hover:shadow-sm cursor-pointer ${
                      taskChecked
                        ? 'bg-primary/5 border-primary ring-1 ring-primary/30'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                    onClick={() => {
                      if (bulkSelectMode && bulkEligible) {
                        toggleTaskSelection(String(taskId));
                        return;
                      }
                      if (taskConversationId) {
                        navigate(
                          isAdmin
                            ? `/admin/tasks/task-group/${taskConversationId}`
                            : `/tasks/task-group/${taskConversationId}`
                        );
                      } else {
                        navigate(isAdmin ? `/admin/tasks/${taskId}` : `/tasks/${taskId}`);
                      }
                    }}
                  >
                    {taskCardDisplay.unreadBadge ? <TaskDashboardUnreadBadge count={taskUnreadCount} /> : null}
                    <div className="flex items-start gap-3">
                      {bulkSelectMode && bulkEligible ? (
                        <input
                          type="checkbox"
                          checked={!!taskChecked}
                          readOnly
                          className="mt-4 shrink-0 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary pointer-events-none"
                        />
                      ) : null}
                      <div className="flex-1 min-w-0">
                        <TaskDashboardCardBody
                          display={taskCardDisplay}
                          displayTitle={taskTitle}
                          taskStatusCategory={taskStatusCategory}
                          taskTagOrClient={taskTagOrClient}
                          taskDueLabel={taskDueLabel}
                          taskFrequencyLabel={taskFrequencyLabel}
                          taskUnitLabel={taskUnitLabel}
                          owner={taskOwner}
                          assignees={taskAssignees}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {!isTaskGroupsLoading && !isPendingTasksLoading && sortedTaskCardEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <span className="material-icons-outlined text-4xl text-gray-400 dark:text-gray-600">
                {searchQuery ? 'search_off' : 'groups'}
              </span>
        </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
              {searchQuery ? 'No tasks found' : 'No tasks yet'}
            </p>
            {!searchQuery && (
              <p className="text-gray-500 dark:text-gray-500 text-sm text-center">
                Create your first task using the + button at the bottom right
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const handleConfirmReject = async () => {
    if (!rejectTaskId || !rejectReason.trim()) {
      toast.error('Please provide a reason for rejecting this task');
      return;
    }
    setRejecting(true);
    try {
      await taskService.rejectTask(rejectTaskId, rejectReason.trim());
      toast.success('Task rejected');
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries(['conversations', 'task']);
      queryClient.invalidateQueries(['task', rejectTaskId]);
      if (rejectConvId) queryClient.invalidateQueries(['conversation-details', rejectConvId]);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['dashboard-statistics']);
      setShowRejectModal(false);
      setRejectReason('');
      setRejectTaskId(null);
      setRejectConvId(null);
      setRejectTaskTitle('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject task');
    } finally {
      setRejecting(false);
    }
  };

  // Main content (right side): chat when a task group is selected, otherwise empty state
  const mainContent = selectedConversationId ? (
    <TaskGroupChatConversation
      conversationId={selectedConversationId}
      embedInTaskDashboard
    />
  ) : (
    <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center px-6">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
          <span className="material-icons-outlined text-5xl text-primary dark:text-primary/80">task_alt</span>
        </div>
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Task Selected</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          Select a task from the list to view details and manage tasks
        </p>
                </div>
              </div>
  );

  if (isAdmin) {
    return (
      <AdminLayout hideSearch contentFitViewport>
        <div className="flex h-full min-h-0 overflow-hidden">
          <div className="w-[340px] bg-background-light dark:bg-background-dark flex flex-col min-h-0 border-r border-border-light dark:border-border-dark relative">
            {taskGroupListContent}
              </div>
          <div className="flex-1 flex flex-col min-h-0 bg-surface-light dark:bg-surface-dark relative overflow-hidden">
            {mainContent}
                </div>
              </div>

        <BulkAssignUsersModal
          open={showBulkAssignModal}
          taskCount={selectedTaskIds.size}
          taskIds={Array.from(selectedTaskIds)}
          onClose={() => setShowBulkAssignModal(false)}
          onSuccess={() => {
            invalidateAfterBulkAction();
          }}
        />

        {/* Styled Reject Task Modal (replaces prompt) */}
        {showRejectModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !rejecting && setShowRejectModal(false)}>
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-6 pb-2">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-red-500">close</span>
                  Reject task
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rejectTaskTitle}</p>
              </div>
              <div className="px-6 py-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reason for rejection (required)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this task..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                />
              </div>
              <div className="px-6 pb-6 pt-2 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => !rejecting && (setShowRejectModal(false), setRejectReason(''), setRejectTaskId(null), setRejectConvId(null), setRejectTaskTitle(''))}
                  disabled={rejecting}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={rejecting || !rejectReason.trim()}
                  className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {rejecting ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined text-lg">close</span>
                      Reject task
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    );
  }

  return (
    <EmployeeLayout hideSearch contentFitViewport>
      <div className="flex h-full min-h-0 overflow-hidden">
        <div className="w-[340px] bg-background-light dark:bg-background-dark flex flex-col min-h-0 border-r border-border-light dark:border-border-dark relative">
          {taskGroupListContent}
              </div>
        <div className="flex-1 flex flex-col min-h-0 bg-surface-light dark:bg-surface-dark relative overflow-hidden">
          {mainContent}
        </div>
      </div>

      <BulkAssignUsersModal
        open={showBulkAssignModal}
        taskCount={selectedTaskIds.size}
        taskIds={Array.from(selectedTaskIds)}
        onClose={() => setShowBulkAssignModal(false)}
        onSuccess={() => {
          invalidateAfterBulkAction();
        }}
      />

      {/* Styled Reject Task Modal (replaces prompt) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !rejecting && setShowRejectModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-red-500">close</span>
                Reject task
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rejectTaskTitle}</p>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reason for rejection (required)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this task..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
              />
            </div>
            <div className="px-6 pb-6 pt-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => !rejecting && (setShowRejectModal(false), setRejectReason(''), setRejectTaskId(null), setRejectConvId(null), setRejectTaskTitle(''))}
                disabled={rejecting}
                className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejecting || !rejectReason.trim()}
                className="px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {rejecting ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-lg">close</span>
                    Reject task
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </EmployeeLayout>
  );
};
