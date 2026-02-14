import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { format } from 'date-fns';
import { messageService } from '../../services/messageService';
import { conversationService } from '../../services/conversationService';
import { taskService } from '../../services/taskService';
import { waitForSocketConnection, joinConversationRoom, leaveConversationRoom, onSocketEvent, offSocketEvent, sendMessageViaSocket, getSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ConversationList } from '../../components/messaging/ConversationList';
import { ReplyMessage } from '../../components/messaging/ReplyMessage';
import { MessageReactions } from '../../components/messaging/MessageReactions';
import { MessageActionSheet } from '../../components/messaging/MessageActionSheet';
import { EmojiPicker } from '../../components/messaging/EmojiPicker';
import { ImageMessage } from '../../components/messaging/ImageMessage';
import { VideoMessage } from '../../components/messaging/VideoMessage';
import { DocumentMessage } from '../../components/messaging/DocumentMessage';
import { LocationMessage } from '../../components/messaging/LocationMessage';
import { VoiceMessage } from '../../components/messaging/VoiceMessage';
import { TaskGroupDetailsModal } from '../../components/messaging/TaskGroupDetailsModal';
import { TaskDetailsModal } from '../../components/tasks/TaskDetailsModal';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';
import { NewChatModal } from '../../components/messaging/NewChatModal';
import { MediaUpload } from '../../components/messaging/MediaUpload';
import { VoiceRecorder } from '../../components/messaging/VoiceRecorder';
import { LocationPicker } from '../../components/messaging/LocationPicker';
import { extractUploadedMedia } from '../../utils/chatMedia';

interface TaskGroupChatConversationProps {
  conversationId?: string; // Optional prop to override useParams
  /** When true, render only chat content + modals (no layout). Parent provides task list layout. */
  embedInTaskDashboard?: boolean;
}

