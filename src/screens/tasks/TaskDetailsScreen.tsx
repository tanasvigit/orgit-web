import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { taskService } from '../../services/taskService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const TaskDetailsScreen: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRejectModal, setShowRejectModal] = useState(location.state?.showReject || false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin' || location.pathname.startsWith('/admin');

  // Fetch task
  const { data: taskData, isLoading, error: taskError } = useQuery(
    ['task', taskId],
    () => taskService.getTask(taskId!),
    { enabled: !!taskId }
  );

  // taskService.getTask already extracts the task object, so taskData should be the task directly
  const task = taskData;
  
  // Ensure assignees is always an array (handle case where it might be a string or null)
  const assignees = React.useMemo(() => {
    if (!task?.assignees) return [];
    if (Array.isArray(task.assignees)) return task.assignees;
    if (typeof task.assignees === 'string') {
      try {
        return JSON.parse(task.assignees);
      } catch {
        return [];
      }
    }
    return [];
  }, [task?.assignees]);
  
  // Normalize task with assignees array
  const normalizedTask = task ? { ...task, assignees } : null;

  const currentUserId = user?.id || (user as any)?.userId;

  const rejectedStorageKey = React.useMemo(() => {
    const uid = currentUserId || 'unknown';
    return `orgit.rejectedTaskIds.${uid}`;
  }, [currentUserId]);

  const addRejectedTaskId = React.useCallback(
    (tid: string) => {
      try {
        const raw = localStorage.getItem(rejectedStorageKey);
        const existing = raw ? (JSON.parse(raw) as string[]) : [];
        const next = Array.from(new Set([...(existing || []), tid]));
        localStorage.setItem(rejectedStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
    },
    [rejectedStorageKey]
  );

  const removeRejectedTaskId = React.useCallback(
    (tid: string) => {
      try {
        const raw = localStorage.getItem(rejectedStorageKey);
        const existing = raw ? (JSON.parse(raw) as string[]) : [];
        const next = (existing || []).filter((id) => id !== tid);
        localStorage.setItem(rejectedStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
    },
    [rejectedStorageKey]
  );

  const removeTaskFromCachedLists = React.useCallback(
    (tid: string) => {
      // Our task list screen uses query keys ['tasks', 'one_time'] and ['tasks', 'recurring'].
      (['one_time', 'recurring'] as const).forEach((type) => {
        queryClient.setQueryData(['tasks', type], (old: any) => {
          if (!old) return old;
          if (Array.isArray(old)) return old.filter((t: any) => t?.id !== tid);
          return old;
        });
      });
    },
    [queryClient]
  );

  // Accept task mutation
  const acceptTaskMutation = useMutation(
    () => taskService.acceptTask(taskId!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        if (taskId) {
          removeRejectedTaskId(taskId);
        }
        // Navigate to task chat if conversation_id exists
        const currentTask = normalizedTask || task;
        if (currentTask?.conversation_id) {
          navigate(`/messages/task-group/${currentTask.conversation_id}`);
        } else {
          navigate('/tasks');
        }
      }
    }
  );

  // Reject task mutation
  const rejectTaskMutation = useMutation(
    (reason: string) => taskService.rejectTask(taskId!, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (taskId) {
          // Persist + optimistically remove from lists (no backend changes needed)
          addRejectedTaskId(taskId);
          removeTaskFromCachedLists(taskId);
        }
        setShowRejectModal(false);
        setRejectionReason('');
        // Take user back to task list after rejecting
        navigate(isAdmin ? '/admin/tasks' : '/tasks');
      }
    }
  );

  // Update task status mutation
  const updateStatusMutation = useMutation(
    (status: string) => taskService.updateTaskStatus(taskId!, status),
    {
      onSuccess: (data) => {
        console.log('Task status updated successfully:', data);
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
      },
      onError: (error: any) => {
        console.error('Failed to update task status:', error);
        console.error('Error response:', error.response);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to update task status';
        alert(errorMessage);
      }
    }
  );

  // Format date helper (matching mobile)
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Not set';
    }
  };

  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'in_progress': return '#7C3AED';
      case 'completed': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Get global status label
  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'pending': return 'Pending Approval';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'rejected': return 'Rejected';
      default: return status || 'Unknown';
    }
  };

  // Check if user can accept/reject
  const isAssigned = normalizedTask?.assignees?.some((a: any) => (a.id || a.user_id || a.userId) === (user?.id || user?.userId));
  const currentUserStatus = normalizedTask?.current_user_status;
  const hasAccepted = currentUserStatus?.has_accepted || false;
  const hasRejected = currentUserStatus?.has_rejected || false;
  
  // Per-member completion (EXACT mobile logic replication)
  const currentUserAssignee = normalizedTask?.assignees?.find((a: any) => {
    const assigneeId = a.id || a.user_id || a.userId;
    return assigneeId === currentUserId;
  });

  // EXACT mobile logic: hasCompleted checks completed_at (NOT verified_at)
  const hasCompleted =
    !!currentUserAssignee &&
    (currentUserAssignee.completed_at ||
      currentUserAssignee.completion_status === 'completed' ||
      currentUserAssignee.status === 'completed');

  const canMarkComplete =
    isAssigned &&
    hasAccepted &&
    !hasCompleted &&
    normalizedTask?.status !== 'completed';

  // EXACT mobile logic: getMemberStats counts completed_at (NOT verified_at)
  const getMemberStats = () => {
    if (!normalizedTask?.assignees || !Array.isArray(normalizedTask.assignees)) return null;
    const total = normalizedTask.assignees.length;
    const completed = normalizedTask.assignees.filter((a: any) => 
      a.completed_at || a.completion_status === 'completed' || a.status === 'completed'
    ).length;
    return { total, completed, progress: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const memberStats = getMemberStats();

  // EXACT mobile logic: getMemberStatusLabel shows "Completed" if completed_at exists
  const getMemberStatusLabel = (member: any) => {
    if (member.completed_at || member.completion_status === 'completed' || member.status === 'completed') {
      return 'Completed';
    }
    if (member.accepted_at || member.has_accepted) {
      return 'In Progress';
    }
    return 'Pending';
  };

  // EXACT mobile logic: getMemberStatusColor shows green if completed_at exists
  const getMemberStatusColor = (member: any) => {
    if (member.completed_at || member.completion_status === 'completed' || member.status === 'completed') {
      return '#2E7D32'; // Green for completed
    }
    if (member.accepted_at || member.has_accepted) {
      return '#F57C00'; // Orange for in progress
    }
    return '#9CA3AF'; // Gray for pending
  };

  const isCreator =
    !!normalizedTask &&
    (normalizedTask.created_by === currentUserId ||
      normalizedTask.creator_id === currentUserId);

  const isReportingMember =
    !!normalizedTask && normalizedTask.reporting_member_id === currentUserId;

  // For the header badge, prefer showing the current viewer's own status
  // (Completed / Pending Review / In Progress / Pending) rather than only global status.
  const getDisplayStatusLabelForViewer = () => {
    if (currentUserAssignee) {
      const verified =
        currentUserAssignee.verified_at ||
        (currentUserAssignee.verifiedAt as any) ||
        currentUserAssignee.is_verified;

      const completed =
        currentUserAssignee.completed_at ||
        currentUserAssignee.completion_status === 'completed' ||
        currentUserAssignee.status === 'completed';

      const accepted =
        currentUserAssignee.accepted_at ||
        currentUserAssignee.has_accepted;

      if (verified) return 'Completed';
      if (completed) return 'Pending for Review';
      if (accepted) return 'In Progress';
      return 'Pending';
    }

    // Fallback: show global task status
    return getStatusLabel((normalizedTask || task)?.status);
  };

  // Creator is always considered "in" the task; they never see Accept/Reject.
  const canAccept = !isCreator && isAssigned && !hasAccepted && !hasRejected;
  const canReject = !isCreator && isAssigned && !hasRejected && !hasAccepted;

  // Handle accept
  const handleAccept = async () => {
    try {
      setProcessing(true);
      await acceptTaskMutation.mutateAsync();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to accept task');
    } finally {
      setProcessing(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please enter a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      await rejectTaskMutation.mutateAsync(rejectionReason.trim());
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject task');
    } finally {
      setProcessing(false);
    }
  };

  // Mark current user's assignment as complete
  const markCompleteMutation = useMutation(
    () => {
      if (!taskId || !currentUserId) {
        throw new Error('Missing taskId or userId');
      }
      return taskService.markMemberComplete(taskId, currentUserId);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
      },
    }
  );

  const handleMarkComplete = async () => {
    if (!taskId || !currentUserId) return;
    try {
      setProcessing(true);
      await markCompleteMutation.mutateAsync();
      alert('Your completion has been marked and sent for approval.');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Failed to mark completion';
      alert(message);
    } finally {
      setProcessing(false);
    }
  };

  // Verify another member's completion
  const verifyCompletionMutation = useMutation(
    (memberUserId: string) => {
      if (!taskId) {
        throw new Error('Missing taskId');
      }
      return taskService.verifyMemberCompletion(taskId, memberUserId);
    },
    {
      onSuccess: (result: any) => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);

        if (result?.allCompleted) {
          alert('All members have been verified. Task is now completed.');
        } else {
          alert('Member completion verified successfully.');
        }
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          'Failed to verify completion';
        alert(message);
      },
    }
  );

  const handleVerifyMember = async (memberUserId: string, memberName: string) => {
    if (!window.confirm(`Verify that ${memberName} has completed their part of the task?`)) {
      return;
    }

    try {
      setVerifyingUserId(memberUserId);
      await verifyCompletionMutation.mutateAsync(memberUserId);
    } finally {
      setVerifyingUserId(null);
    }
  };

  // Loading state
  if (isLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading task details...</p>
        </div>
      </div>
    );

    if (isAdmin) {
      return <AdminLayout>{loadingContent}</AdminLayout>;
    }
    return <EmployeeLayout>{loadingContent}</EmployeeLayout>;
  }

  // Error or not found state
  if (taskError || !task) {
    const errorContent = (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-400 dark:text-red-500 mb-4">error</span>
          <p className="text-red-600 dark:text-red-400 text-lg font-medium mb-2">
            {taskError ? 'Error loading task' : 'Task not found'}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            {taskError instanceof Error ? taskError.message : 'The task you are looking for does not exist or you do not have permission to view it.'}
          </p>
          <button
            onClick={() => navigate(isAdmin ? '/admin/tasks' : '/tasks')}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] mx-auto"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Tasks
          </button>
        </div>
      </div>
    );

    if (isAdmin) {
      return <AdminLayout>{errorContent}</AdminLayout>;
    }
    return <EmployeeLayout>{errorContent}</EmployeeLayout>;
  }

  // Use normalizedTask if available, fallback to task; merge finance from API/localStorage
  const displayTask = mergeTaskWithFinancial(normalizedTask || task);
  
  const statusColor = getStatusColor(displayTask.status);
  const isOverdue = displayTask.due_date && new Date(displayTask.due_date) < new Date() && displayTask.status !== 'completed';

  const content = (
    <div className="p-6 md:p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            Task Details
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            View and manage task information
          </p>
        </div>
      </div>

      {/* Scrollable Content */}
      <main className="max-w-4xl mx-auto">
        {/* Task Info Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex gap-2 flex-wrap">
              {displayTask.status === 'pending' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  {getStatusLabel(displayTask.status)}
                </span>
              )}
              {displayTask.status === 'in_progress' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  In Progress
                </span>
              )}
              {displayTask.status === 'completed' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  Completed
                </span>
              )}
              {displayTask.status === 'rejected' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  Rejected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isOverdue && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-semibold">
                  <span className="material-symbols-outlined text-base">warning</span>
                  Overdue
                </div>
              )}
              {/* Status Change Dropdown – only task creator can change global status */}
              {isCreator ? (
                <div className="relative">
                  <select
                    value={displayTask.status || 'pending'}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      if (newStatus !== displayTask.status) {
                        updateStatusMutation.mutate(newStatus);
                      }
                    }}
                    disabled={updateStatusMutation.isLoading}
                    className="appearance-none bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                    <span className="material-symbols-outlined text-base">arrow_drop_down</span>
                  </span>
                </div>
              ) : (
                <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Status:&nbsp;
                  <span className="text-gray-900 dark:text-gray-100">
                    {getDisplayStatusLabelForViewer()}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <h2 className="text-2xl md:text-3xl font-bold leading-tight text-gray-900 dark:text-white">{displayTask.title}</h2>
            {(displayTask.financial_value != null || displayTask.finance_type) && isCreator && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  displayTask.finance_type === 'income'
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : displayTask.finance_type === 'expense'
                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {displayTask.finance_type === 'income' ? 'Income' : displayTask.finance_type === 'expense' ? 'Expense' : 'Finance'}
                {displayTask.financial_value != null && ` · ${displayTask.finance_type === 'expense' ? '-' : '+'}${Number(displayTask.financial_value).toFixed(2)}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">calendar_today</span>
              <span>Created: {formatDate(displayTask.created_at)}</span>
            </div>
            {displayTask.id && (
              <div className="flex items-center gap-2">
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span>ID: #{displayTask.id.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description Card */}
        {displayTask.description && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-purple-400 mb-3">
              DESCRIPTION
            </h3>
            <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
              {displayTask.description}
            </p>
          </div>
        )}

        {/* Date Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-purple-400 uppercase">
              <span className="material-symbols-outlined text-base">play_circle</span>
              START DATE
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {formatDate(displayTask.start_date)}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-purple-400 uppercase">
              <span className="material-symbols-outlined text-base">flag</span>
              TARGET DATE
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {formatDate(displayTask.target_date)}
            </span>
          </div>
          <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-5 border-2 border-primary/30 dark:border-primary/40 flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-primary dark:text-purple-400 uppercase">
              <span className="material-symbols-outlined text-base">event</span>
              DUE DATE
            </span>
            <span className="text-lg font-bold text-primary dark:text-purple-300">
              {formatDate(displayTask.due_date)}
            </span>
          </div>
        </div>

        {/* Assigned To Card - Full Details + Member Completion Flow */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-purple-400">
              ASSIGNED TO
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {assignees.length || 0} {assignees.length === 1 ? 'Assignee' : 'Assignees'}
            </span>
          </div>

          {/* Progress Bar - EXACT mobile logic */}
          {memberStats && (
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Team Progress</span>
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {memberStats.completed}/{memberStats.total} completed
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-green-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${memberStats.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Assignees List with Full Details */}
          {assignees && assignees.length > 0 ? (
            <div className="space-y-3">
              {assignees.map((assignee: any) => {
                const assigneeId = assignee.id || assignee.user_id || assignee.userId;
                const currentUserId = user?.id || user?.userId;
                const isCurrentUser = assigneeId === currentUserId;
                // EXACT mobile logic: memberCompleted checks completed_at (NOT verified_at)
                const memberCompleted =
                  assignee.completed_at ||
                  assignee.completion_status === 'completed' ||
                  assignee.status === 'completed';
                const memberVerified = assignee.verified_at;
                const statusLabel = getMemberStatusLabel(assignee);
                const statusColor = getMemberStatusColor(assignee);
                const isReportingMemberForTask = normalizedTask?.reporting_member_id === assigneeId;
                const taskCreatorId = normalizedTask?.created_by || normalizedTask?.creator_id;
                const reportingMemberId = normalizedTask?.reporting_member_id;

                // EXACT mobile logic: canVerifyMember function
                const canVerifyThisMember = (() => {
                  if (isCurrentUser) return false; // Cannot verify yourself
                  if (!memberCompleted || memberVerified) return false; // Must be completed and not verified
                  
                  const isTargetCreator = assigneeId === taskCreatorId;
                  const isTargetReportingMember = assigneeId === reportingMemberId;
                  
                  // Creator can verify reporting member (or all assignees if no reporting member)
                  if (isCreator) {
                    if (reportingMemberId) {
                      // If there's a reporting member, creator can only verify the reporting member
                      return isTargetReportingMember;
                    } else {
                      // If no reporting member, creator can verify all assignees
                      return true;
                    }
                  }
                  
                  // Reporting member can verify non-reporting assignees (but not creator or themselves)
                  if (isReportingMember) {
                    return !isTargetCreator && !isTargetReportingMember && !isCurrentUser;
                  }
                  
                  // Regular assignees cannot verify anyone
                  return false;
                })();
                return (
                  <div
                    key={assigneeId || assignee.id || assignee.userId}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                      assignee.has_accepted
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                    } ${isCurrentUser ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    {/* Profile Photo - EXACT mobile logic */}
                    <div className="relative flex-shrink-0">
                      {assignee.profile_photo_url || assignee.profile_photo ? (
                        <img
                          src={assignee.profile_photo_url || assignee.profile_photo}
                          alt={assignee.name || 'Assignee'}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg border-2 border-white dark:border-slate-700">
                          {(assignee.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* EXACT mobile logic: Show checkmark badge if completed */}
                      {memberCompleted && (
                        <div 
                          className="absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: statusColor }}
                        >
                          <span className="material-symbols-outlined text-white text-xs">check</span>
                        </div>
                      )}
                      {/* EXACT mobile logic: Show reporting member badge */}
                      {isReportingMemberForTask && (
                        <div 
                          className="absolute -top-1 -right-1 size-5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: '#7C3AED' }}
                        >
                          <span className="material-symbols-outlined text-white text-[10px]">shield</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white truncate">
                              {assignee.name || 'Unknown User'}
                            </h4>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full whitespace-nowrap">
                                (You)
                              </span>
                            )}
                            {isReportingMemberForTask && (
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full whitespace-nowrap">
                                - Reporting Member
                              </span>
                            )}
                          </div>
                          {/* EXACT mobile logic: Status row with dot and label */}
                          <div className="flex items-center gap-2 mb-2">
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: statusColor }}
                            />
                            <span 
                              className="text-sm font-medium"
                              style={{ color: statusColor }}
                            >
                              {statusLabel}
                              {memberVerified && ' ✓ Verified'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {/* Mobile Number */}
                        {assignee.mobile || assignee.phone ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-base text-gray-400">phone</span>
                            <span className="font-medium">{(assignee.mobile || assignee.phone).replace(/^\+91/, '')}</span>
                          </div>
                        ) : assignee.email ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-base text-gray-400">email</span>
                            <span className="font-medium">{assignee.email}</span>
                          </div>
                        ) : null}

                        {/* Department */}
                        {assignee.department ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-base text-gray-400">business</span>
                            <span className="font-medium">{assignee.department}</span>
                          </div>
                        ) : null}

                        {/* Designation */}
                        {assignee.designation ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-base text-gray-400">badge</span>
                            <span className="font-medium">{assignee.designation}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* EXACT mobile logic: Verified indicator and Verify button */}
                    <div className="flex flex-col items-end justify-center gap-2">
                      {memberCompleted && memberVerified && (
                        <div className="flex items-center justify-center">
                          <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>
                        </div>
                      )}
                      {canVerifyThisMember && (
                        <>
                          <button
                            type="button"
                            disabled={verifyingUserId === assigneeId}
                            onClick={() =>
                              handleVerifyMember(
                                assigneeId,
                                assignee.name || 'User'
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {verifyingUserId === assigneeId ? (
                              <>
                                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                                <span>Verifying…</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-sm">
                                  verified
                                </span>
                                <span>Verify</span>
                              </>
                            )}
                          </button>
                          {assignee.completed_at && !memberVerified && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400">
                              Waiting for your approval
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_off</span>
              <p className="text-sm">No assignees for this task</p>
            </div>
          )}

          {/* Summary Footer */}
          {assignees && assignees.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">people</span>
                    <span className="font-medium">{assignees.length} Total</span>
                  </span>
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span className="font-medium">
                      {assignees.filter((a: any) => a.has_accepted).length} Accepted
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <span className="material-symbols-outlined text-base">schedule</span>
                    <span className="font-medium">
                      {assignees.filter((a: any) => !a.has_accepted).length} Pending
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Finance section - amount and type (only if task has finance data) */}
        {(displayTask.financial_value != null || displayTask.finance_type) && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-purple-400 mb-3">
              Finance
            </h3>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {displayTask.finance_type && (
                <span className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {displayTask.finance_type === 'income' ? 'Income' : displayTask.finance_type === 'expense' ? 'Expense' : displayTask.finance_type}
                </span>
              )}
              {displayTask.financial_value != null && (
                <span
                  className={`text-lg font-bold ${
                    displayTask.finance_type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : displayTask.finance_type === 'expense'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {displayTask.finance_type === 'expense' ? '-' : '+'}
                  {Number(displayTask.financial_value).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Auto Escalation Rules */}
        {displayTask.auto_escalate && (
          <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">warning</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Auto Escalation Rules</h3>
            </div>
            <div className="p-4">
              <ul className="space-y-4 relative pl-2">
                <div className="absolute left-[15px] top-2 bottom-6 w-0.5 bg-gray-100 dark:bg-gray-700"></div>
                <li className="relative flex gap-4 items-start">
                  <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600 ring-4 ring-white dark:ring-slate-800"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">LEVEL 1</span>
                    <span className="text-sm text-gray-700 dark:text-gray-200">Notify Manager if not accepted within 24h</span>
                  </div>
                </li>
                <li className="relative flex gap-4 items-start">
                  <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-orange-300 dark:bg-orange-500 ring-4 ring-white dark:ring-slate-800"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">LEVEL 2</span>
                    <span className="text-sm text-gray-700 dark:text-gray-200">Escalate to Dept Head if overdue &gt; 2 days</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Activity Log */}
        {displayTask.activities && displayTask.activities.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-purple-400 mb-3">
              ACTIVITY LOG
            </h3>
            {displayTask.activities.slice(0, 5).map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {activity.message || `${activity.activity_type} - ${activity.new_value || ''}`}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(activity.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Action Bar */}
      {(canAccept || canReject || canMarkComplete) && (
        <div className="max-w-4xl mx-auto mt-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex gap-3">
              {canReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-red-500/30 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                  Reject
                </button>
              )}
              {canAccept && (
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex-[2] rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">check</span>
                      <span>Accept Task</span>
                    </>
                  )}
                </button>
              )}
              {canMarkComplete && (
                <button
                  onClick={handleMarkComplete}
                  disabled={processing}
                  className="flex-[2] rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">
                        check_circle
                      </span>
                      <span>Mark Complete</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectModal(false)}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reject Task</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejection
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection (Required if rejecting)..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing}
                className="flex-1 py-3 px-4 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Wrap in appropriate layout
  if (isAdmin) {
    return (
      <AdminLayout>
        {content}
      </AdminLayout>
    );
  }

  // Employee route - use EmployeeLayout (no BottomNav)
  return (
    <EmployeeLayout>
      {content}
    </EmployeeLayout>
  );
};
