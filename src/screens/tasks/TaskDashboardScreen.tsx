import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueries, useQueryClient, useMutation } from 'react-query';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { masterDataService, TaskServiceItem } from '../../services/masterDataService';
import { waitForSocketConnection } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { TaskGroupChatConversation } from '../messaging/TaskGroupChatConversation';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';
import { taskBulkService } from '../../services/taskBulkService';
import { isTaskDeleted } from '../../utils/taskUtils';
import { format } from 'date-fns';

/**
 * Derive task list status from task details (from getTask).
 * Mirrors Task Details page logic: "In Progress" = any assignee has accepted (has_accepted / accepted_at).
 */
function getTaskStatusCategory(task: any): StatusFilter | null {
  if (!task) return null;
  const status = (task.status || '').toLowerCase().replace(/\s+/g, '_');
  const due = task.due_date || task.dueDate;
  const now = Date.now();

  if (status === 'completed') return 'completed';
  if (due && new Date(due).getTime() < now) return 'overdue';
  if (due) {
    const daysUntil = (new Date(due).getTime() - now) / 86400000;
    if (daysUntil >= 0 && daysUntil <= 3) return 'duesoon';
  }
  // In Progress: task-level status OR any assignee has accepted (same as Task Details page)
  if (status === 'inprogress' || status === 'in_progress') return 'inprogress';
  const statusForUser = task.current_user_status || task.currentUserStatus || {};
  if (statusForUser.has_accepted || statusForUser.accepted_at) return 'inprogress';
  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  const anyAccepted = assignees.some(
    (a: any) => a.accepted_at || a.has_accepted
  );
  if (anyAccepted) return 'inprogress';
  return 'todo';
}

const STATUS_LABELS: Record<Exclude<StatusFilter, 'all'>, string> = {
  todo: 'To Do',
  inprogress: 'In Progress',
  duesoon: 'Due Soon',
  overdue: 'Overdue',
  completed: 'Completed',
};
const STATUS_ICONS: Record<Exclude<StatusFilter, 'all'>, string> = {
  todo: 'today',
  inprogress: 'pending_actions',
  duesoon: 'schedule',
  overdue: 'priority_high',
  completed: 'task_alt',
};
const STATUS_COLORS: Record<Exclude<StatusFilter, 'all'>, string> = {
  todo: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  inprogress: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  duesoon: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  completed: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};

export type StatusFilter = 'all' | 'todo' | 'overdue' | 'duesoon' | 'inprogress' | 'completed';

