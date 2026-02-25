import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { taskService } from '../../services/taskService';
import { conversationService } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { TaskGroupChatConversation } from '../messaging/TaskGroupChatConversation';

export const TaskChatScreen: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || location.pathname.startsWith('/admin');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Fetch task
  const { data: taskData, isLoading: isLoadingTask, error: taskError } = useQuery(
    ['task', taskId],
    () => taskService.getTask(taskId!),
    { enabled: !!taskId }
  );

  const task = taskData;

  // Normalize assignees
  const assignees = useMemo(() => {
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

  const currentUserId = user?.id || (user as any)?.userId;

  // Current user's relationship to the task
  const isAssigned = useMemo(() => {
    if (!assignees || !currentUserId) return false;
    return assignees.some((a: any) => {
      const assigneeId = a.id || a.user_id || a.userId;
      return assigneeId === currentUserId;
    });
  }, [assignees, currentUserId]);

  const currentUserStatus = (task as any)?.current_user_status;
  const hasAccepted = !!(currentUserStatus?.has_accepted);
  const isCreator =
    !!task &&
    !!currentUserId &&
    ((task as any).created_by === currentUserId ||
      (task as any).creator_id === currentUserId);

  // **Access rule**: task group chat is available only after user accepts the task,
  // except the creator who always has access.
  const canAccessChat = isCreator || (isAssigned && hasAccepted);

  // Accept / Reject mutations (same backend flow as TaskDetailsScreen)
  const acceptTaskMutation = useMutation(
    () => taskService.acceptTask(taskId!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        queryClient.invalidateQueries(['admin-dashboard']);
        queryClient.invalidateQueries(['admin-dashboard-statistics']);
        const dashboardPath = isAdmin ? '/admin' : '/dashboard';
        navigate(dashboardPath, {
          state: {
            animateTaskTransition: true,
            taskId: taskId,
            fromStatus: 'todo',
            toStatus: 'inprogress',
            taskSection: isCreator ? 'self' : 'assigned',
          },
        });
      },
    }
  );

  const rejectTaskMutation = useMutation(
    (reason: string) => taskService.rejectTask(taskId!, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        setShowReject(false);
        setRejectionReason('');
      },
    }
  );

  const handleAccept = async () => {
    try {
      setProcessing(true);
      await acceptTaskMutation.mutateAsync();
    } catch (error: any) {
      const message =
        error?.response?.data?.error || error?.message || 'Failed to accept task';
      toast.error(message);
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
      const message =
        error?.response?.data?.error || error?.message || 'Failed to reject task';
      toast.error(message);
    } finally {
      setProcessing(false);
    }
  };

  // Extract conversation_id from task
  const taskConversationId = task?.conversation_id || task?.conversationId || null;

  // Update local state when task conversation_id is available
  useEffect(() => {
    if (taskConversationId) {
      setConversationId(taskConversationId);
    }
  }, [taskConversationId]);

  // Create task group conversation mutation
  const createConversationMutation = useMutation(
    async () => {
      if (!task || !taskId) throw new Error('Task not found');

      // Get assignee IDs
      const memberIds = assignees
        .map((assignee: any) => assignee.id || assignee.user_id || assignee.userId)
        .filter((id: string) => id && id !== (user?.id || user?.userId)); // Exclude current user

      // Include current user (creator) - if no assignees, conversation will have just the creator
      const currentUserId = user?.id || user?.userId;
      const allMemberIds = currentUserId ? [currentUserId, ...memberIds] : memberIds;

      // If no members at all, use creator as the only member
      if (allMemberIds.length === 0) {
        const creatorId = task.created_by || task.creator_id;
        if (creatorId) {
          allMemberIds.push(creatorId);
        } else if (currentUserId) {
          allMemberIds.push(currentUserId);
        }
      }

      // Create conversation
      const conversationName = `Task: ${task.title || 'Untitled Task'}`;
      const newConversationId = await conversationService.createTaskGroupConversation(
        taskId,
        conversationName,
        allMemberIds
      );

      return newConversationId;
    },
    {
      onSuccess: (newConversationId) => {
        // Set the conversation ID to render the chat
        setConversationId(newConversationId);
        // Invalidate task query to refetch with conversation_id
        queryClient.invalidateQueries(['task', taskId]);
      },
      onError: (error: any) => {
        console.error('Failed to create task group conversation:', error);
        toast.error(error.response?.data?.error || 'Failed to create task group conversation');
      }
    }
  );

  // Effect to create conversation if it doesn't exist
  useEffect(() => {
    if (isLoadingTask || taskError || !task || !taskId) return;

    // If user is not allowed to access chat yet, never create or load the conversation
    if (!canAccessChat) {
      return;
    }

    // If conversation_id exists, use it
    if (taskConversationId) {
      setConversationId(taskConversationId);
      return;
    }

    // If no conversation_id and not already creating, create one
    if (
      !conversationId &&
      !createConversationMutation.isLoading &&
      !createConversationMutation.isSuccess
    ) {
      createConversationMutation.mutate();
    }
  }, [
    task,
    taskConversationId,
    isLoadingTask,
    taskError,
    taskId,
    conversationId,
    createConversationMutation,
    canAccessChat,
  ]);

  // Loading state
  if (isLoadingTask || (createConversationMutation.isLoading && !conversationId)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            {isLoadingTask ? 'Loading task...' : 'Creating task group chat...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (taskError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <span className="material-icons-outlined text-6xl text-red-500 mb-4">error_outline</span>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Failed to load task</p>
          <button
            onClick={() => navigate(isAdmin ? '/admin/tasks' : '/tasks')}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Back to Tasks
          </button>
        </div>
      </div>
    );
  }

  // If user is not allowed into the group yet, show guard screen
  if (!canAccessChat) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="mb-3 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-amber-500">
              lock
            </span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 text-center">
            Task group not available yet
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
            You must accept this task before you can access the task group chat.
          </p>

          {/* Quick Accept / Reject actions for assignee */}
          {isAssigned && !hasAccepted && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {processing && acceptTaskMutation.isLoading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base mr-1">
                        check
                      </span>
                      Accept Task
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReject(true)}
                  disabled={processing}
                  className="flex-1 inline-flex items-center justify-center rounded-lg border border-red-500/60 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base mr-1">
                    close
                  </span>
                  Reject
                </button>
              </div>

              {/* Reject reason input */}
              {showReject && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 text-left">
                    Rejection reason
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/60"
                    placeholder="Enter reason for rejecting this task..."
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReject(false);
                        setRejectionReason('');
                      }}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={!rejectionReason.trim() || processing}
                      className="inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {processing && rejectTaskMutation.isLoading ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fallback navigation if user is not assigned (e.g. viewer) */}
          {!isAssigned && (
            <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() =>
                  navigate(isAdmin ? `/admin/tasks/${taskId}` : `/tasks/${taskId}`)
                }
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
              >
                View Task Details
              </button>
              <button
                type="button"
                onClick={() => navigate(isAdmin ? '/admin/tasks' : '/tasks')}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back to Tasks
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If we have a conversation ID, render the chat component
  if (conversationId) {
    return <TaskGroupChatConversation conversationId={conversationId} />;
  }

  // Fallback (shouldn't reach here normally)
  return null;
};
