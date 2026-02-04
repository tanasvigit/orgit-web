import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { conversationService } from '../../services/conversationService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';

export type StatusFilter = 'all' | 'overdue' | 'duesoon' | 'inprogress' | 'completed';

export const TaskDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Status filter from URL (dashboard card navigation) or local state
  const statusFromUrl = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const v = (statusFromUrl || '').toLowerCase();
    if (v === 'overdue' || v === 'duesoon' || v === 'inprogress' || v === 'completed') return v;
    return 'all';
  });

  // Sync filter from URL when navigating from dashboard (e.g. /tasks?status=inprogress)
  useEffect(() => {
    const v = (searchParams.get('status') || '').toLowerCase();
    if (v === 'overdue' || v === 'duesoon' || v === 'inprogress' || v === 'completed') {
      setStatusFilter(v);
    } else {
      setStatusFilter('all');
    }
  }, [searchParams]);

  // Fetch all tasks (one-time and recurring; type filter removed)
  const { data: tasksData, isLoading, refetch, error } = useQuery(
    ['tasks'],
    () => taskService.getTasks(),
    {
      onSuccess: () => {
        setRefreshing(false);
      },
      onError: (error: any) => {
        console.error('Error fetching tasks:', error);
        setRefreshing(false);
      }
    }
  );

  // When navigating back to this screen (e.g., after rejecting), force a refetch
  useEffect(() => {
    refetch();
  }, [location.key, refetch]);

  const tasks = tasksData || [];

  // Filter tasks by search query
  const filteredTasks = React.useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const lower = searchQuery.toLowerCase();
    return tasks.filter((task: any) =>
      task.title?.toLowerCase().includes(lower) ||
      task.description?.toLowerCase().includes(lower)
    );
  }, [tasks, searchQuery]);

  const currentUserId = user?.id || (user as any)?.userId;
  const rejectedStorageKey = React.useMemo(() => {
    const uid = currentUserId || 'unknown';
    return `orgit.rejectedTaskIds.${uid}`;
  }, [currentUserId]);

  const locallyRejectedIds = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(rejectedStorageKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(parsed || []);
    } catch {
      return new Set<string>();
    }
  }, [rejectedStorageKey]);

  const hasUserRejectedTask = (task: any) => {
    if (task?.id && locallyRejectedIds.has(task.id)) return true;

    const statusForUser = task?.current_user_status || task?.currentUserStatus || {};
    if (statusForUser.has_rejected || statusForUser.hasRejected) return true;
    if (statusForUser.rejected_at || statusForUser.rejectedAt) return true;

    // Some endpoints embed per-user state inside assignees
    const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
    const me = assignees.find((a: any) => (a.id || a.user_id || a.userId) === currentUserId);
    if (!me) return false;
    return !!(me.has_rejected || me.hasRejected || me.rejected_at || me.rejectedAt);
  };

  // Hide tasks that the current user has rejected
  const visibleTasks = React.useMemo(
    () =>
      filteredTasks.filter((task: any) => {
        return !hasUserRejectedTask(task);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredTasks, currentUserId]
  );

  // Format date helper (matching mobile)
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === today.toDateString()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      return '';
    }
  };

  // Check if task is overdue
  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Due soon: due within next 3 days (today <= due <= today+3), not completed (matches dashboard)
  const DUE_SOON_DAYS = 3;
  const isDueSoon = (task: any) => {
    const due = task?.due_date || task?.dueDate;
    if (!due) return false;
    const status = (task?.status || '').toLowerCase();
    if (status === 'completed') return false;
    const dueDate = new Date(due);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endSoon = new Date(today);
    endSoon.setDate(endSoon.getDate() + DUE_SOON_DAYS);
    endSoon.setHours(23, 59, 59, 999);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate >= today && dueDate <= endSoon;
  };

  // Get status color (global mapping)
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'in_progress': return '#7C3AED';
      case 'completed': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Per-viewer status based on assignee + verification, similar to mobile getMemberStatus
  type ViewerStatus = 'pending' | 'in_progress' | 'pending_verification' | 'completed';

  const getViewerStatusForTask = (task: any): ViewerStatus => {
    const statusForUser = task?.current_user_status || task?.currentUserStatus || {};

    // Quick shortcut: if backend explicitly marks current user as rejected, treat as pending (but filtered out earlier).
    if (statusForUser.has_rejected || statusForUser.hasRejected) {
      return 'pending';
    }

    const assignees = Array.isArray(task?.assignees) ? task.assignees : [];
    const me = assignees.find((a: any) => {
      const assigneeId = a.id || a.user_id || a.userId;
      return assigneeId === currentUserId;
    });

    if (me) {
      const verified =
        me.verified_at ||
        (me.verifiedAt as any) ||
        me.is_verified;
      const completed =
        me.completed_at ||
        me.completion_status === 'completed' ||
        me.status === 'completed';
      const accepted =
        me.accepted_at ||
        me.has_accepted ||
        statusForUser.has_accepted ||
        statusForUser.accepted_at;

      if (verified) return 'completed';
      if (completed) return 'pending_verification';
      if (accepted) return 'in_progress';
    } else if (statusForUser.has_accepted) {
      // Fallback if only current_user_status is available
      return 'in_progress';
    }

    // Default: pending until accepted
    return 'pending';
  };

  // Apply dashboard-style status filter (from URL or filter tabs)
  const statusFilteredTasks = React.useMemo(() => {
    if (statusFilter === 'all') return visibleTasks;
    return visibleTasks.filter((task: any) => {
      const viewerStatus = getViewerStatusForTask(task);
      const taskStatus = (task?.status || '').toLowerCase();
      const overdue = isOverdue(task?.due_date || task?.dueDate);
      if (statusFilter === 'overdue') {
        return overdue && taskStatus !== 'completed';
      }
      if (statusFilter === 'duesoon') {
        return isDueSoon(task);
      }
      if (statusFilter === 'inprogress') {
        return viewerStatus === 'in_progress' || viewerStatus === 'pending_verification';
      }
      if (statusFilter === 'completed') {
        return viewerStatus === 'completed' || taskStatus === 'completed';
      }
      return true;
    });
  }, [visibleTasks, statusFilter]);

  // Separate pending and all tasks (from status-filtered list)
  const pendingTasks = statusFilteredTasks.filter((task: any) => task.status === 'pending');
  const allTasks = statusFilteredTasks.filter((task: any) => task.status !== 'pending');

  const setStatusFilterAndUrl = (filter: StatusFilter) => {
    setStatusFilter(filter);
    if (filter === 'all') {
      searchParams.delete('status');
      setSearchParams(searchParams, { replace: true });
    } else {
      searchParams.set('status', filter);
      setSearchParams(searchParams, { replace: true });
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    refetch();
  };

  // Handle accept task
  const acceptTaskMutation = useMutation(
    (taskId: string) => taskService.acceptTask(taskId),
    {
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries(['tasks']);
      }
    }
  );

  // Handle reject task
  const rejectTaskMutation = useMutation(
    ({ taskId, reason }: { taskId: string; reason: string }) => taskService.rejectTask(taskId, reason),
    {
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries(['tasks']);
      }
    }
  );

  const handleAccept = (taskId: string) => {
    acceptTaskMutation.mutate(taskId);
  };

  const handleReject = (taskId: string) => {
    navigate(isAdmin ? `/admin/tasks/${taskId}` : `/tasks/${taskId}`, { state: { showReject: true } });
  };

  // Render task card - Desktop optimized
  const renderTask = (task: any) => {
    const viewerStatus = getViewerStatusForTask(task);
    const isPending = viewerStatus === 'pending';
    const overdue = isOverdue(task.due_date);
    const statusColor = getStatusColor(
      viewerStatus === 'pending_verification' ? 'in_progress' : viewerStatus
    );
    const taskType = (task.task_type || task.taskType || 'one_time').toLowerCase();
    const isRecurring = taskType === 'recurring';
    
    // Check current user's relationship to this task
    const currentUserStatus = task.current_user_status;
    const hasAccepted = currentUserStatus?.has_accepted || false;
    const hasRejected = currentUserStatus?.has_rejected || false;
    const isAssigned = task.assignees?.some((a: any) => a.id === user?.id);

    // Task creator is always part of the task and does not need to accept/reject
    const creatorId = task.created_by || task.creator_id;
    const isCreatorForTask = creatorId && currentUserId && creatorId === currentUserId;

    // User can accept/reject if assigned (and not creator), task is pending, and they haven't accepted/rejected
    const canAccept = !isCreatorForTask && isPending && isAssigned && !hasAccepted && !hasRejected;
    const canReject = !isCreatorForTask && isPending && !hasRejected && !hasAccepted;
    
    // Calculate acceptance count
    const acceptedCount = task.accepted_count || 0;
    const totalAssignees = task.total_assignees || 0;

    const handleCardClick = () => {
      const convId = task.conversation_id || task.conversationId;

      // Creators: if a task group exists, go straight to the task-group chat in the Task module
      if (isCreatorForTask && convId) {
        navigate(isAdmin ? `/admin/tasks/task-group/${convId}` : `/tasks/task-group/${convId}`);
        return;
      }

      // Assignees who have not yet accepted should see the Task Details screen (with Accept / Reject)
      if (!hasAccepted) {
        navigate(isAdmin ? `/admin/tasks/${task.id}` : `/tasks/${task.id}`);
        return;
      }

      // Assignees who have accepted and have a task group -> open chat in Task module
      if (convId) {
        navigate(isAdmin ? `/admin/tasks/task-group/${convId}` : `/tasks/task-group/${convId}`);
        return;
      }

      // Fallback: open Task Details
      navigate(isAdmin ? `/admin/tasks/${task.id}` : `/tasks/${task.id}`);
    };

    return (
      <div
        key={task.id}
        className="flex flex-col gap-3 rounded-2xl bg-white dark:bg-slate-800/90 p-5 shadow-lg border border-slate-200/80 dark:border-slate-600/80 cursor-pointer hover:shadow-xl hover:border-primary/40 dark:hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200 group"
        onClick={handleCardClick}
      >
        {/* Header: OT/RT indicator + Status (viewer based) */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide ${
                isRecurring
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                  : 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
              }`}
              title={isRecurring ? 'Recurring Task' : 'One-Time Task'}
            >
              {isRecurring ? 'RT' : 'OT'}
            </span>
            {viewerStatus === 'pending' && (
              <span 
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                Pending
              </span>
            )}
            {viewerStatus === 'in_progress' && (
              <span 
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                In Progress
              </span>
            )}
            {viewerStatus === 'pending_verification' && (
              <span 
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                Pending Review
              </span>
            )}
            {viewerStatus === 'completed' && (
              <span 
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                Completed
              </span>
            )}
          </div>
          {overdue && task.status !== 'completed' && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-semibold">
              <span className="material-symbols-outlined text-sm">warning</span>
              Overdue
            </div>
          )}
        </div>

        {/* Task Title */}
        <h3 className="text-gray-900 dark:text-white text-lg font-bold leading-tight group-hover:text-primary dark:group-hover:text-primary-light transition-colors">
          {task.title}
        </h3>
        
        {/* Due Date */}
        <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
          <span className="material-symbols-outlined text-base mr-2">event</span>
          <span>Due {formatDate(task.due_date)}</span>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Finance row - only visible to task creator */}
        {(task.financial_value != null || task.finance_type) && (task.created_by === currentUserId || task.creator_id === currentUserId) && (
          <div className="flex items-center justify-between gap-2 text-sm">
            {task.finance_type && (
              <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wide text-xs">
                {task.finance_type === 'income' ? 'Income' : task.finance_type === 'expense' ? 'Expense' : task.finance_type}
              </span>
            )}
            {task.financial_value != null && (
              <span
                className={`font-bold text-sm ${
                  task.finance_type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : task.finance_type === 'expense'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {task.finance_type === 'expense' ? '-' : '+'}
                {Number(task.financial_value).toFixed(2)}
              </span>
            )}
          </div>
        )}

        {/* Acceptance Status */}
        {isPending && totalAssignees > 1 && (
          <div className="flex items-center justify-between gap-2 text-gray-500 dark:text-gray-400 text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">people</span>
              <span>{acceptedCount} of {totalAssignees} accepted</span>
            </div>
            {hasAccepted && (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="text-xs font-semibold">You accepted</span>
              </div>
            )}
          </div>
        )}

        {/* Accept/Reject Buttons */}
        {(canAccept || canReject) && (
          <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            {canReject && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReject(task.id);
                }}
                className="flex-1 flex items-center justify-center h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg mr-2">close</span>
                Reject
              </button>
            )}
            {canAccept && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAccept(task.id);
                }}
                className="flex-1 flex items-center justify-center h-10 rounded-lg bg-primary text-white font-semibold text-sm shadow-md hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-lg mr-2">check</span>
                Accept
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Main content component
  const mainContent = (
    <div className="p-6 md:p-8 relative">
      {/* Create Task Button - Top Right Corner (Admin only) */}
      {isAdmin && (
        <button
          onClick={() => setShowTaskCreateModal(true)}
          className="fixed top-24 right-8 z-40 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/40 active:scale-95 hover:scale-105"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Create Task</span>
        </button>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">
            Task Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Manage your tasks and track progress
          </p>
        </div>
        {/* Show Create Button for Employee Layout (Admin has it in top right corner) */}
        {!isAdmin && (
          <div className="flex-shrink-0">
            <button
              onClick={() => setShowTaskCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Create Task
            </button>
          </div>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="mb-6">
        <div className="flex flex-col gap-4">
          {/* Search + Status filter row */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search Bar - Navbar Style */}
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-[18px] pointer-events-none">
              search
            </span>
            <input
              className="w-full bg-slate-100 dark:bg-slate-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary-600 rounded-full py-2 pl-10 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 focus:outline-none transition-all"
              placeholder="Search..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                title="Clear search"
              >
                <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-base">
                  close
                </span>
              </button>
            )}
          </div>
          </div>

          {/* Status filter tabs (dashboard-style: All, Overdue, Due Soon, In Progress, Completed) */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">Status:</span>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'overdue', 'duesoon', 'inprogress', 'completed'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setStatusFilterAndUrl(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {key === 'all' ? 'All' : key === 'duesoon' ? 'Due Soon' : key === 'inprogress' ? 'In Progress' : key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-400 dark:text-gray-500 text-sm">Loading tasks...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800">
          <span className="material-symbols-outlined text-6xl text-red-400 dark:text-red-500 mb-4">error</span>
          <p className="text-red-600 dark:text-red-400 text-lg font-medium mb-2">Error loading tasks</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            {error instanceof Error ? error.message : 'Failed to fetch tasks. Please try again.'}
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Retry
          </button>
        </div>
      ) : statusFilteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
            task_alt
          </span>
          <p className="text-gray-400 dark:text-gray-500 text-lg font-medium mb-2">
            {statusFilter !== 'all' && visibleTasks.length > 0
              ? 'No tasks match this filter'
              : 'No tasks found'}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            {statusFilter !== 'all' && visibleTasks.length > 0
              ? 'Try another status or All'
              : searchQuery
                ? 'Try adjusting your search'
                : 'Get started by creating your first task'}
          </p>
          {statusFilter !== 'all' && visibleTasks.length > 0 ? (
            <button
              onClick={() => setStatusFilterAndUrl('all')}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              Show all tasks
            </button>
          ) : (
            <button
              onClick={() => setShowTaskCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Create Task
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Review Section */}
          {pendingTasks.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-primary dark:text-purple-400 uppercase tracking-wider mb-1">
                    PENDING REVIEW
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} awaiting your action
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pendingTasks.map((task: any) => renderTask(mergeTaskWithFinancial(task)))}
              </div>
            </div>
          )}

          {/* All Tasks Section */}
          {allTasks.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    ALL TASKS
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {allTasks.length} task{allTasks.length !== 1 ? 's' : ''} total
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allTasks.map((task: any) => renderTask(mergeTaskWithFinancial(task)))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Create Modal */}
      <TaskCreateModal
        visible={showTaskCreateModal}
        onClose={() => setShowTaskCreateModal(false)}
        onSuccess={() => {
          setShowTaskCreateModal(false);
          refetch();
        }}
      />
    </div>
  );

  if (isAdmin) {
    return (
      <AdminLayout>
        {mainContent}
      </AdminLayout>
    );
  }

  // Employee route - use EmployeeLayout
  return (
    <EmployeeLayout>
      {mainContent}
    </EmployeeLayout>
  );
};