export const TaskDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId: selectedConversationId } = useParams<{ conversationId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const isAdminOrSuperAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloadingTaskTemplate, setIsDownloadingTaskTemplate] = useState(false);
  const [isBulkUploadingTasks, setIsBulkUploadingTasks] = useState(false);
  const bulkTaskFileInputRef = useRef<HTMLInputElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const socketRef = React.useRef<any>(null);

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

  // Filter suggestions by search query (e.g. "G" or "GS" -> GSTR 1, GSTR 9)
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allTaskServices.filter((s) => (s.title || '').toLowerCase().includes(q));
  }, [searchQuery, allTaskServices]);

  // Status filter from URL (dashboard card navigation) or local state
  const statusFromUrl = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const v = (statusFromUrl || '').toLowerCase();
    if (v === 'todo' || v === 'overdue' || v === 'duesoon' || v === 'inprogress' || v === 'completed') return v;
    return 'all';
  });

  // Sync filter from URL when navigating from dashboard (e.g. /tasks?status=todo)
  useEffect(() => {
    const v = (searchParams.get('status') || '').toLowerCase();
    if (v === 'todo' || v === 'overdue' || v === 'duesoon' || v === 'inprogress' || v === 'completed') {
      setStatusFilter(v);
    } else {
      setStatusFilter('all');
    }
  }, [searchParams]);

  // Fetch conversations (all conversations)
  const { data: conversations = [] } = useQuery(
    'conversations',
    () => conversationService.getConversations(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Fetch tasks directly (to show newly assigned tasks that might not have conversations yet)
  const { data: directTasks = [] } = useQuery(
    'tasks',
    () => taskService.getTasks(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Filter to only task groups
  const taskGroups = useMemo(() => {
    return conversations.filter(conv => conv.isTaskGroup || conv.is_task_group);
  }, [conversations]);

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

  // Unique task IDs to fetch task details
  const uniqueTaskIds = useMemo(
    () => [...new Set(Object.values(taskIdByConvId).filter(Boolean))],
    [taskIdByConvId]
  );

  // Fetch task details for each task (status comes from task details)
  const taskDetailsQueries = useQueries(
    uniqueTaskIds.map((taskId) => ({
      queryKey: ['task', taskId],
      queryFn: () => taskService.getTask(taskId),
      enabled: !!taskId,
    }))
  );

  // Map convId -> task (from task details). Use string keys so lookups work whether conv.id is number or string.
  const taskByConvId = useMemo(() => {
    const taskByTaskId: Record<string, any> = {};
    uniqueTaskIds.forEach((taskId, i) => {
      const data = taskDetailsQueries[i]?.data;
      if (data) taskByTaskId[taskId] = data;
    });
    const map: Record<string, any> = {};
    Object.entries(taskIdByConvId).forEach(([convId, taskId]) => {
      if (taskByTaskId[taskId]) map[String(convId)] = taskByTaskId[taskId];
    });
    return map;
  }, [taskIdByConvId, uniqueTaskIds, taskDetailsQueries]);

  // Get task IDs that already have conversations
  const tasksWithConversations = useMemo(() => {
    return new Set(Object.values(taskIdByConvId).filter(Boolean));
  }, [taskIdByConvId]);

  // Get tasks without conversations (newly assigned tasks)
  const tasksWithoutConversations = useMemo(() => {
    if (!Array.isArray(directTasks)) return [];
    const currentUserId = user?.id || (user as any)?.userId;
    let filtered = directTasks.filter((task: any) => {
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
        const descMatch = task.description?.toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((task: any) => {
        const category = getTaskStatusCategory(task);
        return category === statusFilter;
      });
    }

    // Sort by created date (newest first)
    return filtered.sort((a: any, b: any) => {
      const aTime = new Date(a.created_at || a.createdAt || 0).getTime();
      const bTime = new Date(b.created_at || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [directTasks, tasksWithConversations, user, searchQuery, statusFilter]);

  // Filter task groups by search and by status (using task details). Hide deleted tasks from list (still visible in Messages with deleted indicator).
  const filteredTaskGroups = useMemo(() => {
    let filtered = taskGroups.filter(conv => {
      const convId = conv.id ?? conv.conversationId;
      const key = convId != null ? String(convId) : '';
      const task = key ? taskByConvId[key] : undefined;
      return !task || !isTaskDeleted(task);
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
        return nameMatch || lastMessageMatch || memberMatch;
      });
    }

    // Apply status filter using task details
    if (statusFilter !== 'all') {
      filtered = filtered.filter(conv => {
        const convId = conv.id ?? conv.conversationId;
        const key = convId != null ? String(convId) : '';
        const task = key ? taskByConvId[key] : undefined;
        const category = getTaskStatusCategory(task);
        return category === statusFilter;
      });
    }

    // Sort: pinned first, then by last message time
    return filtered.sort((a, b) => {
      const aPinned = a.isPinned || a.is_pinned || false;
      const bPinned = b.isPinned || b.is_pinned || false;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      const aTime = new Date(a.lastMessageTime || a.last_message_time || 0).getTime();
      const bTime = new Date(b.lastMessageTime || b.last_message_time || 0).getTime();
      return bTime - aTime;
    });
  }, [taskGroups, searchQuery, statusFilter, taskByConvId]);

  // Update conversation with new message (matching mobile pattern)
  const updateConversationWithNewMessage = (message: any) => {
    if (!message.conversation_id || !message.id) {
      console.warn('⚠️ Invalid message received, skipping:', message);
      return;
    }

    queryClient.setQueryData('conversations', (oldData: any[] = []) => {
      const conversationId = message.conversation_id;
      const conversationIndex = oldData.findIndex(
        (conv: any) => (conv.id || conv.conversationId) === conversationId
      );

      if (conversationIndex === -1) {
        // Conversation not found, refetch to get it
        queryClient.invalidateQueries('conversations');
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

      // Sort: pinned first, then by last message time
      return updated.sort((a, b) => {
        const aPinned = a.isPinned || a.is_pinned || false;
        const bPinned = b.isPinned || b.is_pinned || false;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        
        const aTime = new Date(a.lastMessageTime || a.last_message_time || 0).getTime();
        const bTime = new Date(b.lastMessageTime || b.last_message_time || 0).getTime();
        return bTime - aTime;
      });
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
        
        // Remove existing listeners to avoid duplicates
        socket.off('new_message');
        socket.off('message_status_update');
        socket.off('conversation_messages_read');

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
            queryClient.setQueryData('conversations', (oldData: any[] = []) => {
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
              
              return updated.sort((a, b) => {
                const aPinned = a.isPinned || a.is_pinned || false;
                const bPinned = b.isPinned || b.is_pinned || false;
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
                
                const aTime = new Date(a.lastMessageTime || a.last_message_time || 0).getTime();
                const bTime = new Date(b.lastMessageTime || b.last_message_time || 0).getTime();
                return bTime - aTime;
              });
            });
          }
        };

        const handleConversationMessagesRead = (data: any) => {
          console.log('Conversation messages read:', data);
          if (data.conversationId) {
            queryClient.setQueryData('conversations', (oldData: any[] = []) => {
              const updated = oldData.map((conv: any) => {
                if ((conv.id || conv.conversationId) === data.conversationId) {
                  return {
                    ...conv,
                    unreadCount: 0,
                    unread_count: 0,
                  };
                }
                return conv;
              });
              
              return updated.sort((a, b) => {
                const aPinned = a.isPinned || a.is_pinned || false;
                const bPinned = b.isPinned || b.is_pinned || false;
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
                
                const aTime = new Date(a.lastMessageTime || a.last_message_time || 0).getTime();
                const bTime = new Date(b.lastMessageTime || b.last_message_time || 0).getTime();
                return bTime - aTime;
              });
            });
          }
        };

        socket.on('new_message', handleNewMessage);
        socket.on('message_status_update', handleMessageStatusUpdate);
        socket.on('conversation_messages_read', handleConversationMessagesRead);

        socketRef.current = socket;

        return () => {
          socket.off('new_message', handleNewMessage);
          socket.off('message_status_update', handleMessageStatusUpdate);
          socket.off('conversation_messages_read', handleConversationMessagesRead);
        };
      } catch (error) {
        console.error('Socket setup error:', error);
      }
    };

    setupSocketListeners();

    return () => {
      isMounted = false;
    };
  }, [queryClient, user]);

  const setStatusFilterAndUrl = (filter: StatusFilter) => {
    setStatusFilter(filter);
    if (filter === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ status: filter });
    }
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
      onSuccess: (res) => {
        const data = res.data?.data;
        if (data) {
          const { updated, errors } = data;
          if (updated?.tasks != null && updated.tasks > 0) {
            toast.success(`Created ${updated.tasks} task(s).`);
          }
          if (errors?.length) {
            errors.slice(0, 5).forEach((e: any) =>
              toast.error(e.message || `Row ${e.row}: ${e.sheet || ''}`)
            );
            if (errors.length > 5) {
              toast.error(`… and ${errors.length - 5} more errors`);
            }
          }
        }
        queryClient.invalidateQueries('tasks');
        queryClient.invalidateQueries('conversations');
        if (bulkTaskFileInputRef.current) bulkTaskFileInputRef.current.value = '';
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || error.message || 'Upload failed');
      },
      onSettled: () => {
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
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Header with Filters */}
      <div className="p-4 pb-3 border-b border-border-light dark:border-border-dark bg-white dark:bg-surface-dark/50 backdrop-blur-sm sticky top-0 z-10">
        {/* Header with Title and Create Button */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Task Groups</h1>
          <button
            onClick={() => setShowTaskCreateModal(true)}
            className="w-10 h-10 bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Create Task"
            aria-label="Create Task"
          >
            <span className="material-icons-outlined text-xl">add</span>
          </button>
        </div>
        
        {/* Google-style Search Box: input + suggestions in one container */}
        <div
          className={`relative mb-4 rounded-2xl border bg-white dark:bg-surface-dark overflow-hidden transition-all duration-200 z-10 ${
            showSuggestions && suggestions.length > 0
              ? 'border-primary/40 shadow-lg shadow-primary/5 dark:shadow-primary/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
          }`}
          ref={suggestionsRef}
        >
          <div className="relative flex items-center">
            <span className="absolute left-4 flex items-center text-gray-400 dark:text-gray-500 pointer-events-none">
              <span className="material-icons-outlined text-xl">search</span>
            </span>
            <input
              ref={searchInputRef}
              className="w-full pl-12 pr-12 py-3.5 bg-transparent border-0 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 focus:outline-none"
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
                className="absolute right-3 flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <span className="material-icons-outlined text-lg">close</span>
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700" />
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
                    <span className="material-icons-outlined text-[22px] text-gray-400 dark:text-gray-500 shrink-0">search</span>
                    <span className="font-medium truncate">{item.title}</span>
                    {item.frequency && (
                      <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 shrink-0">{item.frequency}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Status Filters - Enhanced Design */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-icons-outlined text-sm text-gray-500 dark:text-gray-400">filter_list</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Filter by Status</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'All', icon: 'apps', color: 'gray' },
              { key: 'todo', label: 'To Do', icon: 'today', color: 'blue' },
              { key: 'inprogress', label: 'In Progress', icon: 'pending_actions', color: 'purple' },
              { key: 'duesoon', label: 'Due Soon', icon: 'schedule', color: 'orange' },
              { key: 'overdue', label: 'Overdue', icon: 'priority_high', color: 'red' },
              { key: 'completed', label: 'Completed', icon: 'check_circle', color: 'green' },
            ] as const).map(({ key, label, icon, color }) => {
              const isActive = statusFilter === key;
              const colorClasses = {
                gray: isActive ? 'bg-gray-600 text-white border-gray-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
                blue: isActive ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/30' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                purple: isActive ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/30' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                orange: isActive ? 'bg-orange-600 text-white border-orange-600 shadow-orange-500/30' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
                red: isActive ? 'bg-red-600 text-white border-red-600 shadow-red-500/30' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
                green: isActive ? 'bg-green-600 text-white border-green-600 shadow-green-500/30' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
              };

              return (
                <button
                  key={key}
                  onClick={() => setStatusFilterAndUrl(key as StatusFilter)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 hover:scale-105 active:scale-95 ${
                    isActive
                      ? `${colorClasses[color]} shadow-lg`
                      : `${colorClasses[color]} hover:shadow-md`
                  }`}
                >
                  <span className="material-icons-outlined text-sm">{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bulk Upload Tasks - Admin/Super Admin only */}
      {isAdminOrSuperAdmin && (
        <div className="px-4 pb-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
              <span className="material-icons-outlined text-primary text-lg">upload_file</span>
              Bulk create tasks
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Download template, fill Task Title, Assigned To, Reporting Member, dates, Task Type, Recurrence, Task Owner (mobile), Financial Value, Description, Auto Escalate. Then upload.
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

      {/* Task Groups List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {filteredTaskGroups.length > 0 ? (
          <div>
            <h3 className="flex items-center text-xs font-bold text-primary uppercase tracking-wider mb-3 px-2">
              <span className="material-icons-round text-sm mr-1">groups</span>
              Task Groups ({filteredTaskGroups.length})
            </h3>
            <div className="space-y-1">
              {filteredTaskGroups.map((conv) => {
                const convId = conv.id ?? conv.conversationId ?? '';
                const convName = conv.name || 'Task Group';
                const convPhoto = conv.photoUrl || conv.group_photo || '';
                const lastMessage = conv.lastMessage || conv.last_message;
                const lastMessageContent = lastMessage?.content || 'No messages yet';
                const unreadCount = conv.unreadCount || conv.unread_count || 0;
                const lastMessageTime = conv.lastMessageTime || conv.last_message_time;
                
                const formatTime = (dateString?: string) => {
                  if (!dateString) return '';
                  try {
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
                    
                    if (diffInHours < 24) {
                      return format(date, 'h:mm a');
                    } else if (diffInHours < 48) {
                      return 'Yesterday';
                    } else if (diffInHours < 168) {
                      return format(date, 'EEE');
                    } else {
                      return format(date, 'MMM d');
                    }
                  } catch {
                    return '';
                  }
                };

                const timeDisplay = formatTime(lastMessageTime);
                const task = convId ? taskByConvId[String(convId)] : undefined;
                const taskStatusCategory = getTaskStatusCategory(task);
                const isSelected = selectedConversationId === convId;

                return (
                  <div
                    key={convId}
                    className={`group p-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 hover:bg-white dark:hover:bg-surface-dark hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border ${
                      isSelected
                        ? 'bg-primary/10 dark:bg-primary/20 border-primary shadow-md'
                        : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                    }`}
                    onClick={() => {
                      navigate(isAdmin ? `/admin/tasks/task-group/${convId}` : `/tasks/task-group/${convId}`);
                    }}
                  >
                    <div className="relative flex-shrink-0">
                      {convPhoto ? (
                        <img
                          alt={convName}
                          className="w-12 h-12 rounded-xl object-cover border-2 border-white dark:border-gray-700 shadow-sm group-hover:shadow-md transition-shadow"
                          src={convPhoto}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          <span className="material-icons-round text-white text-2xl">
                            groups
                          </span>
                        </div>
                      )}
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-lg border-2 border-white dark:border-gray-800">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-primary dark:group-hover:text-primary/80 transition-colors flex-1 min-w-0">
                          {convName}
                        </h4>
                        <div className="flex flex-col items-end flex-shrink-0">
                          {timeDisplay && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">{timeDisplay}</span>
                          )}
                          {/* Task status indicator - top right of card (from task details) */}
                          {taskStatusCategory && taskStatusCategory !== 'all' && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide mt-0.5 ${STATUS_COLORS[taskStatusCategory]}`}
                              title={STATUS_LABELS[taskStatusCategory]}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                                {STATUS_ICONS[taskStatusCategory]}
                              </span>
                              {STATUS_LABELS[taskStatusCategory]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {lastMessage && (
                          <>
                            <span className="material-icons-outlined text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                              {lastMessage.message_type === 'image' ? 'image' : lastMessage.message_type === 'file' ? 'attach_file' : 'chat_bubble'}
                            </span>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">
                              {lastMessageContent.length > 50 ? `${lastMessageContent.substring(0, 50)}...` : lastMessageContent}
                            </p>
                          </>
                        )}
                        {!lastMessage && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No messages yet</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Tasks Without Conversations (Newly Assigned) */}
        {tasksWithoutConversations.length > 0 && (
          <div>
            <h3 className="flex items-center text-xs font-bold text-primary uppercase tracking-wider mb-3 px-2">
              <span className="material-icons-round text-sm mr-1">assignment</span>
              Pending Tasks ({tasksWithoutConversations.length})
            </h3>
            <div className="space-y-1">
              {tasksWithoutConversations.map((task: any) => {
                const taskId = task.id;
                const taskTitle = task.title || 'Untitled Task';
                const taskStatusCategory = getTaskStatusCategory(task);
                const currentUserId = user?.id || (user as any)?.userId;
                const creatorId = task.created_by || task.creator_id;
                const isCreator = creatorId === currentUserId;
                const currentUserStatus = task.current_user_status || {};
                const hasAccepted = currentUserStatus.has_accepted || false;
                const hasRejected = currentUserStatus.has_rejected || false;
                const canAccept = !isCreator && !hasAccepted && !hasRejected;
                const canReject = !isCreator && !hasRejected && !hasAccepted;

                // Handle accept
                const handleAccept = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  try {
                    await taskService.acceptTask(taskId);
                    toast.success('Task accepted');
                    queryClient.invalidateQueries('tasks');
                    queryClient.invalidateQueries('conversations');
                    queryClient.invalidateQueries(['task', taskId]);
                    queryClient.invalidateQueries(['dashboard']);
                    queryClient.invalidateQueries(['dashboard-statistics']);
                  } catch (error: any) {
                    toast.error(error.response?.data?.error || 'Failed to accept task');
                  }
                };

                // Handle reject
                const handleReject = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const reason = prompt('Please provide a reason for rejecting this task:');
                  if (!reason || reason.trim() === '') {
                    toast.error('Please provide a reason');
                    return;
                  }
                  try {
                    await taskService.rejectTask(taskId, reason.trim());
                    toast.success('Task rejected');
                    queryClient.invalidateQueries('tasks');
                    queryClient.invalidateQueries('conversations');
                    queryClient.invalidateQueries(['task', taskId]);
                    queryClient.invalidateQueries(['dashboard']);
                    queryClient.invalidateQueries(['dashboard-statistics']);
                  } catch (error: any) {
                    toast.error(error.response?.data?.error || 'Failed to reject task');
                  }
                };

                return (
                  <div
                    key={taskId}
                    className="group p-3 rounded-xl transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-surface-dark hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-700 flex items-center justify-center shadow-sm">
                          <span className="material-icons-round text-white text-2xl">
                            assignment
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate flex-1 min-w-0">
                            {taskTitle}
                          </h4>
                          {taskStatusCategory && taskStatusCategory !== 'all' && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLORS[taskStatusCategory]}`}
                            >
                              <span className="material-icons-outlined" style={{ fontSize: '10px' }}>
                                {STATUS_ICONS[taskStatusCategory]}
                              </span>
                              {STATUS_LABELS[taskStatusCategory]}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-2">
                            {task.description.length > 80 ? `${task.description.substring(0, 80)}...` : task.description}
                          </p>
                        )}
                        {(canAccept || canReject) && (
                          <div className="flex gap-2 mt-2">
                            {canAccept && (
                              <button
                                onClick={handleAccept}
                                className="flex-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                              >
                                <span className="material-icons-outlined text-sm">check</span>
                                Accept
                              </button>
                            )}
                            {canReject && (
                              <button
                                onClick={handleReject}
                                className="flex-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                              >
                                <span className="material-icons-outlined text-sm">close</span>
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                        {(hasAccepted || hasRejected) && (
                          <div className="mt-2">
                            <span className={`text-xs font-medium ${
                              hasAccepted ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {hasAccepted ? '✓ Accepted' : '✗ Rejected'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredTaskGroups.length === 0 && tasksWithoutConversations.length === 0 && (
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
              <>
                <p className="text-gray-500 dark:text-gray-500 text-sm mb-4 text-center">
                  Create your first task to get started
          </p>
          <button
                  onClick={() => setShowTaskCreateModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-semibold text-sm shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          >
                  <span className="material-icons-outlined text-lg">add</span>
                  <span>Create Task</span>
          </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

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
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Task Group Selected</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
          Select a task group from the list to view details and manage tasks
        </p>
            <button
              onClick={() => setShowTaskCreateModal(true)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all duration-200 hover:scale-105 active:scale-95"
            >
          <span className="material-icons-outlined text-lg">add</span>
          <span>Create New Task</span>
            </button>
                </div>
              </div>
  );

  if (isAdmin) {
    return (
      <AdminLayout hideSearch>
        <div className="flex h-full">
          <div className="w-80 md:w-96 bg-background-light dark:bg-background-dark flex flex-col border-r border-border-light dark:border-border-dark relative">
            {taskGroupListContent}
              </div>
          <div className="flex-1 flex flex-col bg-surface-light dark:bg-surface-dark relative overflow-hidden">
            {mainContent}
                </div>
              </div>

        {/* Floating Create Button (Mobile/Tablet) */}
        <button
          onClick={() => setShowTaskCreateModal(true)}
          className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-xl shadow-primary/40 hover:shadow-2xl hover:shadow-primary/50 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-50"
          title="Create Task"
          aria-label="Create Task"
        >
          <span className="material-icons-outlined text-2xl">add</span>
        </button>

        {/* Task Create Modal */}
        <TaskCreateModal
          visible={showTaskCreateModal}
          onClose={() => setShowTaskCreateModal(false)}
          onSuccess={() => {
            setShowTaskCreateModal(false);
            queryClient.invalidateQueries('conversations');
          }}
        />
      </AdminLayout>
    );
  }

  return (
    <EmployeeLayout hideSearch>
      <div className="flex h-full">
        <div className="w-80 md:w-96 bg-background-light dark:bg-background-dark flex flex-col border-r border-border-light dark:border-border-dark relative">
          {taskGroupListContent}
              </div>
        <div className="flex-1 flex flex-col bg-surface-light dark:bg-surface-dark relative overflow-hidden">
          {mainContent}
        </div>
      </div>

      {/* Floating Create Button (Mobile/Tablet) */}
      <button
        onClick={() => setShowTaskCreateModal(true)}
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-xl shadow-primary/40 hover:shadow-2xl hover:shadow-primary/50 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 z-50"
        title="Create Task"
        aria-label="Create Task"
      >
        <span className="material-icons-outlined text-2xl">add</span>
      </button>

      {/* Task Create Modal */}
      <TaskCreateModal
        visible={showTaskCreateModal}
        onClose={() => setShowTaskCreateModal(false)}
        onSuccess={() => {
          setShowTaskCreateModal(false);
          queryClient.invalidateQueries('conversations');
        }}
      />
    </EmployeeLayout>
  );
};
