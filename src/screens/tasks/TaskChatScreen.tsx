import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { taskService } from '../../services/taskService';
import { conversationService } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';
import { TaskGroupChatConversation } from '../messaging/TaskGroupChatConversation';

export const TaskChatScreen: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || location.pathname.startsWith('/admin');
  const [conversationId, setConversationId] = useState<string | null>(null);

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
        alert(error.response?.data?.error || 'Failed to create task group conversation');
      }
    }
  );

  // Effect to create conversation if it doesn't exist
  useEffect(() => {
    if (isLoadingTask || taskError || !task || !taskId) return;

    // If conversation_id exists, use it
    if (taskConversationId) {
      setConversationId(taskConversationId);
      return;
    }

    // If no conversation_id and not already creating, create one
    if (!conversationId && !createConversationMutation.isLoading && !createConversationMutation.isSuccess) {
      createConversationMutation.mutate();
    }
  }, [task, taskConversationId, isLoadingTask, taskError, taskId, conversationId, createConversationMutation]);

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

  // If we have a conversation ID, render the chat component
  if (conversationId) {
    return <TaskGroupChatConversation conversationId={conversationId} />;
  }

  // Fallback (shouldn't reach here normally)
  return null;
};
