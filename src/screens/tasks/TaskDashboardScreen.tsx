import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { conversationService } from '../../services/conversationService';
import { waitForSocketConnection } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { ConversationList } from '../../components/messaging/ConversationList';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';
import { format } from 'date-fns';

export type StatusFilter = 'all' | 'todo' | 'overdue' | 'duesoon' | 'inprogress' | 'completed';

export const TaskDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const socketRef = React.useRef<any>(null);

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

  // Filter to only task groups
  const taskGroups = React.useMemo(() => {
    return conversations.filter(conv => conv.isTaskGroup || conv.is_task_group);
  }, [conversations]);

  // Filter task groups by status filter
  const filteredTaskGroups = React.useMemo(() => {
    let filtered = taskGroups;

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

    // Apply status filter (this would need task data - for now, we'll filter by conversation name/content)
    // TODO: If you have task status in conversation data, filter here
    // For now, we'll show all task groups and let the status filter be handled in the main content area

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
  }, [taskGroups, searchQuery, statusFilter]);

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
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 dark:text-gray-500">
            <span className="material-icons-outlined text-lg">search</span>
          </span>
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 transition-all"
            placeholder="Search task groups..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <span className="material-icons-outlined text-lg">close</span>
            </button>
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
                const convId = conv.conversationId || conv.id || '';
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

                return (
                  <div
                    key={convId}
                    className="group p-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center gap-3 hover:bg-white dark:hover:bg-surface-dark hover:shadow-md hover:scale-[1.02] active:scale-[0.98] border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
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
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-primary dark:group-hover:text-primary/80 transition-colors">
                          {convName}
                        </h4>
                        {timeDisplay && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-2">{timeDisplay}</span>
                        )}
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
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <span className="material-icons-outlined text-4xl text-gray-400 dark:text-gray-600">
                {searchQuery ? 'search_off' : 'groups'}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
              {searchQuery ? 'No task groups found' : 'No task groups yet'}
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

  // Main content (right side - empty state)
  const mainContent = (
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