export const TaskGroupChatConversation: React.FC<TaskGroupChatConversationProps> = ({ conversationId: propConversationId, embedInTaskDashboard = false }) => {
  const { conversationId: paramConversationId, taskId: routeTaskId } = useParams<{ conversationId?: string; taskId?: string }>();
  // Use prop if provided, otherwise use param from route
  const conversationId = propConversationId || paramConversationId;
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || location.pathname.startsWith('/admin');
  // Check if accessed from task module route (not from messages route)
  // If pathname matches /tasks/... or /admin/tasks/... pattern, we're in task module (or embedded in task dashboard)
  const isFromTaskModule =
    embedInTaskDashboard || /^\/tasks(\/|$)/.test(location.pathname) || /^\/admin\/tasks(\/|$)/.test(location.pathname);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasMarkedAsReadRef = useRef<boolean>(false);
  const attachmentMenuInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Mobile ChatScreen features state
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typing, setTyping] = useState(false);
  const [conversationFilter, setConversationFilter] = useState<'All' | 'Direct' | 'Task Groups'>('All');
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showTaskGroupDetails, setShowTaskGroupDetails] = useState(false);
  const [openGroupDetailsForAddMembers, setOpenGroupDetailsForAddMembers] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [createTaskAttachment, setCreateTaskAttachment] = useState<{
    mediaUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  // Message visibility: 'shared_to_group' (default) or 'org_only' for task groups ONLY
  // For personal chats, visibility is always 'private' (handled by backend)
  const [visibilityMode, setVisibilityMode] = useState<'shared_to_group' | 'org_only'>('shared_to_group');
  type PendingAttachment = {
    id: string;
    file: File;
    name: string;
    size: number;
    type: 'image' | 'video' | 'audio' | 'document';
    previewUrl?: string;
    uploadProgress: number | null;
  };
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // Fetch conversation details
  const { data: conversationData } = useQuery(
    ['conversation', conversationId],
    () => conversationService.getConversationDetails(conversationId!),
    { enabled: !!conversationId }
  );

  // Check if this is a task group conversation (must be after conversationData is defined)
  const isTaskGroup = conversationData?.is_task_group || conversationData?.isTaskGroup || false;
  const isPinned = conversationData?.is_pinned ?? conversationData?.isPinned ?? false;

  // Pin/unpin conversation
  const pinMutation = useMutation(
    () => conversationService.pinConversation(conversationId!, !isPinned),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['conversation', conversationId]);
        queryClient.invalidateQueries(['conversations']);
        toast.success(isPinned ? 'Conversation unpinned' : 'Conversation pinned');
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to update pin');
      },
    }
  );
  const handlePinClick = () => {
    if (!conversationId) return;
    pinMutation.mutate();
  };

  // Derive a reliable taskId for this conversation (works for both /messages and /tasks routes)
  const effectiveTaskId = useMemo(() => {
    if (routeTaskId) return routeTaskId;
    const conv: any = conversationData;
    return (
      conv?.taskId ||
      conv?.data?.taskId ||
      conv?.task_id ||
      conv?.data?.task_id ||
      null
    );
  }, [routeTaskId, conversationData]);

  // Normalize message function (matching mobile)
  const normalizeMessage = (msg: any) => {
    if (!msg) return null;
    
    return {
      id: msg.id,
      conversation_id: msg.conversation_id || msg.conversationId,
      sender_id: msg.sender_id || msg.senderId,
      receiver_id: msg.receiver_id || msg.receiverId,
      group_id: msg.group_id || msg.groupId,
      message_type: msg.message_type || msg.messageType || 'text',
      content: msg.content,
      media_url: msg.media_url || msg.mediaUrl,
      media_thumbnail: msg.media_thumbnail || msg.mediaThumbnail,
      file_name: msg.file_name || msg.fileName,
      file_size: msg.file_size || msg.fileSize,
      mime_type: msg.mime_type || msg.mimeType,
      duration: msg.duration,
      sender_name: msg.sender_name || msg.senderName,
      sender_photo: msg.sender_photo || msg.senderPhoto,
      reply_to_message_id: msg.reply_to_message_id || msg.replyToMessageId,
      reply_to: msg.reply_to || msg.replyTo,
      edited_at: msg.edited_at || msg.editedAt,
      deleted_at: msg.deleted_at || msg.deletedAt,
      deleted_for_all: msg.deleted_for_all || msg.deletedForEveryone || false,
      status: msg.status || 'sent',
      reactions: msg.reactions || [],
      starred: msg.starred || false,
      visibility_mode: msg.visibility_mode || msg.visibilityMode || 'shared_to_group',
      created_at: msg.created_at || msg.createdAt,
      updated_at: msg.updated_at || msg.updatedAt,
    };
  };

  // Load messages function (matching DirectChatConversation)
  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      setLoading(true);
      const data = await messageService.getMessagesByConversationId(conversationId, 50, 0);
      console.log('TaskGroupChat: Loaded messages from API:', data);
      
      // Handle different response formats
      let rawMessages: any[] = [];
      if (Array.isArray(data)) {
        rawMessages = data;
      } else if (data && typeof data === 'object') {
        rawMessages = data.messages || data.data || [];
      }
      
      // Normalize messages to ensure consistent field names
      const normalizedMessages = rawMessages.map((msg: any) => normalizeMessage(msg)).filter((msg: any) => msg !== null);
      console.log('TaskGroupChat: Normalized messages:', normalizedMessages.length);
      
      // Remove any temp messages when loading from API
      const currentUserId = user?.id || user?.userId;
      const messagesWithoutTemp = normalizedMessages.filter((msg: any) => {
        if (!msg.id?.startsWith('temp_')) return true;
        // Remove temp messages from current user - they should have real messages now
        if (msg.sender_id === currentUserId || msg.senderId === currentUserId) {
          return false;
        }
        return true;
      });
      
      // Sort messages by created_at to ensure correct chronological order
      messagesWithoutTemp.sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || 0).getTime();
        const timeB = new Date(b.created_at || 0).getTime();
        return timeA - timeB;
      });
      
      console.log('TaskGroupChat: Final messages count:', messagesWithoutTemp.length);
      setMessages(messagesWithoutTemp);
      setHasMoreMessages(messagesWithoutTemp.length >= 50);
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('TaskGroupChat: Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  // Load messages when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Mark messages as read
  const markAsReadMutation = useMutation(
    () => messageService.markMessagesAsReadByConversationId(conversationId!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['conversations']);
      }
    }
  );

  // Send message mutation
  const sendMessageMutation = useMutation(
    (data: { content: string; replyToMessageId?: string }) => messageService.sendMessage({
      conversationId: conversationId!,
      messageType: 'text',
      content: data.content,
      replyToMessageId: data.replyToMessageId,
    }),
    {
      onSuccess: () => {
        loadMessages();
      }
    }
  );

  // Setup socket and join conversation room
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !conversationId) return;

    let isMounted = true;

    const setupSocket = async () => {
      try {
        const socket = await waitForSocketConnection();
        if (!isMounted) return;

        await joinConversationRoom(conversationId);

        const handleNewMessage = (newMsg: any) => {
          if (newMsg.conversation_id !== conversationId) return;
          
          const currentUserId = user?.id || user?.userId;
          const isMyMessage = newMsg.sender_id === currentUserId || newMsg.senderId === currentUserId;
          
          const normalizedMessage = normalizeMessage(newMsg);
          if (!normalizedMessage) return;

          setMessages((prev) => {
            // Check if message already exists by ID (real message from database)
            const existingIndex = prev.findIndex(msg => msg.id === normalizedMessage.id);
            if (existingIndex !== -1) {
              // Update existing message
              const updated = [...prev];
              updated[existingIndex] = normalizedMessage;
              return updated.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeA - timeB;
              });
            }
            
            // Check for temp message replacement (optimistic message should be replaced)
            if (isMyMessage) {
              const currentUserId = user?.id || user?.userId;
              // For our own messages, ALWAYS remove ALL temp messages from this user and add real message
              // This prevents duplicates - we never want both temp and real messages for our own messages
              const allTempMessagesFromUser = prev.filter(msg => {
                if (!msg.id?.startsWith('temp_')) return false;
                return (msg.sender_id === currentUserId || msg.senderId === currentUserId);
              });
              
              // Remove all temp messages from this user and the real message if it already exists
              const tempIds = allTempMessagesFromUser.map(m => m.id);
              const updated = prev
                .filter(msg => !tempIds.includes(msg.id))
                .filter(msg => msg.id !== normalizedMessage.id);
              
              // Always add the real message
              updated.push(normalizedMessage);
              
              return updated.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeA - timeB;
              });
            }
            
            // For other users' messages, add new message (only if it doesn't exist)
            if (!prev.some(msg => msg.id === normalizedMessage.id)) {
              const updated = [...prev, normalizedMessage].sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeA - timeB;
              });
              return updated;
            }
            
            return prev;
          });
          
          setTimeout(() => scrollToBottom(), 50);
          
          if (!isMyMessage) {
            setTimeout(async () => {
              try {
                // Mark all unread messages in conversation as read
                await markAsReadMutation.mutateAsync();
                // Emit read receipt for this conversation
                socket.emit('message_read', {
                  conversationId,
                });
                console.log('✅ Marked messages as read when new message arrived');
              } catch (err) {
                console.error('Mark as read error:', err);
              }
            }, 300);
          }
        };

        const handleMessageStatusUpdate = (update: any) => {
          console.log('📊 Message status update received in TaskGroup:', update);
          if (update.conversationId && update.conversationId !== conversationId) return;
          
          setMessages((prev) => {
            let hasChanges = false;
            const updated = prev.map(msg => {
              if (msg.id === update.messageId) {
                if (msg.status !== update.status) {
                  console.log('✅ Updating message status by ID:', {
                    messageId: msg.id,
                    oldStatus: msg.status,
                    newStatus: update.status,
                  });
                  hasChanges = true;
                  return { ...msg, status: update.status };
                }
                return msg;
              }
              const currentUserId = user?.id || user?.userId;
              const msgSenderId = msg.sender_id || msg.senderId;
              if (update.status === 'read' && 
                  update.conversationId === conversationId &&
                  msgSenderId === currentUserId && 
                  msg.status !== 'read') {
                console.log('✅ Bulk updating message to read:', msg.id);
                hasChanges = true;
                return { ...msg, status: 'read' };
              }
              if (update.status === 'delivered' && 
                  msgSenderId === currentUserId && 
                  msg.status === 'sent') {
                console.log('✅ Bulk updating message to delivered:', msg.id);
                hasChanges = true;
                return { ...msg, status: 'delivered' };
              }
              return msg;
            });
            // Force re-render by creating new array reference if changes were made
            return hasChanges ? [...updated] : prev;
          });
        };

        const handleConversationMessagesRead = (data: any) => {
          console.log('📖 Conversation messages read event in TaskGroup:', data);
          if (data.conversationId !== conversationId) return;
          
          setMessages((prev) => {
            let hasChanges = false;
            const updated = prev.map((msg) => {
              const currentUserId = user?.id || user?.userId;
              const msgSenderId = msg.sender_id || msg.senderId;
              if (msgSenderId === currentUserId && (msg.status === 'delivered' || msg.status === 'sent')) {
                if (msg.status !== 'read') {
                  console.log('✅ Marking message as read:', msg.id);
                  hasChanges = true;
                  return { ...msg, status: 'read' };
                }
              }
              return msg;
            });
            // Force re-render by creating new array reference if changes were made
            return hasChanges ? [...updated] : prev;
          });
        };

        const handleMessageEdited = (editedMsg: any) => {
          if (editedMsg.conversation_id !== conversationId) return;
          
          setMessages((prev) =>
            prev.map(msg =>
              msg.id === editedMsg.id ? { ...msg, ...normalizeMessage(editedMsg) } : msg
            )
          );
        };

        const handleMessageDeleted = (deletedMsg: any) => {
          if (deletedMsg.conversation_id !== conversationId) return;
          
          setMessages((prev) =>
            prev.filter(msg => msg.id !== deletedMsg.id)
          );
        };

        const handleTyping = (data: any) => {
          const currentUserId = user?.id || user?.userId;
          if (data.conversationId === conversationId && data.userId !== currentUserId) {
            setIsTyping(data.isTyping);
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            if (data.isTyping) {
              typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
              }, 3000);
            }
          }
        };

        const handleMessageReactionAdded = (data: any) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === data.messageId) {
                const reactions = msg.reactions || [];
                const currentUserId = user?.id || user?.userId;
                if (!reactions.find((r: any) => (r.user_id || r.userId) === currentUserId && r.reaction === data.reaction)) {
                  return {
                    ...msg,
                    reactions: [...reactions, { user_id: data.userId, reaction: data.reaction }],
                  };
                }
              }
              return msg;
            })
          );
        };

        const handleMessageReactionRemoved = (data: any) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === data.messageId) {
                return {
                  ...msg,
                  reactions: (msg.reactions || []).filter(
                    (r: any) => !((r.user_id || r.userId) === data.userId && r.reaction === data.reaction)
                  ),
                };
              }
              return msg;
            })
          );
        };

        const handleConversationUpdated = (updatedConv: any) => {
          if (updatedConv.id === conversationId) {
            queryClient.setQueryData(['conversation', conversationId], (oldData: any) => ({
              ...oldData,
              data: { ...oldData.data, ...updatedConv }
            }));
          }
        };

        onSocketEvent('new_message', handleNewMessage);
        onSocketEvent('message_status_update', handleMessageStatusUpdate);
        onSocketEvent('conversation_messages_read', handleConversationMessagesRead);
        onSocketEvent('message_edited', handleMessageEdited);
        onSocketEvent('message_deleted', handleMessageDeleted);
        onSocketEvent('typing', handleTyping);
        onSocketEvent('message_reaction_added', handleMessageReactionAdded);
        onSocketEvent('message_reaction_removed', handleMessageReactionRemoved);
        onSocketEvent('conversation_updated', handleConversationUpdated);

        socketRef.current = socket;

        return () => {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          leaveConversationRoom(conversationId);
          offSocketEvent('new_message', handleNewMessage);
          offSocketEvent('message_status_update', handleMessageStatusUpdate);
          offSocketEvent('conversation_messages_read', handleConversationMessagesRead);
          offSocketEvent('message_edited', handleMessageEdited);
          offSocketEvent('message_deleted', handleMessageDeleted);
          offSocketEvent('typing', handleTyping);
          offSocketEvent('message_reaction_added', handleMessageReactionAdded);
          offSocketEvent('message_reaction_removed', handleMessageReactionRemoved);
          offSocketEvent('conversation_updated', handleConversationUpdated);
        };
      } catch (error) {
        console.error('Socket setup error:', error);
      }
    };

    setupSocket();

    return () => {
      isMounted = false;
      if (conversationId) {
        leaveConversationRoom(conversationId);
      }
    };
  }, [conversationId, user, queryClient]);

  // Mark messages as read when conversation is opened (only once per conversation)
  useEffect(() => {
    if (conversationId && messages.length > 0 && !hasMarkedAsReadRef.current) {
      const markAsRead = async () => {
        try {
          // Call API endpoint
          await markAsReadMutation.mutateAsync();
          
          // Also emit socket event to ensure backend processes it correctly
          const socket = await waitForSocketConnection();
          socket.emit('message_read', {
            conversationId,
          });
          
          hasMarkedAsReadRef.current = true;
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
      };
      
      markAsRead();
    }
    
    // Reset flag when conversation changes
    return () => {
      hasMarkedAsReadRef.current = false;
    };
  }, [conversationId, messages.length]);

  // CRITICAL FIX: Periodically mark messages as read while chat is open and user is viewing
  // This ensures read receipts update in real-time for the sender
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;

    // Check for unread messages from other users
    const checkAndMarkAsRead = async () => {
      const currentUserId = user?.id || user?.userId;
      const unreadMessages = messages.filter((msg: any) => {
        const msgSenderId = msg.sender_id || msg.senderId;
        return msgSenderId !== currentUserId && msg.status !== 'read' && !msg.deleted_at;
      });

      if (unreadMessages.length > 0) {
        console.log('📖 Found unread messages while chat is open, marking as read:', unreadMessages.length);
        try {
          // Mark messages as read via API
          await markAsReadMutation.mutateAsync();
          
          // Also emit socket event to ensure backend processes it and emits status updates
          const socket = await waitForSocketConnection();
          socket.emit('message_read', {
            conversationId,
          });
          
          console.log('✅ Marked messages as read and emitted socket event');
        } catch (error) {
          console.error('Error marking messages as read periodically:', error);
        }
      }
    };

    // Check immediately
    checkAndMarkAsRead();

    // Then check every 2 seconds while chat is open
    const interval = setInterval(checkAndMarkAsRead, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [conversationId, messages, user?.id, user?.userId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format time helper
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), 'h:mm a');
    } catch {
      return '';
    }
  };

  // Format date helper
  const formatDate = (timestamp?: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return format(date, 'MMM d, yyyy');
      }
    } catch {
      return '';
    }
  };

  // Should show date separator
  const shouldShowDateSeparator = (currentMessage: any, previousMessage: any) => {
    if (!previousMessage) return true;
    try {
      const currentDate = new Date(currentMessage.created_at).toDateString();
      const previousDate = new Date(previousMessage.created_at).toDateString();
      return currentDate !== previousDate;
    } catch {
      return false;
    }
  };

  // Handle typing (with debouncing)
  const handleTyping = async (text: string) => {
    setMessage(text);

    try {
      const socket = await waitForSocketConnection();
      const currentUserId = user?.id || user?.userId;
      
      if (!typing && text.length > 0) {
        setTyping(true);
        socket.emit('typing', { 
          conversationId, 
          isTyping: true,
          userId: currentUserId,
        });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      typingTimeoutRef.current = setTimeout(async () => {
        try {
          const stopSocket = await waitForSocketConnection();
          setTyping(false);
          stopSocket.emit('typing', { 
            conversationId, 
            isTyping: false,
            userId: currentUserId,
          });
        } catch (error) {
          console.error('Error stopping typing:', error);
          setTyping(false);
        }
      }, 2000);
    } catch (error) {
      console.error('Typing indicator error:', error);
    }
  };

  // Handle send message
  const getDeviceLocalTimestamp = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const handleSend = async () => {
    if ((!message.trim() && !replyingTo && !editingMessage && pendingAttachments.length === 0) || !conversationId) return;

    try {
      const socket = await waitForSocketConnection();

      if (editingMessage) {
        await messageService.editMessage(editingMessage.id, message.trim());
        socket.emit('send_message', { conversationId, content: message.trim(), messageType: 'text', isEdit: true, messageId: editingMessage.id });
        setEditingMessage(null);
        setMessage('');
      } else if (pendingAttachments.length > 0) {
        const caption = message.trim();
        if (caption) {
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const currentUserId = user?.id || user?.userId;
          const tempMessage = normalizeMessage({
            id: tempId,
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: caption,
            message_type: 'text',
            status: 'sent',
            created_at: new Date().toISOString(),
            sender_name: user?.name || 'You',
            reply_to_message_id: replyingTo?.id || null,
            reply_to: replyingTo ? { id: replyingTo.id, sender_id: replyingTo.sender_id, content: replyingTo.content, message_type: replyingTo.message_type, sender_name: replyingTo.sender_name } : null,
          });
          if (tempMessage) setMessages((prev) => [...prev, tempMessage]);
          socket.emit('send_message', { 
            conversationId, 
            text: caption, 
            content: caption, 
            messageType: 'text', 
            replyToMessageId: replyingTo?.id || null,
            deviceTimestamp: getDeviceLocalTimestamp(),
            // Only send visibilityMode for task groups
            ...(isTaskGroup && { visibilityMode }),
          });
          setMessage('');
          setReplyingTo(null);
        }
        setUploadingMedia(true);
        const toSend = [...pendingAttachments];
        setPendingAttachments([]);
        for (const item of toSend) {
          try {
            let uploadResponse: any;
            switch (item.type) {
              case 'image': uploadResponse = await messageService.uploadImage(item.file); break;
              case 'video': uploadResponse = await messageService.uploadVideo(item.file); break;
              case 'audio': uploadResponse = await messageService.uploadAudio(item.file); break;
              case 'document': uploadResponse = await messageService.uploadDocument(item.file); break;
            }
            const { storedValue } = extractUploadedMedia(uploadResponse);
            if (!storedValue) throw new Error('Upload did not return key');
            socket.emit('send_message', { conversationId, messageType: item.type, mediaUrl: storedValue, fileName: item.name, fileSize: item.size, mimeType: item.file.type, replyToMessageId: replyingTo?.id || null, deviceTimestamp: getDeviceLocalTimestamp() });
          } catch (err) {
            console.error('Upload error:', err);
            toast.error(`Failed to upload ${item.name}. Please try again.`);
          }
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        setUploadingMedia(false);
        setTimeout(() => scrollToBottom(), 100);
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const currentUserId = user?.id || user?.userId;
        const tempMessage = normalizeMessage({
          id: tempId,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: message.trim(),
          message_type: 'text',
          status: 'sent',
          created_at: new Date().toISOString(),
          sender_name: user?.name || 'You',
          reply_to_message_id: replyingTo?.id || null,
          reply_to: replyingTo ? { id: replyingTo.id, sender_id: replyingTo.sender_id, content: replyingTo.content, message_type: replyingTo.message_type, sender_name: replyingTo.sender_name } : null,
          visibility_mode: isTaskGroup ? visibilityMode : 'private',
        });
        if (tempMessage) {
          setMessages((prev) => [...prev, tempMessage]);
          setMessage('');
          setReplyingTo(null);
          setTimeout(() => scrollToBottom(), 100);
        }
        socket.emit('send_message', { 
          conversationId, 
          text: message.trim(), 
          content: message.trim(), 
          messageType: 'text', 
          replyToMessageId: replyingTo?.id || null,
          deviceTimestamp: getDeviceLocalTimestamp(),
          // Only send visibilityMode for task groups; backend will use 'private' for personal chats
          ...(isTaskGroup && { visibilityMode }),
        });
      }

      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  // Handle long press (right-click or context menu)
  const handleMessageContextMenu = (e: React.MouseEvent, msg: any) => {
    e.preventDefault();
    setSelectedMessage(msg);
  };

  // Handle reaction
  const handleReaction = async (emoji: string) => {
    if (!selectedMessage) return;
    
    const currentUserId = user?.id || user?.userId;
    const existingReaction = selectedMessage.reactions?.find(
      (r: any) => (r.user_id || r.userId) === currentUserId && r.reaction === emoji
    );

    try {
      const socket = await waitForSocketConnection();
      if (existingReaction) {
        await messageService.removeReaction(selectedMessage.id, emoji);
        socket.emit('remove_reaction', {
          messageId: selectedMessage.id,
          conversationId,
          reaction: emoji,
        });
      } else {
        await messageService.addReaction(selectedMessage.id, emoji);
        socket.emit('message_reaction', {
          messageId: selectedMessage.id,
          conversationId,
          reaction: emoji,
        });
      }
      setSelectedMessage(null);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Reaction error:', error);
    }
  };

  // Handle reply
  const handleReply = () => {
    if (selectedMessage) {
      setReplyingTo(selectedMessage);
      setSelectedMessage(null);
    }
  };

  // Handle edit
  const handleEdit = () => {
    const currentUserId = user?.id || user?.userId;
    const msgSenderId = selectedMessage?.sender_id || selectedMessage?.senderId;
    if (selectedMessage && msgSenderId === currentUserId) {
      setEditingMessage(selectedMessage);
      setMessage(selectedMessage.content || '');
      setSelectedMessage(null);
    }
  };

  // Handle delete
  const handleDelete = async (deleteForEveryone: boolean) => {
    if (!selectedMessage) return;

    try {
      await messageService.deleteMessage(selectedMessage.id, deleteForEveryone);
      if (deleteForEveryone) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === selectedMessage.id
              ? { ...msg, deleted_at: new Date().toISOString(), deleted_for_all: true }
              : msg
          )
        );
      } else {
        setMessages((prev) => prev.filter((msg) => msg.id !== selectedMessage.id));
      }
      setSelectedMessage(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Handle star
  const handleStar = async () => {
    if (!selectedMessage) return;
    
    try {
      if (selectedMessage.starred) {
        await messageService.unstarMessage(selectedMessage.id);
      } else {
        await messageService.starMessage(selectedMessage.id);
      }
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === selectedMessage.id
            ? { ...msg, starred: !msg.starred }
            : msg
        )
      );
      setSelectedMessage(null);
    } catch (error) {
      console.error('Star error:', error);
    }
  };

  // Handle copy
  const handleCopy = () => {
    if (selectedMessage?.content) {
      navigator.clipboard.writeText(selectedMessage.content);
      setSelectedMessage(null);
    }
  };

  // Handle forward
  const handleForward = () => {
    setSelectedMessage(null);
  };

  const addFileToPending = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let previewUrl: string | undefined;
    if (type === 'image' || type === 'video') previewUrl = URL.createObjectURL(file);
    setPendingAttachments((prev) => [...prev, { id, file, name: file.name, size: file.size, type, previewUrl, uploadProgress: null }]);
  };

  const removePendingAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleMediaSelectAddToPreview = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    addFileToPending(file, type);
    setShowMediaUpload(false);
    setShowAttachmentMenu(false);
  };

  const openAttachmentPicker = (accept: string) => {
    setShowAttachmentMenu(false);
    if (attachmentMenuInputRef.current) {
      attachmentMenuInputRef.current.accept = accept;
      attachmentMenuInputRef.current.value = '';
      attachmentMenuInputRef.current.click();
    }
  };

  const handleAttachmentMenuFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileType = file.type;
    let type: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (fileType.startsWith('image/')) type = 'image';
    else if (fileType.startsWith('video/')) type = 'video';
    else if (fileType.startsWith('audio/')) type = 'audio';
    handleMediaSelectAddToPreview(file, type);
  };

  // Handle media upload (mirror DirectChat + mobile)
  const handleMediaSelect = async (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    if (!conversationId) return;
    setUploadingMedia(true);
    try {
      let uploadResponse: any;
      let messageType: string = type;

      switch (type) {
        case 'image':
          uploadResponse = await messageService.uploadImage(file);
          messageType = 'image';
          break;
        case 'video':
          uploadResponse = await messageService.uploadVideo(file);
          messageType = 'video';
          break;
        case 'audio':
          uploadResponse = await messageService.uploadAudio(file);
          messageType = 'audio';
          break;
        case 'document':
          uploadResponse = await messageService.uploadDocument(file);
          messageType = 'document';
          break;
      }

      const { storedValue } = extractUploadedMedia(uploadResponse);
      if (!storedValue) {
        throw new Error('No media key or URL returned from upload');
      }

      const socket = await waitForSocketConnection();
      socket.emit('send_message', {
        conversationId,
        messageType,
        mediaUrl: storedValue,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        replyToMessageId: replyingTo?.id || null,
        // Only send visibilityMode for task groups
        ...(isTaskGroup && { visibilityMode }),
      });

      setReplyingTo(null);
    } catch (error) {
      console.error('TaskGroup media upload error:', error);
      toast.error('Failed to upload media. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle voice note (mirror DirectChat + mobile)
  const handleVoiceNoteComplete = async (audioBlob: Blob) => {
    if (!conversationId) return;
    setUploadingMedia(true);
    try {
      const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
      const uploadResponse = await messageService.uploadVoiceNote(audioFile);

      const { storedValue } = extractUploadedMedia(uploadResponse);
      if (!storedValue) {
        throw new Error('No media key or URL returned from upload');
      }

      const socket = await waitForSocketConnection();
      socket.emit('send_message', {
        conversationId,
        messageType: 'voice_note',
        mediaUrl: storedValue,
        fileName: 'voice-note.webm',
        fileSize: audioBlob.size,
        mimeType: 'audio/webm',
        duration: 0,
        replyToMessageId: replyingTo?.id || null,
        // Only send visibilityMode for task groups
        ...(isTaskGroup && { visibilityMode }),
      });

      setReplyingTo(null);
    } catch (error) {
      console.error('TaskGroup voice note upload error:', error);
      toast.error('Failed to upload voice note. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle location share (mirror DirectChat + mobile)
  const handleLocationSelect = async (location: { lat: number; lng: number; address?: string }) => {
    if (!conversationId) return;
    try {
      const socket = await waitForSocketConnection();
      socket.emit('send_message', {
        conversationId,
        messageType: 'location',
        locationLat: location.lat,
        locationLng: location.lng,
        locationAddress: location.address,
        replyToMessageId: replyingTo?.id || null,
        // Only send visibilityMode for task groups
        ...(isTaskGroup && { visibilityMode }),
      });
      setReplyingTo(null);
    } catch (error) {
      console.error('TaskGroup location share error:', error);
      toast.error('Failed to share location. Please try again.');
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || !conversationId) return;

    setIsLoadingMore(true);
    try {
      const offset = messages.length;
      const response = await messageService.getMessagesByConversationId(conversationId, 50, offset);
      const rawMessages = response.messages || response.data || [];
      const newMessages = rawMessages.map((msg: any) => normalizeMessage(msg)).filter((msg: any) => msg !== null);
      
      if (newMessages.length > 0) {
        setMessages((prev) => {
          const combined = [...newMessages.reverse(), ...prev];
          const unique = combined.filter((msg, index, self) =>
            index === self.findIndex(m => m.id === msg.id)
          );
          return unique.sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime();
            const timeB = new Date(b.created_at || 0).getTime();
            return timeA - timeB;
          });
        });
        setHasMoreMessages(newMessages.length >= 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Load more messages error:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Fetch conversations list for sidebar
  const { data: conversations = [] } = useQuery(
    'conversations',
    () => conversationService.getConversations(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Get conversation name and photo
  const conversationName = conversationData?.name || conversationData?.data?.name || 'Task Group';
  const conversationPhoto = conversationData?.photoUrl || conversationData?.data?.photoUrl || conversationData?.group_photo || '';
  const groupMembers = conversationData?.otherMembers || conversationData?.data?.otherMembers || conversationData?.other_members || [];
  // Get taskId from route params (when in task module) or from conversation data
  const taskId = routeTaskId || conversationData?.taskId || conversationData?.data?.taskId || conversationData?.task_id;

  // Fetch task data for verification logic
  const { data: taskData } = useQuery(
    ['task', taskId],
    () => taskService.getTask(taskId!),
    { enabled: !!taskId }
  );

  const task = taskData;
  const currentUserId = user?.id || (user as any)?.userId;

  // Check if current user is the task creator (task owner; use String so it works when owner was set by admin)
  const isTaskCreator = () => {
    if (!task || !currentUserId) return false;
    const creatorId = task.created_by ?? task.creator_id;
    return !!creatorId && String(creatorId) === String(currentUserId);
  };

  // Check if current user is the reporting member
  const isReportingMember = () => {
    if (!task || !currentUserId) return false;
    const reportingMemberId = task.reporting_member_id;
    return !!reportingMemberId && String(reportingMemberId) === String(currentUserId);
  };

  // Check if current user can verify a specific member (task owner can verify assignees who completed)
  const canVerifyMember = (targetMemberId: string) => {
    if (!task || !user) return false;
    
    const taskCreatorId = task.created_by ?? task.creator_id;
    const reportingMemberId = task.reporting_member_id;
    const isCurrentUserCreator = !!taskCreatorId && !!currentUserId && String(taskCreatorId) === String(currentUserId);
    const isCurrentUserReportingMember = !!reportingMemberId && !!currentUserId && String(reportingMemberId) === String(currentUserId);
    const isTargetReportingMember = String(targetMemberId ?? '') === String(reportingMemberId ?? '');
    const isTargetCreator = String(targetMemberId ?? '') === String(taskCreatorId ?? '');
    const isTargetCurrentUser = String(targetMemberId ?? '') === String(currentUserId ?? '');
    
    // Cannot verify yourself
    if (isTargetCurrentUser) return false;
    
    // Creator can verify reporting member (or all assignees if no reporting member)
    if (isCurrentUserCreator) {
      if (reportingMemberId) {
        // If there's a reporting member, creator can only verify the reporting member
        return isTargetReportingMember;
      } else {
        // If no reporting member, creator can verify all assignees
        return true;
      }
    }
    
    // Reporting member can verify non-reporting assignees (but not creator or themselves)
    if (isCurrentUserReportingMember) {
      return !isTargetCreator && !isTargetReportingMember && !isTargetCurrentUser;
    }
    
    // Regular assignees cannot verify anyone
    return false;
  };

  // Verify completion mutation
  const verifyCompletionMutation = useMutation(
    (memberUserId: string) => {
      if (!taskId) {
        throw new Error('Missing taskId');
      }
      return taskService.verifyMemberCompletion(taskId, memberUserId);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['conversations']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        loadMessages(); // Reload messages to show verification message
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

  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Get current user assignee (EXACT mobile logic)
  const currentUserAssignee = React.useMemo(() => {
    if (!task?.assignees || !Array.isArray(task.assignees)) return null;
    return task.assignees.find((a: any) => {
      const assigneeId = a.id || a.user_id || a.userId;
      return assigneeId === currentUserId;
    });
  }, [task?.assignees, currentUserId]);

  // Check if current user can mark complete. After verify, task.status is 'completed' but creator still needs to mark complete — show button for creator.
  const canMarkComplete = React.useMemo(() => {
    if (!currentUserAssignee || !task) return false;
    const hasAccepted = currentUserAssignee.accepted_at || currentUserAssignee.has_accepted;
    const hasCompleted =
      !!currentUserAssignee.completed_at ||
      currentUserAssignee.completion_status === 'completed' ||
      currentUserAssignee.status === 'completed';
    const taskOwnerId = task.created_by ?? task.creator_id;
    const isCreator = !!taskOwnerId && !!currentUserId && String(taskOwnerId) === String(currentUserId);
    return (isCreator || hasAccepted) && !hasCompleted && (task.status !== 'completed' || isCreator);
  }, [currentUserAssignee, task, currentUserId]);

  // Mark member complete mutation - sends to backend (EXACT mobile flow)
  const markCompleteMutation = useMutation(
    () => {
      if (!taskId || !currentUserId) {
        throw new Error('Missing taskId or userId');
      }
      return taskService.markMemberComplete(taskId, currentUserId);
    },
    {
      onSuccess: async (data: any) => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['conversations']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        if (user?.role === 'admin') {
          queryClient.invalidateQueries(['admin-dashboard']);
          queryClient.invalidateQueries(['admin-dashboard-statistics']);
        }
        // Send chat message (mirror mobile)
        try {
          const socket = await waitForSocketConnection();
          const text =
            data?.taskCompleted || isTaskCreator()
              ? '✓ I have completed my part. Task is now completed!'
              : 'I have completed my part of the task. Please verify.';
          socket.emit('send_message', {
            conversationId,
            text,
            messageType: 'text',
          });
        } catch (e) {
          console.warn('Socket send after mark complete:', e);
        }
        const message =
          data?.taskCompleted
            ? 'Task completed. The entire task has been marked as completed.'
            : 'Your completion has been marked and sent for approval.';
        toast.success(message);
      },
      onError: (error: any) => {
        toast.error(
          error?.response?.data?.error ||
            error?.message ||
            'Failed to mark task as complete'
        );
      },
    }
  );

  const handleMarkComplete = () => {
    if (!taskId || !currentUserId) return;
    const confirmMessage = isTaskCreator()
      ? 'As the creator, marking complete will complete the entire task for everyone. Continue?'
      : 'Have you completed your part of this task? Your completion will need to be verified.';
    toast.confirm(confirmMessage, {
      onConfirm: async () => {
        try {
          setIsCompleting(true);
          await markCompleteMutation.mutateAsync();
        } finally {
          setIsCompleting(false);
        }
      },
      confirmLabel: 'Yes',
      cancelLabel: 'Cancel',
    });
  };

  const handleVerifyCompletion = async (memberUserId: string) => {
    if (!taskId) return;
    
    const member = task?.assignees?.find((a: any) => {
      const assigneeId = a.id || a.user_id || a.userId;
      return assigneeId === memberUserId;
    });
    const memberName = member?.name || 'User';
    
    toast.confirm(`Verify that ${memberName} has completed their part of the task?`, {
      onConfirm: async () => {
        try {
          setVerifyingUserId(memberUserId);
          await verifyCompletionMutation.mutateAsync(memberUserId);
          const socket = await waitForSocketConnection();
          socket.emit('send_message', {
            conversationId,
            text: `✓ Verified ${memberName}'s completion.`,
            messageType: 'text',
          });
        } finally {
          setVerifyingUserId(null);
        }
      },
      confirmLabel: 'Verify',
      cancelLabel: 'Cancel',
    });
  };

  // Get assignees from task
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

  // Check if member needs verification (completed but not verified; creator doesn't need verification from others)
  const needsVerification = (assignee: any) => {
    if (task?.status === 'completed') return false;
    if (!assignee.completed_at) return false;
    if (assignee.verified_at) return false;
    
    const assigneeId = assignee.id || assignee.user_id || assignee.userId;
    const taskCreatorId = task?.created_by ?? task?.creator_id;
    const isCreator = !!assigneeId && !!taskCreatorId && String(assigneeId) === String(taskCreatorId);
    
    if (isCreator) return false;
    
    return !!assignee.completed_at && !assignee.verified_at;
  };

  // Get pending verifications
  const pendingVerifications = React.useMemo(() => {
    return assignees.filter((assignee: any) => {
      const assigneeId = assignee.id || assignee.user_id || assignee.userId;
      return needsVerification(assignee) && canVerifyMember(assigneeId);
    });
  }, [assignees, task]);

  // Render message component
  const renderMessage = (msg: any, index: number) => {
    const messageSenderId = msg.sender_id || msg.senderId;
    const currentUserId = user?.id || user?.userId;
    const isMyMessage = messageSenderId === currentUserId;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = shouldShowDateSeparator(msg, previousMessage);
    const messageStatus = msg.status || 'sent';
    const messageType = msg.message_type || 'text';
    const senderName = msg.sender_name || msg.senderName || 'Unknown';
    const visibilityMode = msg.visibility_mode || msg.visibilityMode || 'shared_to_group';

    // Status icon and color
    let statusIcon = null;
    let statusColor = '#6B7280';
    if (isMyMessage) {
      if (messageStatus === 'read') {
        statusIcon = '✓✓';
        statusColor = '#7C3AED';
      } else if (messageStatus === 'delivered') {
        statusIcon = '✓✓';
        statusColor = '#6B7280';
      } else {
        statusIcon = '✓';
        statusColor = '#6B7280';
      }
    }

    // Deleted message
    if (msg.deleted_at && msg.deleted_for_all) {
      return (
        <div key={msg.id} className="w-full">
          {showDateSeparator && (
            <div className="flex justify-center py-2">
              <span className="bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-1 rounded-full">
                {formatDate(msg.created_at)}
              </span>
            </div>
          )}
          <div className="flex justify-center py-2">
            <p className="text-gray-400 dark:text-gray-500 text-sm italic">This message was deleted</p>
          </div>
        </div>
      );
    }

    // System messages
    if (messageType === 'system' || msg.type === 'system') {
      return (
        <div key={msg.id} className="w-full">
          {showDateSeparator && (
            <div className="flex justify-center py-2">
              <span className="bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-1 rounded-full">
                {formatDate(msg.created_at)}
              </span>
            </div>
          )}
          <div className="flex justify-center w-full">
            <div className="bg-gray-200 dark:bg-gray-800 rounded-full px-4 py-1.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-500 text-base">smart_toy</span>
              <p className="text-gray-600 dark:text-gray-400 text-xs font-medium">{msg.content}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className="w-full">
        {showDateSeparator && (
          <div className="flex justify-center py-2">
            <span className="bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-1 rounded-full">
              {formatDate(msg.created_at)}
            </span>
          </div>
        )}
        
        <div className={`flex items-end gap-3 group ${isMyMessage ? 'justify-end' : ''}`}>
          {!isMyMessage && (
            <div 
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8 shrink-0 mb-1 shadow-sm bg-primary/20 flex items-center justify-center"
            >
              {msg.sender_photo ? (
                <img
                  src={msg.sender_photo}
                  alt={senderName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-primary text-xs font-semibold">
                  {senderName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          )}
          
          <div 
            className={`flex flex-col gap-1 ${isMyMessage ? 'items-end' : 'items-start'} max-w-[80%]`}
            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
          >
            {/* Sender name for group chats */}
            <div className="flex items-center gap-2 px-1 mb-0.5">
              {!isMyMessage && (
                <span className="text-xs text-gray-600 dark:text-gray-300 font-semibold">
                  {senderName}
                </span>
              )}
              {/* Visibility badge – show only for Org-Only messages in Task Groups */}
              {isTaskGroup && visibilityMode === 'org_only' && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  title="Visible only to members of your organization"
                >
                  Org-Only
                </span>
              )}
            </div>

            {/* Reply Preview */}
            {msg.reply_to && (
              <div className="border-l-4 border-primary/50 pl-2 ml-2 mb-1">
                <p className="text-xs font-semibold text-primary">
                  {msg.reply_to.sender_name || 'Unknown'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {msg.reply_to.content || `Sent a ${msg.reply_to.message_type}`}
                </p>
              </div>
            )}

            {/* Message content based on type */}
            {messageType === 'image' && msg.media_url && (
              <ImageMessage 
                mediaUrl={msg.media_url} 
                mediaThumbnail={msg.media_thumbnail}
                isMyMessage={isMyMessage}
              />
            )}

            {messageType === 'video' && msg.media_url && (
              <VideoMessage 
                mediaUrl={msg.media_url} 
                mediaThumbnail={msg.media_thumbnail}
                isMyMessage={isMyMessage}
              />
            )}

            {messageType === 'document' && (
              <DocumentMessage 
                fileName={msg.file_name}
                fileSize={msg.file_size}
                mediaUrl={msg.media_url}
                isMyMessage={isMyMessage}
              />
            )}

            {messageType === 'location' && (
              <LocationMessage 
                latitude={msg.latitude}
                longitude={msg.longitude}
                locationName={msg.location_name}
                isMyMessage={isMyMessage}
              />
            )}

            {messageType === 'voice' || messageType === 'voice_note' ? (
              <VoiceMessage 
                mediaUrl={msg.media_url}
                duration={msg.duration}
                isMyMessage={isMyMessage}
              />
            ) : messageType === 'text' && msg.content && (
              <div className={`relative px-4 py-3 rounded-2xl shadow-md border ${isMyMessage ? 'bg-[#EDE9FE] text-[#1F2937] rounded-br-none shadow-primary/30 border-[#A78BFA]' : 'bg-[#F9FAFB] dark:bg-gray-800 text-[#1F2937] dark:text-gray-100 rounded-bl-none border-[#E5E7EB] dark:border-gray-700 shadow-sm'}`}>
                {msg.edited_at && (
                  <span className={`text-[10px] mr-2 italic ${isMyMessage ? 'text-[#6B7280]' : 'text-[#6B7280] dark:text-gray-400'}`}>Edited</span>
                )}
                <p className={`text-[15px] font-normal leading-relaxed break-words ${isMyMessage ? 'text-[#1F2937]' : 'text-[#1F2937] dark:text-gray-100'}`}>{msg.content}</p>
                <div className={`flex items-center justify-end gap-1.5 mt-2 ${isMyMessage ? '' : 'absolute bottom-1 right-3'}`}>
                  <span className={`text-[11px] ${isMyMessage ? 'text-[#6B7280]' : 'text-[#6B7280] dark:text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </span>
                  {isMyMessage && statusIcon && (
                    <span 
                      className="material-icons-round text-[16px] font-semibold leading-none" 
                      style={{ color: statusColor }}
                    >
                      {statusIcon === '✓✓' ? 'done_all' : 'done'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Reactions */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {msg.reactions.map((reaction: any, idx: number) => (
                  <span key={idx} className="text-sm">
                    {reaction.reaction}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Conversation list content for sidebar
  const conversationListContent = (
    <ConversationList
      conversations={conversations}
      currentConversationId={conversationId}
      filter={conversationFilter}
      searchQuery={conversationSearchQuery}
      onFilterChange={setConversationFilter}
      onSearchChange={setConversationSearchQuery}
      onCreateNew={() => setShowNewChatModal(true)}
      hideHeader={!isAdmin}
      hideSearchAndFilters={isFromTaskModule}
    />
  );

  const handleSearch = async () => {
    if (!searchQuery.trim() || !conversationId) return;
    try {
      const response = await messageService.searchMessagesInConversation(conversationId, searchQuery);
      const results = response.messages || response.data || response || [];
      setSearchResults(results.map((msg: any) => normalizeMessage(msg)).filter((msg: any) => msg !== null));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  const mainContent = (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] dark:bg-surface-dark relative overflow-hidden h-full">
      {/* Header */}
      <header 
        className="h-20 border-b border-border-light dark:border-border-dark flex items-center justify-between px-6 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-sm z-10"
      >
        <button
          onClick={() => {
            // Navigate to full Task Details page from the task header
            const id = effectiveTaskId || taskId;
            if (!id) return;
            if (isAdmin) {
              navigate(`/admin/tasks/${id}`);
            } else {
              navigate(`/tasks/${id}`);
            }
          }}
          className="flex items-center gap-4 flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-md overflow-hidden">
              {conversationPhoto ? (
                <img src={conversationPhoto} alt={conversationName} className="w-full h-full rounded-xl object-cover" />
              ) : (
                <span className="material-icons-outlined opacity-50 text-xl">groups</span>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {conversationName}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isTyping ? (
                <span className="flex items-center gap-1">
                  <span>typing</span>
                  <span className="flex gap-0.5">
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                  </span>
                </span>
              ) : (
                `${groupMembers.length} ${groupMembers.length === 1 ? 'member' : 'members'}`
              )}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-4 text-gray-400" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowMessageSearch(!showMessageSearch);
            }}
            className="hover:text-primary transition"
            title="Search messages"
          >
            <span className="material-icons-outlined">search</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handlePinClick();
            }}
            className={`hover:text-primary transition ${isPinned ? 'text-primary' : ''}`}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <span className="material-icons-outlined">{isPinned ? 'push_pin' : 'push_pin'}</span>
          </button>
          <div className="relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreMenu((prev) => !prev);
              }}
              className="hover:text-primary transition"
              title="More options"
            >
              <span className="material-icons-outlined">more_vert</span>
            </button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} aria-hidden="true" />
                <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowTaskGroupDetails(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                  >
                    <span className="material-icons-outlined text-lg">info</span>
                    Task group details
                  </button>
                  {taskId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowTaskDetails(true);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                    >
                      <span className="material-icons-outlined text-lg">assignment</span>
                      View task
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Mark My Task Complete Section - EXACT mobile logic (assignee completion sends to backend) */}
      {canMarkComplete && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 px-6 py-4">
          <button
            onClick={handleMarkComplete}
            disabled={isCompleting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
          >
            {isCompleting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                <span>Marking complete...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                <span>Mark My Task Complete</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Pending Verifications Section - EXACT mobile logic */}
      {pendingVerifications.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-4">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 mb-3">
            {isTaskCreator() 
              ? 'Pending Verifications' 
              : isReportingMember() 
                ? 'Pending Verifications (Your Reports)'
                : 'Pending Verifications'}
          </h3>
          <div className="space-y-2">
            {pendingVerifications.map((assignee: any) => {
              const assigneeId = assignee.id || assignee.user_id || assignee.userId;
              return (
                <div 
                  key={assigneeId} 
                  className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center gap-3">
                    {assignee.profile_photo_url || assignee.profile_photo ? (
                      <img
                        src={assignee.profile_photo_url || assignee.profile_photo}
                        alt={assignee.name || 'Member'}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-primary text-sm font-semibold">
                          {(assignee.name || 'U').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {assignee.name || 'Unknown'} marked as complete
                    </span>
                  </div>
                  <button
                    onClick={() => handleVerifyCompletion(assigneeId)}
                    disabled={verifyingUserId === assigneeId}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {verifyingUserId === assigneeId ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">verified</span>
                        <span>Verify</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Message Search */}
      {showMessageSearch && (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="flex-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleSearch}
              className="bg-primary hover:bg-primary-dark text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Search
            </button>
            <button
              onClick={() => {
                setShowMessageSearch(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F9FAFB] dark:bg-[#18181b]">
        {hasMoreMessages && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadMoreMessages}
              disabled={isLoadingMore}
              className="bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-1 rounded-full shadow-sm hover:bg-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400 text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => renderMessage(msg, index))
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Reply Bar */}
      {replyingTo && (
        <div className="bg-gray-100 dark:bg-gray-800 border-l-4 border-primary px-4 py-2 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary mb-0.5">
              Replying to {replyingTo.sender_name || 'Unknown'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {replyingTo.content || `Sent a ${replyingTo.message_type}`}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Edit Bar */}
      {editingMessage && (
        <div className="bg-primary/10 dark:bg-primary/20 border-l-4 border-primary px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-primary">Editing message</span>
          <button
            onClick={() => {
              setEditingMessage(null);
              setMessage('');
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 sm:p-4 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark relative shrink-0">
        {/* File upload preview strip */}
        {pendingAttachments.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-4 mb-2 -mx-2 px-2 scroll-smooth max-w-5xl mx-auto" style={{ scrollbarWidth: 'thin' }}>
            {pendingAttachments.map((item) => (
              <div key={item.id} className="flex-shrink-0 w-32 h-32 relative group rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-gray-100 dark:bg-gray-800">
                {item.type === 'image' && item.previewUrl ? (
                  <>
                    <img alt={item.name} className="w-full h-full object-cover" src={item.previewUrl} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                    <button type="button" onClick={() => removePendingAttachment(item.id)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
                      <span className="material-icons-round !text-[14px]">close</span>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-[10px] text-white truncate font-medium">{item.name}</p>
                    </div>
                  </>
                ) : item.type === 'document' ? (
                  <>
                    <button type="button" onClick={() => removePendingAttachment(item.id)} className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-gray-200/50 dark:bg-gray-700/50 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
                      <span className="material-icons-round !text-[14px]">close</span>
                    </button>
                    <div className="w-full h-full flex flex-col items-center justify-center p-3">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center text-red-600 dark:text-red-400 mb-2">
                        <span className="material-symbols-outlined">picture_as_pdf</span>
                      </div>
                      <p className="text-[10px] text-gray-600 dark:text-gray-300 font-semibold text-center line-clamp-2">{item.name}</p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 uppercase tracking-wider">{formatFileSize(item.size)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => removePendingAttachment(item.id)} className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-gray-200/50 dark:bg-gray-700/50 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
                      <span className="material-icons-round !text-[14px]">close</span>
                    </button>
                    <div className="w-full h-full flex flex-col items-center justify-center p-3">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 mb-2">
                        <span className="material-symbols-outlined">{item.type === 'video' ? 'videocam' : item.type === 'audio' ? 'audiotrack' : 'description'}</span>
                      </div>
                      <p className="text-[10px] text-gray-600 dark:text-gray-300 font-semibold text-center line-clamp-2">{item.name}</p>
                      <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 uppercase tracking-wider">{formatFileSize(item.size)}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Plus menu (attachments): Upload File, Upload Image, Upload Video, Add Member (Task Group) */}
        {showAttachmentMenu && (
          <div className="absolute bottom-[calc(100%+12px)] left-6 w-56 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-2xl overflow-hidden py-2 z-20">
            <button
              type="button"
              onClick={() => openAttachmentPicker('*/*')}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group text-left"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <span className="material-icons-round text-base">upload_file</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Upload File</span>
            </button>
            <button
              type="button"
              onClick={() => openAttachmentPicker('image/*')}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group text-left"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <span className="material-icons-round text-base">image</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Upload Image</span>
            </button>
            <button
              type="button"
              onClick={() => openAttachmentPicker('video/*')}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group text-left"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <span className="material-icons-round text-base">videocam</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Upload Video</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAttachmentMenu(false);
                setOpenGroupDetailsForAddMembers(true);
                setShowTaskGroupDetails(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group text-left"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <span className="material-icons-round text-base">person_add</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Add Member (For Task Group)</span>
            </button>
          </div>
        )}
        <input
          ref={attachmentMenuInputRef}
          type="file"
          className="hidden"
          onChange={handleAttachmentMenuFileChange}
        />

        <div className="flex flex-col gap-1 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 bg-gray-100 dark:bg-background-dark/70 p-2 sm:p-3 rounded-2xl border border-border-light dark:border-border-dark relative">
            {/* Plus button */}
            <button
              type="button"
              className="p-2 sm:p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              onClick={() => setShowAttachmentMenu((prev) => !prev)}
              title="More options"
              aria-label="More options"
            >
              <span className="material-icons-round text-lg sm:text-xl">add_circle</span>
            </button>

            {/* Quick image shortcut */}
            <button
              type="button"
              className="p-2 sm:p-2.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
              onClick={() => setShowMediaUpload(true)}
              title="Send photo or video"
              aria-label="Send photo or video"
            >
              <span className="material-icons-round text-lg sm:text-xl">image</span>
            </button>

            {/* Input */}
          <textarea
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm sm:text-base text-gray-900 dark:text-gray-100 resize-none max-h-32 placeholder-gray-400 dark:placeholder-gray-500 py-2 sm:py-2.5 px-2 sm:px-3 min-h-[44px] leading-relaxed"
            placeholder={editingMessage ? 'Edit message...' : pendingAttachments.length > 0 ? 'Add a caption...' : 'Type a message...'}
            rows={1}
            value={message}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {/* Emoji */}
          <button
            type="button"
            className="p-2 sm:p-2.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            onClick={() => setShowEmojiPicker(true)}
            title="Emoji"
            aria-label="Emoji"
          >
            <span className="material-icons-round text-lg sm:text-xl">sentiment_satisfied_alt</span>
          </button>

          {/* Voice note */}
          <button
            type="button"
            className="p-2 sm:p-2.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            title="Voice note"
            aria-label="Voice note"
            onClick={() => setShowVoiceRecorder(true)}
          >
            <span className="material-icons-round text-lg sm:text-xl">mic</span>
          </button>
            {/* Send */}
            <button
              type="button"
              onClick={handleSend}
              disabled={(!message.trim() && !replyingTo && !editingMessage && pendingAttachments.length === 0) || sendMessageMutation.isLoading || uploadingMedia}
              className="p-2.5 sm:p-3 bg-primary hover:bg-primary-dark text-white rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] shrink-0"
              aria-label="Send message"
            >
              <span className="material-icons-round text-lg sm:text-xl -rotate-45 translate-x-[1px] -translate-y-[1px]">
                send
              </span>
            </button>

            {/* Spacer for FAB - reserves space so send button doesn't get hidden */}
            <div className="w-12 sm:w-14 md:w-16 lg:w-20 flex-shrink-0"></div>
          </div>

          {/* Visibility toggle row (Org-Only vs Shared-to-Group) - ONLY for Task Groups */}
          {isTaskGroup && (
            <div className="flex items-center justify-end px-1">
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setVisibilityMode('shared_to_group')}
                  className={`px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
                    visibilityMode === 'shared_to_group'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="material-icons-round" style={{ fontSize: 12 }}>
                    public
                  </span>
                  <span>Shared to All</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibilityMode('org_only')}
                  className={`px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors ${
                    visibilityMode === 'org_only'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className="material-icons-round" style={{ fontSize: 12 }}>
                    business
                  </span>
                  <span>Org-Only</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Action Sheet */}
      <MessageActionSheet
        visible={!!selectedMessage}
        isMyMessage={(selectedMessage?.sender_id || selectedMessage?.senderId) === (user?.id || user?.userId)}
        isGroup={true}
        isStarred={selectedMessage?.starred || false}
        onCreateTask={
          selectedMessage?.message_type === 'document' && selectedMessage?.media_url
            ? () => {
                setCreateTaskAttachment({
                  mediaUrl: selectedMessage.media_url,
                  fileName: selectedMessage.file_name,
                  fileSize: selectedMessage.file_size,
                  mimeType: selectedMessage.mime_type,
                });
                setShowCreateTaskModal(true);
              }
            : undefined
        }
        onReply={handleReply}
        onCopy={handleCopy}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStar={handleStar}
        onReact={() => setShowEmojiPicker(true)}
        onForward={handleForward}
        onClose={() => setSelectedMessage(null)}
      />

      {/* Emoji Picker */}
      <EmojiPicker
        visible={showEmojiPicker}
        onSelect={handleReaction}
        onClose={() => setShowEmojiPicker(false)}
      />

      {/* Media Upload */}
      <MediaUpload
        visible={showMediaUpload}
        onSelect={handleMediaSelectAddToPreview}
        onClose={() => setShowMediaUpload(false)}
      />

      {/* Voice Recorder */}
      <VoiceRecorder
        visible={showVoiceRecorder}
        onRecordComplete={handleVoiceNoteComplete}
        onClose={() => setShowVoiceRecorder(false)}
      />

      {/* Location Picker */}
      <LocationPicker
        visible={showLocationPicker}
        onLocationSelect={handleLocationSelect}
        onClose={() => setShowLocationPicker(false)}
      />

      <TaskCreateModal
        visible={showCreateTaskModal}
        onClose={() => {
          setShowCreateTaskModal(false);
          setCreateTaskAttachment(null);
        }}
        onSuccess={() => {
          toast.success('Task created');
          setShowCreateTaskModal(false);
          setCreateTaskAttachment(null);
        }}
        initialTitle={
          createTaskAttachment?.fileName ? `Follow up: ${createTaskAttachment.fileName}` : 'Follow up document'
        }
        initialDescription={
          createTaskAttachment?.fileName ? `Document: ${createTaskAttachment.fileName}` : 'Document attached from chat'
        }
        documentAttachment={createTaskAttachment || undefined}
      />
    </div>
  );

  // When embedded in Task Dashboard: no layout, only chat content + modals (parent has task list)
  if (embedInTaskDashboard) {
    return (
      <>
        <div className="flex-1 flex flex-col bg-surface-light dark:bg-surface-dark relative overflow-hidden h-full">
          {mainContent}
        </div>
        <TaskDetailsModal
          visible={showTaskDetails}
          onClose={() => setShowTaskDetails(false)}
          taskId={effectiveTaskId || undefined}
        />
        <TaskGroupDetailsModal
          visible={showTaskGroupDetails}
          onClose={() => {
            setShowTaskGroupDetails(false);
            setOpenGroupDetailsForAddMembers(false);
          }}
          taskId={taskId}
          conversationId={conversationId}
          conversationData={conversationData}
          openAddMembers={openGroupDetailsForAddMembers}
        />
        <NewChatModal
          visible={showNewChatModal}
          onClose={() => setShowNewChatModal(false)}
        />
      </>
    );
  }

  // Wrap in appropriate layout matching DirectChatConversation structure
  // If accessed from task module, use full width (no conversation list sidebar)
  if (isFromTaskModule) {
    // Full width layout for task module (like TaskDetailsScreen)
    if (isAdmin) {
      return (
        <AdminLayout hideSearch>
          <div className="flex-1 flex flex-col bg-surface-light dark:bg-surface-dark relative overflow-hidden h-full">
            {mainContent}

            {/* Task Details Modal */}
            <TaskDetailsModal
              visible={showTaskDetails}
              onClose={() => setShowTaskDetails(false)}
              taskId={effectiveTaskId || undefined}
            />

            {/* New Chat Modal */}
            <NewChatModal
              visible={showNewChatModal}
              onClose={() => setShowNewChatModal(false)}
            />
          </div>
        </AdminLayout>
      );
    }

    // Employee route - full width
    return (
      <EmployeeLayout hideSearch>
        <div className="flex-1 flex flex-col bg-surface-light dark:bg-surface-dark relative overflow-hidden h-full">
          {mainContent}

          {/* Task Details Modal */}
          <TaskDetailsModal
            visible={showTaskDetails}
            onClose={() => setShowTaskDetails(false)}
            taskId={effectiveTaskId || undefined}
          />

          {/* New Chat Modal */}
          <NewChatModal
            visible={showNewChatModal}
            onClose={() => setShowNewChatModal(false)}
          />
        </div>
      </EmployeeLayout>
    );
  }

  // Normal layout with conversation list (when accessed from messages module)
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

        {/* Task Details Modal */}
        <TaskDetailsModal
          visible={showTaskDetails}
          onClose={() => setShowTaskDetails(false)}
          taskId={effectiveTaskId || undefined}
        />

        {/* Task Group Details Modal */}
        <TaskGroupDetailsModal
          visible={showTaskGroupDetails}
          onClose={() => {
            setShowTaskGroupDetails(false);
            setOpenGroupDetailsForAddMembers(false);
          }}
          taskId={taskId}
          conversationId={conversationId}
          conversationData={conversationData}
          openAddMembers={openGroupDetailsForAddMembers}
        />

        {/* New Chat Modal */}
        <NewChatModal
          visible={showNewChatModal}
          onClose={() => setShowNewChatModal(false)}
        />
      </AdminLayout>
    );
  }

  // Employee route - use EmployeeLayout with conversation list
  return (
    <EmployeeLayout
      showConversationList
      conversationListContent={conversationListContent}
      hideSearch
    >
      {mainContent}

      {/* Task Details Modal */}
      <TaskDetailsModal
        visible={showTaskDetails}
        onClose={() => setShowTaskDetails(false)}
        taskId={effectiveTaskId || undefined}
      />

      {/* Task Group Details Modal */}
      <TaskGroupDetailsModal
        visible={showTaskGroupDetails}
        onClose={() => {
          setShowTaskGroupDetails(false);
          setOpenGroupDetailsForAddMembers(false);
        }}
        taskId={taskId}
        conversationId={conversationId}
        conversationData={conversationData}
        openAddMembers={openGroupDetailsForAddMembers}
      />

      {/* New Chat Modal */}
      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
      />
    </EmployeeLayout>
  );
};
