import React, { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { taskService } from '../../services/taskService';
import { mergeTaskWithFinancial } from '../../utils/taskFinancialStorage';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { conversationService } from '../../services/conversationService';
import { messageService } from '../../services/messageService';
import { Avatar } from '../../components/shared';
import {
  getTaskStatusCategoryFromTask,
  normalizeLifecycleStatus,
  TaskStatusCategory,
} from '../../utils/taskStatus';

interface TaskDetailsScreenProps {
  /** When true, render only the task details content (no layout). Used when embedding in task group gate view. */
  embedded?: boolean;
  /** When embedded, pass taskId from parent (e.g. effectiveTaskId from conversation). */
  taskId?: string;
}

export const TaskDetailsScreen: React.FC<TaskDetailsScreenProps> = ({ embedded = false, taskId: taskIdProp }) => {
  const { taskId: taskIdParam } = useParams<{ taskId: string }>();
  const taskId = embedded ? taskIdProp : taskIdParam;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRejectModal, setShowRejectModal] = useState(location.state?.showReject || false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [hasAcceptedLocally, setHasAcceptedLocally] = useState(false);
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const addMembersRef = useRef<HTMLDivElement>(null);
  const closeAddMembers = useCallback(() => setShowAddMembers(false), []);
  useClickOutside(addMembersRef, closeAddMembers, showAddMembers);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showRequestDeleteModal, setShowRequestDeleteModal] = useState(false);
  const [requestDeleteReason, setRequestDeleteReason] = useState('');
  const [showExitRequestModal, setShowExitRequestModal] = useState(false);
  const [exitRequestComment, setExitRequestComment] = useState('');
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

  // Format date helper (date-only, ignore timezone to avoid off-by-one from UTC)
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      const raw = String(dateString).trim();
      // Plain date (YYYY-MM-DD or YYYY/MM/DD): keep as calendar date, no timezone conversion.
      const plain = raw.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
      if (plain) {
        const y = parseInt(plain[1], 10);
        const m = parseInt(plain[2], 10);
        const d = parseInt(plain[3], 10);
        const date = new Date(y, m - 1, d);
        if (isNaN(date.getTime())) return 'Not set';
        return date.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }

      // Timestamp values from API: format in IST to prevent previous-day shift.
      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) return 'Not set';
      return parsed.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      return 'Not set';
    }
  };

  const isAssigned = normalizedTask?.assignees?.some((a: any) => {
    const aid = a.id || a.user_id || a.userId;
    return aid != null && String(aid) === String(currentUserId);
  });
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

  const isAdminOrSuper = user?.role === 'admin' || user?.role === 'super_admin';
  const canDirectDelete = isCreator || isAdminOrSuper;
  const taskActiveForDelete =
    !!normalizedTask && String(normalizedTask?.status || '').toLowerCase() !== 'rejected';
  const canRequestTaskDelete =
    !!normalizedTask &&
    taskActiveForDelete &&
    !canDirectDelete &&
    (isAssigned || !!currentUserStatus);

  // Accept: persist via backend (so buttons stay hidden after refresh), then post "[Name] accepted the task." in chat.
  const acceptTaskMutation = useMutation(
    async () => {
      if (!taskId) return;
      // 1) Persist acceptance so buttons never show again (accepted_at in DB)
      await taskService.acceptTask(taskId);
      await queryClient.invalidateQueries(['task', taskId]);
      const convId = normalizedTask?.conversation_id || normalizedTask?.conversationId;
      if (convId) {
        const userName = user?.name || (user as any)?.userName || 'User';
        await messageService.sendMessage({
          conversationId: convId,
          conversation_id: convId,
          content: `${userName} accepted the task.`,
          messageType: 'text',
        });
      }
    },
    {
      onSuccess: () => {
        setHasAcceptedLocally(true);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          'Failed to accept task';
        toast.error(message);
      },
    }
  );

  const rejectTaskMutation = useMutation(
    (reason: string) => taskService.rejectTask(taskId!, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (taskId) {
          addRejectedTaskId(taskId);
          removeTaskFromCachedLists(taskId);
        }
        setShowRejectModal(false);
        setRejectionReason('');
        navigate(isAdmin ? '/admin/tasks' : '/tasks');
      },
    }
  );

  const canAccept = false;
  const canReject = false;

  const handleAccept = async () => {
    try {
      setProcessing(true);
      await acceptTaskMutation.mutateAsync();
      toast.success('You accepted the task.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to accept task');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }
    try {
      setProcessing(true);
      await rejectTaskMutation.mutateAsync(rejectionReason.trim());
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to reject task');
    } finally {
      setProcessing(false);
    }
  };

  // Owner: can complete the whole task for everyone anytime before the task is terminal (no assignee completions required).
  const rawTaskStatusUpper = String(normalizedTask?.status || '').toLowerCase();
  const canOwnerForceCompleteTask =
    !!isCreator &&
    !!normalizedTask &&
    rawTaskStatusUpper !== 'completed' &&
    rawTaskStatusUpper !== 'deleted' &&
    rawTaskStatusUpper !== 'rejected';

  const canMarkCompleteAsAssignee =
    !!isAssigned &&
    !isCreator &&
    !hasCompleted &&
    rawTaskStatusUpper !== 'completed';

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
    const lane = normalizeLifecycleStatus(member?.assignee_status);
    const daysUntilDue = getDaysUntilDue(displayTask);
    if (displayTask?.is_before_start_date === true || isBeforeStartDate(displayTask)) return 'Scheduled';
    if (lane === 'scheduled') return 'Scheduled';
    if (lane === 'completed') return 'Completed';
    if (lane === 'overdue') return 'Overdue';
    if (lane === 'duesoon') return 'Due Soon';
    if (lane === 'inprogress') return 'In Progress';
    if (lane === 'todo') return 'TODO';
    if (member.completed_at || member.completion_status === 'completed' || member.status === 'completed') {
      return 'Completed';
    }
    return 'TODO';
  };

  // EXACT mobile logic: getMemberStatusColor shows green if completed_at exists
  const getMemberStatusColor = (member: any) => {
    const lane = normalizeLifecycleStatus(member?.assignee_status);
    const daysUntilDue = getDaysUntilDue(displayTask);
    if (displayTask?.is_before_start_date === true || isBeforeStartDate(displayTask)) return '#6366F1';
    if (lane === 'scheduled') return '#6366F1';
    if (lane === 'completed') return '#2E7D32';
    if (lane === 'overdue') return '#DC2626';
    if (lane === 'duesoon') return '#F59E0B';
    if (lane === 'inprogress') return '#F57C00';
    if (lane === 'todo') return '#9CA3AF';
    if (member.completed_at || member.completion_status === 'completed' || member.status === 'completed') {
      return '#2E7D32'; // Green for completed
    }
    return '#9CA3AF'; // Gray for pending
  };

  const isReportingMember =
    !!normalizedTask && normalizedTask.reporting_member_id === currentUserId;

  // Per-viewer status for details page is still used in some analytics,
  // but it no longer drives Accept / Reject visibility here.

  // Mark current user's assignment as complete (assignees only; owner uses ownerCompleteTask)
  const markCompleteMutation = useMutation(
    () => {
      if (!taskId || !currentUserId) {
        throw new Error('Missing taskId or userId');
      }
      return taskService.markMemberComplete(taskId, currentUserId);
    },
    {
      onSuccess: (data: any) => {
        // Invalidate task-related queries so dashboard and detail reflect the new state
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (isAdmin) {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
        }

        const message = data?.taskCompleted
          ? 'Task completed. The entire task has been marked as completed.'
          : 'Your completion has been marked.';
        toast.success(message);

        // Always go back to dashboard and animate lifecycle movement.
        // Even when verification is pending, the viewer's assignee status becomes "completed"
        // and the card should move to Completed in the dashboard.
        const dashboardPath = isAdmin ? '/admin' : '/dashboard';

        navigate(dashboardPath, {
          state: {
            animateTaskTransition: true,
            taskId,
            fromStatus: 'inprogress',
            toStatus: 'completed',
            taskSection: 'self',
          },
        });
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          'Failed to mark completion';
        toast.error(message);
      },
    }
  );

  // "Mark as In Progress" mutation (must be declared before any early returns to keep hook order stable)
  const markInProgressMutation = useMutation(
    () => taskService.updateTaskStatus(taskId!, 'in_progress'),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (isAdmin) {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
        }
        toast.success('Task moved to In Progress.');

        // Navigate back to dashboard with transition animation (TODO → In Progress)
        const assigneeIds = (assignees || []).map((a: any) => a?.id || a?.user_id || a?.userId).filter(Boolean);
        const hasOtherAssignees = !!currentUserId && assigneeIds.some((id: any) => String(id) !== String(currentUserId));
        const taskSection: 'self' | 'assigned' = isCreator && hasOtherAssignees ? 'assigned' : 'self';
        const dashboardPath = isAdmin ? '/admin' : '/dashboard';
        navigate(dashboardPath, {
          state: {
            animateTaskTransition: true,
            taskId,
            fromStatus: 'todo',
            toStatus: 'inprogress',
            taskSection,
          },
        });
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.error ||
          error?.message ||
          'Failed to move task to In Progress';
        toast.error(message);
      },
    }
  );

  const ownerCompleteMutation = useMutation(() => taskService.ownerCompleteTask(taskId!), {
    onSuccess: (data: any) => {
      queryClient.invalidateQueries(['task', taskId]);
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['dashboard-statistics']);
      if (isAdmin) {
        queryClient.invalidateQueries(['admin-dashboard']);
        queryClient.invalidateQueries(['admin-dashboard-statistics']);
      }

      const message = data?.already_completed
        ? 'This task is already marked completed.'
        : 'Task completed. The entire task has been marked as completed.';
      toast.success(message);

      const dashboardPath = isAdmin ? '/admin' : '/dashboard';
      navigate(dashboardPath, {
        state: {
          animateTaskTransition: true,
          taskId,
          fromStatus: 'inprogress',
          toStatus: 'completed',
          taskSection: 'self',
        },
      });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error || error?.message || 'Failed to complete task'
      );
    },
  });

  const handleOwnerCompleteTask = () => {
    if (!taskId) return;
    toast.confirm(
      'This will mark the task completed for everyone, even if members have not finished their part. Continue?',
      {
        onConfirm: async () => {
          try {
            setProcessing(true);
            await ownerCompleteMutation.mutateAsync();
          } finally {
            setProcessing(false);
          }
        },
        confirmLabel: 'Yes',
        cancelLabel: 'Cancel',
      }
    );
  };

  const handleMarkComplete = () => {
    if (!taskId || !currentUserId) return;
    toast.confirm(
      'Have you completed your part of this task? Your completion will need to be verified.',
      {
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
      }
    );
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
          // Navigate back to dashboard with transition animation (In Progress → Completed)
          const dashboardPath = isAdmin ? '/admin' : '/dashboard';
          navigate(dashboardPath, {
            state: {
              animateTaskTransition: true,
              taskId,
              fromStatus: 'inprogress',
              toStatus: 'completed',
              taskSection: 'self',
            },
          });
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

  const requestTaskDeleteMutation = useMutation(
    (reason: string) => taskService.requestTaskDelete(taskId!, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (isAdmin) {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
        }
        toast.success(
          'Your deletion request was sent to the task owner. It will also appear in the task group chat.'
        );
        setShowRequestDeleteModal(false);
        setRequestDeleteReason('');
      },
      onError: (error: any) => {
        toast.error(
          error?.response?.data?.error || error?.message || 'Failed to send delete request'
        );
      },
    }
  );

  const createExitRequestMutation = useMutation(
    (comment: string) => taskService.createExitRequest(taskId!, comment),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        queryClient.invalidateQueries(['conversations']);
        if (isAdmin) {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
        }
        toast.success('Exit request submitted');
        setShowExitRequestModal(false);
        setExitRequestComment('');
        navigate(isAdmin ? `/admin/tasks/${taskId}/chat` : `/tasks/${taskId}/chat`);
      },
      onError: (error: any) => {
        toast.error(error?.response?.data?.error || error?.message || 'Failed to submit exit request');
      },
    }
  );

  // Delete task (owner / admin / super_admin)
  const deleteTaskMutation = useMutation(
    () => taskService.deleteTask(taskId!),
    {
      onSuccess: () => {
        const deletedId = taskId!;
        queryClient.removeQueries(['task', deletedId]);
        queryClient.setQueryData('tasks', (old: any) =>
          Array.isArray(old) ? old.filter((t: any) => t?.id !== deletedId) : old
        );
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['conversations']);
        queryClient.invalidateQueries(['conversation-details']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        queryClient.invalidateQueries(['admin-dashboard']);
        queryClient.invalidateQueries(['admin-dashboard-statistics']);
        void queryClient.refetchQueries({ queryKey: ['admin-dashboard'] });
        void queryClient.refetchQueries({ queryKey: ['admin-dashboard-statistics'] });
        void queryClient.refetchQueries({ queryKey: ['dashboard'] });
        void queryClient.refetchQueries({ queryKey: ['dashboard-statistics'] });
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
    if (!taskId || !canDirectDelete) return;
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

  const handleSubmitRequestDelete = async () => {
    const r = requestDeleteReason.trim();
    if (!r || !taskId) {
      toast.error('Please enter a reason for the deletion request.');
      return;
    }
    try {
      await requestTaskDeleteMutation.mutateAsync(r);
    } catch {
      // onError
    }
  };

  const handleSubmitExitRequest = async () => {
    const comment = exitRequestComment.trim();
    if (!comment || !taskId) {
      toast.error('Please enter a comment for your exit request.');
      return;
    }
    try {
      await createExitRequestMutation.mutateAsync(comment);
    } catch {
      // onError handled in mutation
    }
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
    ['org-contacts', 'task-details-add-members'],
    () => conversationService.getOrgContacts(),
    { enabled: showAddMembers }
  );

  // Filter out users who are already assignees
  const availableUsers = React.useMemo(() => {
    if (!allUsers || !assignees) return [];
    const assigneeIds = assignees.map((a: any) => a.id || a.user_id || a.userId).filter(Boolean);
    return allUsers.filter((u: any) => !assigneeIds.includes(u.id));
  }, [allUsers, assignees]);

  const filteredUsers = React.useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return availableUsers;
    return availableUsers.filter(
      (u: any) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.mobile || u.phone || '').toString().toLowerCase().includes(q)
    );
  }, [availableUsers, searchQuery]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Add members mutation – use task assignee API so behavior matches mobile
  const addMembersMutation = useMutation(
    (memberIds: string[]) => {
      if (!taskId) {
        throw new Error('Missing taskId');
      }
      return taskService.addTaskAssignees(taskId, memberIds);
    },
    {
      onSuccess: () => {
        if (taskId) {
          queryClient.invalidateQueries(['task', taskId]);
        }
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries(['conversations', 'task']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (isAdmin) {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
        }
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

  // Mobile parity: in task details, status shown to the viewer should match their lane
  // (and match how member rows derive "TODO / In Progress / Completed").
  const isBeforeStartDate = (t: any) => {
    const rawStart = t?.start_date ?? t?.startDate;
    if (!rawStart) return false;
    try {
      const start = new Date(rawStart);
      return new Date() < start;
    } catch {
      return false;
    }
  };

  const getDaysUntilDue = (t: any) => {
    const due = t?.due_date ?? t?.dueDate;
    if (!due) return null;
    const dueDate = new Date(due);
    if (isNaN(dueDate.getTime())) return null;
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getViewerStatusCategory = (t: any): TaskStatusCategory =>
    getTaskStatusCategoryFromTask(t, 3, currentUserId) ?? 'todo';

  // Viewer-scoped status category (drives header badge, timeline and controls)
  const globalStatus = getViewerStatusCategory(displayTask) as TaskStatusCategory;
  React.useEffect(() => {
    if (!displayTask?.id) return;
    if (String(displayTask.id) !== '21b9036f-8eeb-4b7d-b12f-b09246705ef9') return;
    console.log('[TaskStatusDebug][details][globalIndicator]', {
      taskId: displayTask.id,
      currentUserId,
      currentUserAssigneeStatus: displayTask?.current_user_status?.assignee_status,
      assignees: Array.isArray(displayTask?.assignees)
        ? displayTask.assignees.map((a: any) => ({
            id: a?.id || a?.user_id || a?.userId,
            assignee_status: a?.assignee_status,
            accepted_at: a?.accepted_at,
            completed_at: a?.completed_at,
            verified_at: a?.verified_at,
          }))
        : [],
      status: displayTask?.status,
      due_date: displayTask?.due_date,
      is_before_start_date: displayTask?.is_before_start_date,
      resolved: globalStatus,
    });
  }, [displayTask, currentUserId, globalStatus]);

  const heroStatusLabel = (() => {
    switch (globalStatus) {
      case 'scheduled':
        return 'Scheduled';
      case 'todo':
        return 'TODO';
      case 'inprogress':
        return 'In Progress';
      case 'duesoon':
        return 'Due Soon';
      case 'overdue':
        return 'Overdue';
      case 'completed':
        return 'Completed';
      default:
        return 'TODO';
    }
  })();

  const getHeroBadgeClass = () => {
    switch (globalStatus) {
      case 'scheduled':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'todo':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'inprogress':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'duesoon':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'overdue':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  const currentStatusLabel = heroStatusLabel;
  const statusPlacement = React.useMemo(() => {
    if (globalStatus === 'todo' || globalStatus === 'inprogress') {
      return { startToTarget: currentStatusLabel, targetToDue: '', afterDue: '' };
    }
    if (globalStatus === 'duesoon') {
      return { startToTarget: '', targetToDue: currentStatusLabel, afterDue: '' };
    }
    if (globalStatus === 'overdue') {
      return { startToTarget: '', targetToDue: '', afterDue: currentStatusLabel };
    }
    if (globalStatus === 'completed') {
      const completedAtRaw =
        (displayTask as any)?.current_user_status?.completed_at ||
        displayTask?.completed_at ||
        null;
      const dueDateRaw = displayTask?.due_date || null;
      const completedAt = completedAtRaw ? new Date(completedAtRaw).getTime() : null;
      const dueAt = dueDateRaw ? new Date(dueDateRaw).getTime() : null;
      const completedAfterDue =
        completedAt != null && dueAt != null ? completedAt > dueAt : false;
      return completedAfterDue
        ? { startToTarget: '', targetToDue: '', afterDue: currentStatusLabel }
        : { startToTarget: '', targetToDue: currentStatusLabel, afterDue: '' };
    }
    return { startToTarget: '', targetToDue: '', afterDue: '' };
  }, [globalStatus, currentStatusLabel, displayTask]);

  // Explicit "Mark as In Progress" action (mirrors mobile In Progress control).
  // Only available while the task is still in TODO for the current user.
  const canMarkInProgress =
    !!taskId &&
    isAssigned &&
    !hasRejected &&
    globalStatus === 'todo';

  const canExitWithComments =
    !!normalizedTask &&
    !!taskId &&
    isAssigned &&
    !isCreator &&
    hasAccepted &&
    String(normalizedTask?.status || '').toLowerCase() !== 'rejected';

  const showActionBar = canAccept || canReject;

  const content = (
    <div
      className={`p-0 font-task bg-background-light dark:bg-background-dark ${
        embedded ? 'min-h-0 h-full' : 'min-h-screen'
      }`}
    >

      <main
        className={`max-w-5xl mx-auto ${
          embedded ? 'py-2 px-3 space-y-3' : 'py-4 px-4 space-y-4'
        }`}
      >
        {/* Hero: Title + Status (Design style) */}
        <section
          className={`bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 ${
            embedded ? 'p-4' : 'p-8'
          }`}
        >
          <div className="flex flex-col gap-6">
            <div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full mb-3 inline-block ${getHeroBadgeClass()}`}>
                {heroStatusLabel}
              </span>
              <h2
                className={`font-bold text-slate-900 dark:text-white tracking-tight ${
                  embedded ? 'text-xl' : 'text-3xl'
                }`}
              >
                {displayTask.title}
              </h2>
              {displayTask.client_name && (
                <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm font-medium">
                  Client: <span className="font-bold text-slate-900 dark:text-white">{displayTask.client_name}</span>
                </p>
              )}
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
            <div className="pt-2">
              <div className="grid grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto] items-center gap-2">
                  <span className="h-4 w-4 rounded-full bg-task-primary border-2 border-white dark:border-card-dark shadow-sm" />
                  <div className="relative h-[2px] bg-slate-200 dark:bg-slate-700">
                    {statusPlacement.startToTarget ? (
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card-light dark:bg-card-dark px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        {statusPlacement.startToTarget}
                      </span>
                    ) : null}
                  </div>
                  <span className="h-4 w-4 rounded-full bg-task-primary border-2 border-white dark:border-card-dark shadow-sm" />
                  <div className="relative h-[2px] bg-slate-200 dark:bg-slate-700">
                    {statusPlacement.targetToDue ? (
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card-light dark:bg-card-dark px-1.5 text-[10px] font-bold text-task-primary whitespace-nowrap">
                        {statusPlacement.targetToDue}
                      </span>
                    ) : null}
                  </div>
                  <span className="h-4 w-4 rounded-full bg-task-primary border-2 border-white dark:border-card-dark shadow-sm" />
                  <div className="relative h-[2px] bg-slate-200 dark:bg-slate-700">
                    {statusPlacement.afterDue ? (
                      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card-light dark:bg-card-dark px-1.5 text-[10px] font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap">
                        {statusPlacement.afterDue}
                      </span>
                    ) : null}
                  </div>
                  <span className="h-4 w-4 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-card-dark" />
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
            {/* Open group chat: available when a task group conversation exists */}
            {(displayTask.conversation_id || displayTask.conversationId) && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => navigate(isAdmin ? `/admin/messages/task-group/${displayTask.conversation_id || displayTask.conversationId}` : `/messages/task-group/${displayTask.conversation_id || displayTask.conversationId}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-task-primary/10 text-task-primary font-semibold text-sm hover:bg-task-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">forum</span>
                  Open group chat
                </button>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-3">
            {/* Description Card */}
            {displayTask.description && (
              <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-2">Description</h3>
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-base">{displayTask.description}</p>
              </section>
            )}

            {/* Related document */}
            {(displayTask.document_instance_id || (displayTask as any).documentInstanceId) && (
              <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3">
                <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-2">Related document</h3>
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

            {/* Task Members - full width, horizontal layout */}
            <section className="w-full bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" ref={addMembersRef}>
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
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
              <div className="px-4 py-3 space-y-3">
                {/* Progress Bar - Design style */}
                <div>
                  <div className="flex justify-between items-end mb-1.5">
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

                {/* Assignees List - horizontal cards */}
                {assignees && assignees.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{assignee.name || 'Unknown User'}</p>
                        {isReportingMemberForTask && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded font-bold uppercase">Reporting</span>
                        )}
                        {isCurrentUser && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded font-bold uppercase">(You)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: statusColor }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }}></span>
                        <span className="truncate">
                          {statusLabel}
                          {memberVerified && ' ✓ Verified'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {(assignee.mobile || assignee.phone || assignee.email || '—').replace(/^\+91/, '')}
                      </p>
                    </div>
                    </div>

                    {/* Verify / Reassign actions */}
                    <div className="flex flex-wrap items-center gap-2">
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
                      {/* Reassign button (creator / reporting member only, member completed but not verified) */}
                      {memberCompleted && !memberVerified && (isCreator || isReportingMember) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (!taskId) return;
                            toast.confirm(
                              `Reassign this task back to ${assignee.name || 'this member'}? They will need to complete it again.`,
                              {
                                confirmLabel: 'Reassign',
                                cancelLabel: 'Cancel',
                                onConfirm: async () => {
                                  try {
                                    setProcessing(true);
                                    await taskService.reassignMember(taskId, assigneeId);
                                    queryClient.invalidateQueries(['task', taskId]);
                                    queryClient.invalidateQueries('tasks');
                                    queryClient.invalidateQueries(['dashboard']);
                                    queryClient.invalidateQueries(['dashboard-statistics']);
                                    if (isAdmin) {
                                      queryClient.invalidateQueries(['admin-dashboard']);
                                      queryClient.invalidateQueries(['admin-dashboard-statistics']);
                                    }
                                    toast.success('Member has been reassigned for this task.');
                                  } catch (error: any) {
                                    const message =
                                      error?.response?.data?.error ||
                                      error?.message ||
                                      'Failed to reassign member';
                                    toast.error(message);
                                  } finally {
                                    setProcessing(false);
                                  }
                                },
                              }
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">
                            replay
                          </span>
                          <span>Reassign</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_off</span>
                    <p className="text-sm">No assignees for this task</p>
                  </div>
                )}
              </div>

              {/* Activity Log - directly below members in same card */}
              <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3">
              <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-2">Activity Log</h3>
              <div className="space-y-2">
                {displayTask.activities && displayTask.activities.length > 0 ? (
                  displayTask.activities.slice(0, 5).map((activity: any) => (
                    <div key={activity.id} className="flex justify-between items-start gap-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {activity.message || `${activity.activity_type} - ${activity.new_value || ''}`}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(activity.created_at)}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-start gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Task &quot;{displayTask.title}&quot; created{isCreator ? ' (self task - auto started)' : ''}
                    </p>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(displayTask.created_at)}</span>
                  </div>
                )}
              </div>
              </div>
            </section>

        {/* Finance & Auto Escalation */}
        {((displayTask.financial_value != null || displayTask.finance_type) && isCreator) && (
          <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3">
            <h3 className="text-xs font-bold text-task-primary uppercase tracking-widest mb-2">Finance</h3>
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
          <section className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
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
        </div>
      </main>

      {/* Action Bar - Design style */}
      {showActionBar && (
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-card-light dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 w-full md:w-auto justify-center md:justify-start">
              {canAccept && (
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={processing || acceptTaskMutation.isLoading}
                  className="px-12 py-3.5 bg-task-primary hover:opacity-90 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {processing && acceptTaskMutation.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Accepting...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">thumb_up</span>
                      <span>Accept</span>
                    </>
                  )}
                </button>
              )}
              {canReject && (
                <button
                  type="button"
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="px-12 py-3.5 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-xl">thumb_down</span>
                  <span>Reject</span>
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

      {/* Request task deletion (assignee → owner, same as mobile) */}
      {showRequestDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-delete-title"
          onClick={() => {
            setShowRequestDeleteModal(false);
            setRequestDeleteReason('');
          }}
        >
          <div
            className="bg-card-light dark:bg-card-dark rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="request-delete-title" className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Request task deletion
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              Only the task owner can delete this task. Send a request with a short reason — the owner is notified and it appears in the task group chat.
            </p>
            <textarea
              value={requestDeleteReason}
              onChange={(e) => setRequestDeleteReason(e.target.value)}
              placeholder="Reason (required)..."
              rows={4}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-task-primary focus:border-transparent"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowRequestDeleteModal(false);
                  setRequestDeleteReason('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRequestDelete}
                disabled={requestTaskDeleteMutation.isLoading || !requestDeleteReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50"
              >
                {requestTaskDeleteMutation.isLoading ? 'Sending...' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit with comments (assignee -> owner) */}
      {showExitRequestModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-request-title"
          onClick={() => {
            setShowExitRequestModal(false);
            setExitRequestComment('');
          }}
        >
          <div
            className="bg-card-light dark:bg-card-dark rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="exit-request-title" className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Exit with comments
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              Share why you are requesting to exit this task. The task owner will review it in task chat.
            </p>
            <textarea
              value={exitRequestComment}
              onChange={(e) => setExitRequestComment(e.target.value)}
              placeholder="Comment (required)..."
              rows={4}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-task-primary focus:border-transparent"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowExitRequestModal(false);
                  setExitRequestComment('');
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitExitRequest}
                disabled={createExitRequestMutation.isLoading || !exitRequestComment.trim()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-50"
              >
                {createExitRequestMutation.isLoading ? 'Sending...' : 'Send request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          onClick={() => {
            setShowRejectModal(false);
            setRejectionReason('');
          }}
        >
          <div
            className="bg-card-light dark:bg-card-dark rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reject-modal-title" className="text-lg font-bold text-slate-900 dark:text-white mb-2">Reject task</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">Please provide a reason for rejecting this task.</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-task-primary focus:border-transparent"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setShowRejectModal(false); setRejectionReason(''); }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim() || rejectTaskMutation.isLoading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium disabled:opacity-50"
              >
                {rejectTaskMutation.isLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // When embedded (e.g. in task group gate view), render only content — no layout
  if (embedded) {
    return <>{content}</>;
  }

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
