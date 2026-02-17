import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { taskService } from '../../services/taskService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { conversationService } from '../../services/conversationService';
import { Avatar } from '../../components/shared';

export const TaskDetailsScreen: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRejectModal, setShowRejectModal] = useState(location.state?.showReject || false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
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

  // Check if user can accept/reject
  const isAssigned = normalizedTask?.assignees?.some((a: any) => (a.id || a.user_id || a.userId) === (user?.id || (user as any)?.userId));
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

  // Normalize to string so creator check works when ownership was given to another user (e.g. task owner)
  const taskOwnerId = normalizedTask?.created_by ?? normalizedTask?.creator_id;
  const isCreator =
    !!normalizedTask &&
    !!currentUserId &&
    !!taskOwnerId &&
    String(taskOwnerId) === String(currentUserId);

  // Mirror mobile: creator can mark complete without accepting; entire task completes when creator marks complete.
  // After verify, task.status is 'completed' (so assignees see Completed) but creator still needs to mark complete — show button for creator.
  const canMarkComplete =
    isAssigned &&
    (isCreator || hasAccepted) &&
    !hasCompleted &&
    (normalizedTask?.status !== 'completed' || isCreator);

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
    return 'TODO';
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

  const isReportingMember =
    !!normalizedTask && normalizedTask.reporting_member_id === currentUserId;

  // Per-viewer status for details page (mirror dashboard logic, with creator aggregation)
  type ViewerStatus = 'pending' | 'in_progress' | 'pending_verification' | 'completed';

  const getViewerStatusForCurrentUser = (): ViewerStatus => {
    const statusForUser = normalizedTask?.current_user_status || (normalizedTask as any)?.currentUserStatus || {};
    const assigneesArr = Array.isArray(normalizedTask?.assignees) ? normalizedTask!.assignees : [];

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
        currentUserAssignee.has_accepted ||
        statusForUser.has_accepted ||
        statusForUser.accepted_at;

      if (verified) return 'completed';
      if (completed) return 'pending_verification';
      if (accepted) return 'in_progress';
      return 'pending';
    }

    if (statusForUser.has_accepted) {
      return 'in_progress';
    }

    if (isCreator) {
      if (assigneesArr.length > 0) {
        const anyVerified = assigneesArr.some(
          (a: any) =>
            a.verified_at ||
            (a.verifiedAt as any) ||
            a.is_verified
        );
        if (anyVerified) return 'completed';

        const anyCompleted = assigneesArr.some(
          (a: any) =>
            a.completed_at ||
            a.completion_status === 'completed' ||
            a.status === 'completed'
        );
        if (anyCompleted) return 'pending_verification';

        const anyAccepted = assigneesArr.some(
          (a: any) =>
            a.accepted_at ||
            a.has_accepted
        );
        if (anyAccepted) return 'in_progress';
      }
      return 'pending';
    }

    return 'pending';
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
      toast.error(error.response?.data?.error || 'Failed to accept task');
    } finally {
      setProcessing(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      await rejectTaskMutation.mutateAsync(rejectionReason.trim());
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject task');
    } finally {
      setProcessing(false);
    }
  };

  // Mark current user's assignment as complete (creator: entire task completes; assignee: pending verification)
  const markCompleteMutation = useMutation(
    () => {
      if (!taskId || !currentUserId) {
        throw new Error('Missing taskId or userId');
      }
      return taskService.markMemberComplete(taskId, currentUserId);
    },
    {
      onSuccess: (data: any) => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (isAdmin) {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
          void queryClient.refetchQueries({ queryKey: ['admin-dashboard-statistics'] });
          void queryClient.refetchQueries({ queryKey: ['admin-dashboard'] });
        } else {
          void queryClient.refetchQueries({ queryKey: ['dashboard-statistics'] });
          void queryClient.refetchQueries({ queryKey: ['dashboard'] });
        }
        const message = data?.taskCompleted
          ? 'Task completed. The entire task has been marked as completed.'
          : 'Your completion has been marked and sent for approval.';
        toast.error(message);
      },
    }
  );

  const handleMarkComplete = () => {
    if (!taskId || !currentUserId) return;
    const confirmMessage = isCreator
      ? 'As the creator, marking complete will complete the entire task for everyone. Continue?'
      : 'Have you completed your part of this task? Your completion will need to be verified.';
    toast.confirm(confirmMessage, {
      onConfirm: async () => {
        try {
          setProcessing(true);
          await markCompleteMutation.mutateAsync();
        } catch (error: any) {
          const message =
            error?.response?.data?.error ||
            error?.message ||
            'Failed to mark completion';
          toast.error(message);
        } finally {
          setProcessing(false);
        }
      },
      confirmLabel: 'Yes',
      cancelLabel: 'Cancel',
    });
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
        if (isAdmin) {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
          void queryClient.refetchQueries({ queryKey: ['admin-dashboard-statistics'] });
          void queryClient.refetchQueries({ queryKey: ['admin-dashboard'] });
        } else {
          void queryClient.refetchQueries({ queryKey: ['dashboard-statistics'] });
          void queryClient.refetchQueries({ queryKey: ['dashboard'] });
        }

        if (result?.allCompleted) {
          toast.success('All members have been verified. Task is now completed.');
        } else {
          toast.success('Member completion verified successfully.');
        }
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          'Failed to verify completion';
        toast.error(message);
      },
    }
  );

  // Delete task (creator only)
  const deleteTaskMutation = useMutation(
    () => taskService.deleteTask(taskId!),
    {
      onSuccess: () => {
        // Remove from caches and dashboard
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        toast.success('Task deleted successfully');
        navigate(isAdmin ? '/admin/tasks' : '/tasks');
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          'Failed to delete task';
        toast.error(message);
      },
    }
  );

  const handleDeleteTask = () => {
    if (!taskId || !isCreator) return;
    toast.confirm('Are you sure you want to delete this task? This action cannot be undone.', {
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        try {
          await deleteTaskMutation.mutateAsync();
        } catch {
          // error already handled in onError
        }
      },
    });
  };

  const handleVerifyMember = (memberUserId: string, memberName: string) => {
    toast.confirm(`Verify that ${memberName} has completed their part of the task?`, {
      onConfirm: async () => {
        try {
          setVerifyingUserId(memberUserId);
          await verifyCompletionMutation.mutateAsync(memberUserId);
        } finally {
          setVerifyingUserId(null);
        }
      },
      confirmLabel: 'Verify',
      cancelLabel: 'Cancel',
    });
  };

  // Fetch all users for adding members
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery(
    ['all-users'],
    () => conversationService.getAllUsers(),
    { enabled: showAddMembers }
  );

  // Filter out users who are already assignees
  const availableUsers = React.useMemo(() => {
    if (!allUsers || !assignees) return [];
    const assigneeIds = assignees.map((a: any) => a.id || a.user_id || a.userId).filter(Boolean);
    return allUsers.filter((u: any) => !assigneeIds.includes(u.id));
  }, [allUsers, assignees]);

  // Filter users by search query
  const filteredUsers = React.useMemo(() => {
    if (!searchQuery.trim()) return availableUsers;
    const query = searchQuery.toLowerCase();
    return availableUsers.filter((u: any) => 
      (u.name || '').toLowerCase().includes(query) || 
      (u.mobile || '').toLowerCase().includes(query)
    );
  }, [availableUsers, searchQuery]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Add members mutation
  const addMembersMutation = useMutation(
    (memberIds: string[]) => {
      const conversationId = normalizedTask?.conversation_id || normalizedTask?.conversationId;
      if (!conversationId) {
        throw new Error('Task does not have a conversation group');
      }
      return conversationService.addGroupMembers(conversationId, memberIds);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['conversation', normalizedTask?.conversation_id || normalizedTask?.conversationId]);
        queryClient.invalidateQueries('conversations');
        setShowAddMembers(false);
        setSearchQuery('');
        setSelectedUserIds([]);
        toast.success('Members added successfully!');
      },
      onError: (error: any) => {
        toast.error(`Failed to add members: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleAddMembers = () => {
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one member to add');
      return;
    }
    addMembersMutation.mutate(selectedUserIds);
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
  
  const viewerStatus = getViewerStatusForCurrentUser();
  const isOverdue = displayTask.due_date && new Date(displayTask.due_date) < new Date() && displayTask.status !== 'completed';

  // Hero badge label: use viewer status, but override to Overdue when needed
  const heroStatusLabel = (() => {
    if (isOverdue && viewerStatus !== 'completed') {
      return 'Overdue';
    }
    switch (viewerStatus) {
      case 'pending':
        return 'TODO';
      case 'in_progress':
        return 'In Progress';
      case 'pending_verification':
        return 'Pending for Review';
      case 'completed':
        return 'Completed';
      default:
        return 'TODO';
    }
  })();

  // Hero status badge color (design: amber for Pending Approval, etc.)
  const getHeroBadgeClass = () => {
    if (isOverdue && viewerStatus !== 'completed') {
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    }
    switch (viewerStatus) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'in_progress':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'pending_verification':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  // Timeline current step for User Progress Analytics
  const getTimelineCurrentStep = (): string => {
    if (viewerStatus === 'completed') return 'completed';
    if (isOverdue) return 'overdue';
    if (viewerStatus === 'in_progress' || viewerStatus === 'pending_verification') return 'in_progress';
    if (viewerStatus === 'pending') return 'start';
    return 'in_progress';
  };
  const timelineStep = getTimelineCurrentStep();

  const content = (
    <div className="p-0 font-task min-h-screen bg-background-light dark:bg-background-dark">

      <main className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        {/* Hero: Title + Status (Design style) */}
        <section className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
          <div className="flex flex-col gap-6">
            <div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full mb-3 inline-block ${getHeroBadgeClass()}`}>
                {heroStatusLabel}
              </span>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{displayTask.title}</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm flex items-center gap-4">
                <span>Created: {formatDate(displayTask.created_at)}</span>
                {displayTask.id && (
                  <>
                    <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                    <span className="font-mono">ID: #{displayTask.id.slice(0, 8).toUpperCase()}</span>
                  </>
                )}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Start Date</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{formatDate(displayTask.start_date)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Target Date</p>
                <p className="text-base font-semibold text-slate-900 dark:text-white">{formatDate(displayTask.target_date)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-task-primary">Due Date</p>
                <p className="text-base font-bold text-task-primary">{formatDate(displayTask.due_date)}</p>
              </div>
            </div>
            {(displayTask.financial_value != null || displayTask.finance_type) && isCreator && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${
                    displayTask.finance_type === 'income'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : displayTask.finance_type === 'expense'
                      ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {displayTask.finance_type === 'income' ? 'Income' : displayTask.finance_type === 'expense' ? 'Expense' : 'Finance'}
                  {displayTask.financial_value != null && ` · ${displayTask.finance_type === 'expense' ? '-' : '+'}${Number(displayTask.financial_value).toFixed(2)}`}
                </span>
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* User Progress Analytics - Design timeline */}
            <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-8">User Progress Analytics</h3>
              <div className="space-y-0 pl-2">
                <style>{`
                  .timeline-line { position: absolute; left: 7px; top: 24px; bottom: -8px; width: 2px; }
                  .timeline-item:last-child .timeline-line { display: none; }
                `}</style>
                <div className="relative timeline-item pb-10">
                  <div className="timeline-line bg-slate-200 dark:bg-slate-700"></div>
                  <div className={`absolute left-0 w-4 h-4 rounded-full border-4 border-white dark:border-card-dark z-10 ${timelineStep === 'start' ? 'bg-task-primary' : 'bg-slate-400'}`}></div>
                  <div className="pl-8 -mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Start Date</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayTask.start_date ? new Date(displayTask.start_date).toLocaleDateString() : 'Not set'}</p>
                  </div>
                </div>
                <div className="relative timeline-item pb-10">
                  <div className="timeline-line bg-slate-200 dark:bg-slate-700"></div>
                  <div className={`absolute left-0 w-4 h-4 rounded-full z-10 ${timelineStep === 'in_progress' ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)] animate-pulse' : 'bg-slate-400 border-4 border-white dark:border-card-dark'}`}></div>
                  <div className="pl-8 -mt-1">
                    <p className={`text-sm font-bold ${timelineStep === 'in_progress' ? 'text-amber-500' : 'text-slate-500'}`}>In Progress</p>
                  </div>
                </div>
                <div className="relative timeline-item pb-10">
                  <div className="timeline-line bg-slate-200 dark:bg-slate-700"></div>
                  <div className={`absolute left-0 w-4 h-4 rounded-full border-4 border-white dark:border-card-dark z-10 ${timelineStep === 'target' ? 'bg-task-primary' : 'bg-slate-400'}`}></div>
                  <div className="pl-8 -mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Target Date</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayTask.target_date ? new Date(displayTask.target_date).toLocaleDateString() : 'Not set'}</p>
                  </div>
                </div>
                <div className="relative timeline-item pb-10">
                  <div className="timeline-line bg-slate-200 dark:bg-slate-700"></div>
                  <div className={`absolute left-0 w-4 h-4 rounded-full border-2 z-10 ${timelineStep === 'due_soon' ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}></div>
                  <div className="pl-8 -mt-1">
                    <p className={`text-sm font-medium ${timelineStep === 'due_soon' ? 'text-amber-500' : 'text-slate-500'}`}>Due Soon</p>
                  </div>
                </div>
                <div className="relative timeline-item pb-10">
                  <div className="timeline-line bg-slate-200 dark:bg-slate-700"></div>
                  <div className={`absolute left-0 w-4 h-4 rounded-full border-4 border-white dark:border-card-dark z-10 ${timelineStep === 'due_date' ? 'bg-task-primary' : 'bg-slate-400'}`}></div>
                  <div className="pl-8 -mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Due Date</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{displayTask.due_date ? new Date(displayTask.due_date).toLocaleDateString() : 'Not set'}</p>
                  </div>
                </div>
                <div className="relative timeline-item pb-10">
                  <div className="timeline-line bg-slate-200 dark:bg-slate-700"></div>
                  <div className={`absolute left-0 w-4 h-4 rounded-full border-2 z-10 ${timelineStep === 'overdue' ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'border-slate-300 bg-white dark:bg-slate-800'}`}></div>
                  <div className="pl-8 -mt-1">
                    <p className={`text-sm font-medium ${timelineStep === 'overdue' ? 'text-rose-500' : 'text-slate-400'}`}>Overdue</p>
                  </div>
                </div>
                <div className="relative timeline-item">
                  <div className={`absolute left-0 w-4 h-4 rounded-full border-2 z-10 ${timelineStep === 'completed' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 bg-white dark:bg-slate-800'}`}></div>
                  <div className="pl-8 -mt-1">
                    <p className={`text-sm font-medium ${timelineStep === 'completed' ? 'text-emerald-500' : 'text-slate-400'}`}>Completed</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Description Card */}
            {displayTask.description && (
              <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-3">Description</h3>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-base">{displayTask.description}</p>
              </section>
            )}

            {/* Related document */}
            {(displayTask.document_instance_id || (displayTask as any).documentInstanceId) && (
              <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-3">Related document</h3>
                <button
                  type="button"
                  onClick={() => {
                    const docId = displayTask.document_instance_id || (displayTask as any).documentInstanceId;
                    navigate(isAdmin ? `/admin/documents/${docId}` : `/documents/${docId}`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-task-primary/10 text-task-primary font-semibold text-sm hover:bg-task-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">description</span>
                  View document
                </button>
              </section>
            )}

            {/* Activity Log - Design style */}
            <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-6">Activity Log</h3>
              <div className="space-y-4">
                {displayTask.activities && displayTask.activities.length > 0 ? (
                  displayTask.activities.slice(0, 5).map((activity: any) => (
                    <div key={activity.id} className="flex justify-between items-start">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {activity.message || `${activity.activity_type} - ${activity.new_value || ''}`}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(activity.created_at)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-start">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Task &quot;{displayTask.title}&quot; created{isCreator ? ' (self task - auto started)' : ''}
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(displayTask.created_at)}</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right column - Task Members */}
          <div className="space-y-6">
            <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest">Task Members</h3>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-task-primary/20 text-task-primary text-xs font-semibold hover:bg-task-primary/5 transition-colors"
                  onClick={() => setShowAddMembers(!showAddMembers)}
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Add
                </button>
              </div>
              
              {/* Add Members UI */}
              {showAddMembers && (
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-slate-100 dark:border-slate-800">
                  <div className="mb-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or mobile number..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-task-primary"
                    />
                  </div>
                  
                  {isLoadingUsers && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Loading users...</p>
                  )}
                  
                  {filteredUsers.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                      {filteredUsers.map((user: any) => (
                        <button
                          key={user.id}
                          onClick={() => toggleUserSelection(user.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                            selectedUserIds.includes(user.id)
                              ? 'bg-task-primary/20 border-2 border-task-primary'
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="rounded"
                          />
                          <Avatar size="sm" src={user.profilePhotoUrl || user.profile_photo_url} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.name || user.mobile}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user.mobile}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {searchQuery && !isLoadingUsers && filteredUsers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No users found or all users are already members
                    </p>
                  )}
                  
                  {!searchQuery && !isLoadingUsers && filteredUsers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      Start typing to search for users
                    </p>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddMembers}
                      disabled={selectedUserIds.length === 0 || addMembersMutation.isLoading}
                      className="flex-1 px-4 py-2 bg-task-primary text-white rounded-lg hover:bg-task-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {addMembersMutation.isLoading ? 'Adding...' : `Add ${selectedUserIds.length} Member(s)`}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddMembers(false);
                        setSearchQuery('');
                        setSelectedUserIds([]);
                      }}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="p-6 space-y-6">
                {/* Progress Bar - Design style */}
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Team Progress</p>
                    <p className="text-[10px] font-bold text-task-primary uppercase tracking-tighter">
                      {memberStats ? `${memberStats.completed}/${memberStats.total} Completed` : '0/0 Completed'}
                    </p>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-task-primary rounded-full transition-all duration-300"
                      style={{ width: `${memberStats?.progress ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Assignees List - Design style */}
                {assignees && assignees.length > 0 ? (
                  <div className="space-y-4">
                    {assignees.map((assignee: any) => {
                const assigneeId = assignee.id || assignee.user_id || assignee.userId;
                const currentUserId = user?.id || (user as any)?.userId;
                const isCurrentUser = assigneeId === currentUserId;
                // EXACT mobile logic: memberCompleted checks completed_at (NOT verified_at)
                const memberCompleted =
                  assignee.completed_at ||
                  assignee.completion_status === 'completed' ||
                  assignee.status === 'completed';
                const memberVerified = assignee.verified_at;
                const statusLabel = getMemberStatusLabel(assignee);
                const statusColor = getMemberStatusColor(assignee);
                const isReportingMemberForTask = String(normalizedTask?.reporting_member_id ?? '') === String(assigneeId ?? '');
                const taskCreatorId = normalizedTask?.created_by ?? normalizedTask?.creator_id;
                const reportingMemberId = normalizedTask?.reporting_member_id;

                // EXACT mobile logic: canVerifyMember function (task owner can verify assignees who completed)
                const canVerifyThisMember = (() => {
                  if (isCurrentUser) return false; // Cannot verify yourself
                  if (!memberCompleted || memberVerified) return false; // Must be completed and not verified
                  
                  const isTargetCreator = String(assigneeId ?? '') === String(taskCreatorId ?? '');
                  const isTargetReportingMember = String(assigneeId ?? '') === String(reportingMemberId ?? '');
                  
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
                    className="flex items-center gap-4 group cursor-pointer"
                  >
                    {/* Avatar - Design: rounded-2xl */}
                    <div className="relative flex-shrink-0">
                      {assignee.profile_photo_url || assignee.profile_photo ? (
                        <img
                          src={assignee.profile_photo_url || assignee.profile_photo}
                          alt={assignee.name || 'Assignee'}
                          className="w-12 h-12 rounded-2xl object-cover shadow-sm"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                          style={{ backgroundColor: statusLabel === 'Completed' ? '#2E7D32' : statusLabel === 'In Progress' ? '#7C3AED' : '#6366F1' }}
                        >
                          {(assignee.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {memberCompleted && (
                        <div
                          className="absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm"
                          style={{ backgroundColor: statusColor }}
                        >
                          <span className="material-symbols-outlined text-white text-xs">check</span>
                        </div>
                      )}
                      {isReportingMemberForTask && (
                        <div
                          className="absolute -top-1 -right-1 size-5 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm bg-task-primary"
                        >
                          <span className="material-symbols-outlined text-white text-[10px]">shield</span>
                        </div>
                      )}
                    </div>

                    {/* Details - Design style */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{assignee.name || 'Unknown User'}</p>
                        {isReportingMemberForTask && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded font-bold uppercase">Reporting</span>
                        )}
                        {isCurrentUser && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded font-bold uppercase">(You)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: statusColor }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }}></span>
                        {statusLabel}
                        {memberVerified && ' ✓ Verified'}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {(assignee.mobile || assignee.phone || assignee.email || '—').replace(/^\+91/, '')}
                      </p>
                    </div>

                    {/* Verify button - preserve functionality */}
                    <div className="flex flex-col items-end justify-center gap-2 shrink-0">
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
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_off</span>
                    <p className="text-sm">No assignees for this task</p>
                  </div>
                )}
              </div>
              {/* Summary Footer - Design style */}
              {assignees && assignees.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-100 dark:border-slate-800 flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">group</span>
                    {assignees.length} Total
                  </div>
                  <div className="flex items-center gap-1 text-emerald-500">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    {assignees.filter((a: any) => a.has_accepted || a.accepted_at).length} Accepted
                  </div>
                  <div className="flex items-center gap-1 text-amber-500">
                    <span className="material-symbols-outlined text-xs">schedule</span>
                    {assignees.filter((a: any) => !a.has_accepted && !a.accepted_at).length} Pending
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Finance & Auto Escalation - Left column below Activity Log */}
        {((displayTask.financial_value != null || displayTask.finance_type) && isCreator) && (
          <section className="lg:col-span-2 bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-3">Finance</h3>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {displayTask.finance_type && (
                <span className="text-sm text-slate-600 dark:text-slate-400 uppercase tracking-wide">
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
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {displayTask.finance_type === 'expense' ? '-' : '+'}
                  {Number(displayTask.financial_value).toFixed(2)}
                </span>
              )}
            </div>
          </section>
        )}

        {displayTask.auto_escalate && (
          <section className="lg:col-span-2 bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">warning</span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Auto Escalation Rules</h3>
            </div>
            <div className="p-4">
              <ul className="space-y-4 relative pl-2">
                <div className="absolute left-[15px] top-2 bottom-6 w-0.5 bg-slate-100 dark:bg-slate-700"></div>
                <li className="relative flex gap-4 items-start">
                  <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-white dark:ring-card-dark"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">LEVEL 1</span>
                    <span className="text-sm text-slate-700 dark:text-slate-200">Notify Manager if not accepted within 24h</span>
                  </div>
                </li>
                <li className="relative flex gap-4 items-start">
                  <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-orange-300 dark:bg-orange-500 ring-4 ring-white dark:ring-card-dark"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">LEVEL 2</span>
                    <span className="text-sm text-slate-700 dark:text-slate-200">Escalate to Dept Head if overdue &gt; 2 days</span>
                  </div>
                </li>
              </ul>
            </div>
          </section>
        )}
      </main>

      {/* Action Bar - Design style */}
      {(canAccept || canReject || canMarkComplete || isCreator) && (
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 w-full md:w-auto justify-center md:justify-start">
              {canReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="px-6 py-3.5 rounded-xl border-2 border-rose-100 dark:border-rose-900/30 text-rose-500 font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                  Reject
                </button>
              )}
              {canAccept && (
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="px-12 py-3.5 rounded-xl bg-task-primary hover:bg-task-primary/90 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">check</span>
                      <span>Accept Task</span>
                    </>
                  )}
                </button>
              )}
              {canMarkComplete && (
                <button
                  onClick={handleMarkComplete}
                  disabled={processing}
                  className="px-12 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">check_circle</span>
                      <span>Mark Complete</span>
                    </>
                  )}
                </button>
              )}
              {isCreator && (
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={deleteTaskMutation.isLoading}
                  className="px-6 py-3 border-2 border-rose-100 dark:border-rose-900/30 text-rose-500 font-bold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">delete_outline</span>
                  <span>{deleteTaskMutation.isLoading ? 'Deleting...' : 'Delete Task'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAB - Design style (mobile only) */}
      <button
        type="button"
        className="fixed bottom-6 right-6 w-14 h-14 bg-task-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-transform md:hidden z-40"
        aria-label="Add"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

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
