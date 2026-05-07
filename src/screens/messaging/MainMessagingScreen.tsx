import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { conversationService } from '../../services/conversationService';
import { waitForSocketConnection } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ConversationList } from '../../components/messaging/ConversationList';
import { NewChatModal } from '../../components/messaging/NewChatModal';

export const MainMessagingScreen: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const socketRef = useRef<any>(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!(location.state as any)?.openNewChatModal) return;
    setShowNewChatModal(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  // Fetch conversations
  const { data: conversations = [] } = useQuery(
    ['conversations', 'chat'],
    () => conversationService.getConversations('chat'),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Filter conversations to direct chats only
  const filteredConversations = React.useMemo(() => {
    let filtered = conversations.filter(conv =>
      (conv.type === 'direct' || (!conv.is_group && !conv.is_task_group)) &&
      !(conv.isTaskGroup || conv.is_task_group)
    );

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
  }, [conversations, searchQuery]);

  // Update conversation with new message (matching mobile pattern)
  const updateConversationWithNewMessage = (message: any) => {
    if (!message.conversation_id || !message.id) {
      console.warn('⚠️ Invalid message received, skipping:', message);
      return;
    }

    queryClient.setQueryData(['conversations', 'chat'], (oldData: any[] = []) => {
      const conversationId = message.conversation_id;
      const conversationIndex = oldData.findIndex(
        (conv: any) => (conv.id || conv.conversationId) === conversationId
      );

      if (conversationIndex === -1) {
        // Conversation not found, refetch to get it
        queryClient.invalidateQueries(['conversations', 'chat']);
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

  // Setup socket listeners for real-time updates (matching mobile pattern)
  useEffect(() => {
    let isMounted = true;

    const setupSocketListeners = async () => {
      try {
        // CRITICAL FIX: Wait for socket connection instead of infinite retry
        const socket = await waitForSocketConnection();
        if (!isMounted) return;
        
        console.log('✅ Socket connected in MainMessagingScreen');
        
        // Remove existing listeners to avoid duplicates
        socket.off('new_message');
        socket.off('message_status_update');
        socket.off('conversation_messages_read');

        console.log('Setting up socket listeners in MainMessagingScreen');

        // CRITICAL FIX: Listen for new messages (listen globally, not just in conversation rooms)
        const handleNewMessage = (message: any) => {
          console.log('📨 New message received in MainMessagingScreen:', {
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            userId: user?.id,
            status: message.status,
            messageId: message.id,
            content: message.content?.substring(0, 30),
          });
          
          // Ensure message has required fields
          if (!message.conversation_id || !message.id) {
            console.warn('⚠️ Invalid message received, skipping:', message);
            return;
          }
          
          // CRITICAL FIX: Update conversation immediately for real-time updates
          updateConversationWithNewMessage(message);
        };

        // Listen for message status updates (when messages are read)
        const handleMessageStatusUpdate = (update: any) => {
          console.log('📊 Message status update in MainMessagingScreen:', update);
          
          if (update.conversationId && update.messageId) {
            queryClient.setQueryData(['conversations', 'chat'], (oldData: any[] = []) => {
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
          }
        };

        // Listen for bulk read updates (when all messages in a conversation are marked as read)
        const handleConversationMessagesRead = (data: any) => {
          console.log('Conversation messages read:', data);
          if (data.conversationId) {
            // Clear unread count for this conversation
            queryClient.setQueryData(['conversations', 'chat'], (oldData: any[] = []) => {
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

  const conversationListContent = (
    <ConversationList
      conversations={filteredConversations}
      currentConversationId={undefined}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onCreateNew={() => setShowNewChatModal(true)}
      hideHeader={!isAdmin}
    />
  );

  const mainContent = (
    <div className="flex-1 flex items-center justify-center text-gray-400">
      <div className="text-center">
        <span className="material-icons-outlined text-6xl mb-4 block">chat_bubble_outline</span>
        <p className="text-lg font-medium">Select a conversation to start chatting</p>
      </div>
    </div>
  );

  if (isAdmin) {
    return (
      <AdminLayout hideSearch>
        <div className="flex h-full">
          <div className="w-80 md:w-96 bg-background-light dark:bg-background-dark flex flex-col border-r border-border-light dark:border-border-dark relative">
            {conversationListContent}
          </div>
          <div className="flex-1 flex flex-col bg-surface-light dark:bg-surface-dark relative overflow-hidden">
            {mainContent}
          </div>
        </div>

        {/* New Chat Modal */}
        <NewChatModal
          visible={showNewChatModal}
          onClose={() => setShowNewChatModal(false)}
        />
      </AdminLayout>
    );
  }

  return (
    <EmployeeLayout
      showConversationList
      conversationListContent={conversationListContent}
      hideSearch
    >
      {mainContent}

      {/* New Chat Modal */}
      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
      />
    </EmployeeLayout>
  );
};
