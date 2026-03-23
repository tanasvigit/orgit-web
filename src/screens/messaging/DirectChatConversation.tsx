import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { parseTimestamp, formatChatTime, formatChatDate } from '../../utils/chatTime';
import { messageService } from '../../services/messageService';
import { conversationService } from '../../services/conversationService';
import { waitForSocketConnection, joinConversationRoom, leaveConversationRoom, onSocketEvent, offSocketEvent, sendMessageViaSocket, getSocket } from '../../services/socketService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ConversationList } from '../../components/messaging/ConversationList';
import { NewChatModal } from '../../components/messaging/NewChatModal';
import { ReplyMessage } from '../../components/messaging/ReplyMessage';
import { MessageReactions } from '../../components/messaging/MessageReactions';
import { MessageActionSheet } from '../../components/messaging/MessageActionSheet';
import { EmojiPicker } from '../../components/messaging/EmojiPicker';
import { ImageMessage } from '../../components/messaging/ImageMessage';
import { VideoMessage } from '../../components/messaging/VideoMessage';
import { DocumentMessage } from '../../components/messaging/DocumentMessage';
import { LocationMessage } from '../../components/messaging/LocationMessage';
import { VoiceMessage } from '../../components/messaging/VoiceMessage';
import { MediaUpload } from '../../components/messaging/MediaUpload';
import { VoiceRecorder } from '../../components/messaging/VoiceRecorder';
import { LocationPicker } from '../../components/messaging/LocationPicker';
import { UserProfileModal } from '../../components/messaging/UserProfileModal';
import { extractUploadedMedia } from '../../utils/chatMedia';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';

export const DirectChatConversation: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const socketCleanupRef = useRef<(() => void) | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPendingTempIdRef = useRef<string | null>(null);
  const attachmentMenuInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  
  // Mobile ChatScreen features state
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  /** Single source of truth for online status: list of userIds from socket (online_users / user_online / user_offline). */
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [createTaskAttachment, setCreateTaskAttachment] = useState<{
    mediaUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  } | null>(null);
  // File upload preview state: files selected to send, shown above input
  type PendingAttachment = {
    id: string;
    file: File;
    name: string;
    size: number;
    type: 'image' | 'video' | 'audio' | 'document';
    previewUrl?: string;
    uploadProgress: number | null; // null = not started, 0-100 = uploading/done
  };
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // Fetch conversations list for sidebar
  const { data: conversations = [] } = useQuery(
    'conversations',
    () => conversationService.getConversations(),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  // Fetch conversation details
  const { data: conversationData } = useQuery(
    ['conversation', conversationId],
    () => conversationService.getConversationDetails(conversationId!),
    {
      enabled: !!conversationId,
      onSuccess: (data) => {
        const currentUserId = user?.id || user?.userId;
        const otherMembers = data.otherMembers || data.other_members || [];
        if (!data.is_group && !data.is_task_group) {
          const otherUser = otherMembers.find((m: any) => {
            const memberId = m.id || m.user_id || m.userId;
            return memberId && memberId !== currentUserId;
          });
          if (otherUser) {
            const otherUserIdValue = otherUser.id || otherUser.user_id || otherUser.userId;
            if (otherUserIdValue && otherUserIdValue !== currentUserId) {
              setOtherUserId(otherUserIdValue);
            }
          }
        }
      },
    }
  );
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
      created_at: msg.created_at || msg.createdAt,
      updated_at: msg.updated_at || msg.updatedAt,
    };
  };

  // Load messages function (matching mobile implementation exactly)
  const loadMessages = async () => {
    if (!conversationId) return;
    
    try {
      setLoading(true);
      const data = await messageService.getMessagesByConversationId(conversationId, 50, 0);
      console.log('Loaded messages from API:', data.length);
      
      // Normalize messages to ensure consistent field names
      const normalizedMessages = data.map((msg: any) => normalizeMessage(msg)).filter((msg: any) => msg !== null);
        
        // Remove any temp messages when loading from API (they should have been replaced by real messages)
      const currentUserId = user?.id;
      const messagesWithoutTemp = normalizedMessages.filter((msg: any) => {
          // Keep real messages and temp messages from other users (shouldn't happen, but safety check)
          if (!msg.id?.startsWith('temp_')) return true;
          // Remove temp messages from current user - they should have real messages now
          if (msg.sender_id === currentUserId || msg.senderId === currentUserId) {
            console.log('[loadMessages] Removing temp message from loaded data:', msg.id);
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
      
      console.log('Normalized and sorted messages:', messagesWithoutTemp.length);
        setMessages(messagesWithoutTemp);
        setHasMoreMessages(data.length >= 50);
        
      // Calculate unread count (messages from other users that are not read)
        const unread = messagesWithoutTemp.filter(
          (msg: any) => {
            const msgSenderId = msg.sender_id || msg.senderId;
            return msgSenderId !== currentUserId && msg.status !== 'read' && !msg.deleted_at;
          }
        ).length;
        setUnreadCount(unread);
      
      // Mark messages as read when they're loaded (matching mobile)
      if (unread > 0) {
        setTimeout(async () => {
          try {
            await messageService.markMessagesAsReadByConversationId(conversationId);
            const socket = await waitForSocketConnection();
            socket.emit('message_read', {
              conversationId,
            });
          } catch (error) {
            console.error('Error marking messages as read after load:', error);
          }
        }, 500);
      }
        
        setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load messages when conversationId changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    }
  }, [conversationId]);

  // Check online status function (matching mobile)
  const checkOnlineStatus = async (userId?: string) => {
    const targetUserId = userId || otherUserId;
    const isGroup = conversationData?.type === 'group' || conversationData?.is_group;
    const isTaskGroup = conversationData?.isTaskGroup || conversationData?.is_task_group;
    if (!targetUserId || isGroup || isTaskGroup) return;
    
    try {
      const socket = await waitForSocketConnection();
      let statusReceived = false;
      let timeoutId: NodeJS.Timeout | null = null;
      
      const statusListener = (data: any) => {
        if (data.userId === targetUserId && !statusReceived) {
          statusReceived = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setIsOnline(data.isOnline === true);
          socket.off('user_online_status', statusListener);
        }
      };
      
      socket.on('user_online_status', statusListener);
      
      socket.emit('check_user_online', { userId: targetUserId }, (isOnline: boolean) => {
        if (!statusReceived && isOnline !== undefined && isOnline !== null) {
          statusReceived = true;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          setIsOnline(isOnline === true);
          socket.off('user_online_status', statusListener);
        }
      });
      
      timeoutId = setTimeout(() => {
        if (!statusReceived) {
          setIsOnline(false);
          socket.off('user_online_status', statusListener);
        }
      }, 3000);
    } catch (error) {
      console.error('Check online status error:', error);
      setIsOnline(false);
    }
  };

  // Mark messages as read
  const markAsReadMutation = useMutation(
    () => messageService.markMessagesAsReadByConversationId(conversationId!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['conversations']);
        setUnreadCount(0);
      }
    }
  );

  // Send message mutation (for HTTP fallback, but we primarily use socket)
  const sendMessageMutation = useMutation(
    (data: { content: string; replyToMessageId?: string }) => messageService.sendMessage({
      conversationId: conversationId!,
      messageType: 'text',
      content: data.content,
      replyToMessageId: data.replyToMessageId,
    }),
    {
      onSuccess: () => {
        // Messages will be received via socket, no need to refetch
        queryClient.invalidateQueries(['conversations']);
      }
    }
  );

  // Setup socket and join conversation room
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !conversationId) return;

    let isMounted = true;
    let onlineCheckInterval: NodeJS.Timeout | null = null;

    const setupSocket = async () => {
      try {
        // CRITICAL FIX: Wait for socket connection instead of infinite retry
        const socket = await waitForSocketConnection();
        if (!isMounted) return;

        console.log('✅ Socket connected, setting up listeners for conversation:', conversationId);

        // CRITICAL FIX: Set up ALL listeners BEFORE joining conversation room
        // This ensures we don't miss any events that are emitted immediately after joining

        // ========== MESSAGE LISTENERS (set up first) ==========
        const handleNewMessage = (newMsg: any) => {
          if (newMsg.conversation_id !== conversationId) return;
          const currentUserId = user?.id;
          const isMyMessage = newMsg.sender_id === currentUserId || newMsg.senderId === currentUserId;
          console.log('[socket] message received', { messageId: newMsg.id, conversationId: newMsg.conversation_id, senderId: newMsg.sender_id });
          console.log('📨 New message received in DirectChatConversation:', {
            id: newMsg.id,
            conversationId: newMsg.conversation_id,
            senderId: newMsg.sender_id,
            currentUserId: currentUserId,
            isMyMessage: isMyMessage,
            status: newMsg.status,
            content: newMsg.content?.substring(0, 30),
          });
          
          // Normalize the message to ensure consistent field names
          const normalizedMessage = normalizeMessage(newMsg);
          if (!normalizedMessage) {
            console.warn('⚠️ Failed to normalize message, skipping');
            return;
          }

          // CRITICAL FIX: Update messages state IMMEDIATELY with improved deduplication (matching mobile exactly)
          setMessages((prev) => {
            try {
              const isMyMessageInState = normalizedMessage.sender_id === currentUserId || normalizedMessage.senderId === currentUserId;
            
            // Use Set for faster duplicate checking (O(1) lookup)
            const messageIds = new Set(prev.map(msg => msg.id));
            
            // Check if message already exists to avoid duplicates
            if (messageIds.has(normalizedMessage.id)) {
              console.log('✅ Message exists, updating with status preservation:', normalizedMessage.id);
              // Update existing message but preserve the latest status
              return prev.map((msg) => {
                if (msg.id === normalizedMessage.id) {
                  // CRITICAL FIX: Preserve the latest status (read > delivered > sent)
                  const statusPriority = { 'read': 3, 'delivered': 2, 'sent': 1 };
                  const currentPriority = statusPriority[msg.status as keyof typeof statusPriority] || 0;
                  const newPriority = statusPriority[normalizedMessage.status as keyof typeof statusPriority] || 0;
                  const finalStatus = newPriority > currentPriority ? normalizedMessage.status : msg.status;
                  
                  return {
                    ...normalizedMessage,
                    status: finalStatus, // Use the higher priority status
                  };
                }
                return msg;
              });
            }
            
            // CRITICAL FIX: For our own messages, ALWAYS remove ALL temp messages from this user
              // This prevents duplicates - we never want both temp and real messages for our own messages
            if (isMyMessageInState) {
              const allTempMessagesFromUser = prev.filter(msg => {
                if (!msg.id || !msg.id.startsWith('temp_')) return false;
                return (msg.sender_id === currentUserId || msg.senderId === currentUserId);
              });
              
              if (allTempMessagesFromUser.length > 0) {
              // Remove all temp messages from this user and the real message if it already exists
              const tempIds = allTempMessagesFromUser.map(m => m.id);
              const updated = prev
                .filter(msg => !tempIds.includes(msg.id))
                .filter(msg => msg.id !== normalizedMessage.id);
              
              // Always add the real message
              updated.push(normalizedMessage);
              
                console.log('✅ Replaced temp messages for own message:', {
                tempIds,
                realMessageId: normalizedMessage.id,
                content: normalizedMessage.content?.substring(0, 50),
                beforeCount: prev.length,
                afterCount: updated.length
              });
              
                // Sort after replacement to ensure correct order
                updated.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeA - timeB;
              });
                return updated;
              }
            }
            
            // For other users' messages, check if this is replacing a temp message (optimistic update)
            if (!isMyMessageInState) {
              const tempMessageIndex = prev.findIndex((msg) => {
                // Must be a temp message
                if (!msg.id || !msg.id.startsWith('temp_')) return false;
                
                // Check sender match
                const msgSenderId = msg.sender_id || msg.senderId;
                const newSenderId = normalizedMessage.sender_id || normalizedMessage.senderId;
                const sameSender = msgSenderId === newSenderId;
                
                // Check content match (normalize whitespace)
                const msgContent = (msg.content || '').trim();
                const newContent = (normalizedMessage.content || '').trim();
                const sameContent = msgContent === newContent;
                
                // Check time difference (allow up to 15 seconds for network delay)
                const msgTime = new Date(msg.created_at || 0).getTime();
                const newTime = new Date(normalizedMessage.created_at || 0).getTime();
                const timeDiff = Math.abs(msgTime - newTime);
                
                // Match if: temp message, same sender, same content, and within 15 seconds
                return sameSender && sameContent && timeDiff < 15000;
              });
              
              if (tempMessageIndex !== -1) {
                // Replace temp message with real one
                console.log('✅ Replacing temp message with real message:', {
                  tempId: prev[tempMessageIndex].id,
                  realId: normalizedMessage.id,
                  tempIndex: tempMessageIndex
                });
                const updated = [...prev];
                updated[tempMessageIndex] = normalizedMessage;
                // Sort after replacement to ensure correct order
                updated.sort((a, b) => {
                const timeA = new Date(a.created_at || 0).getTime();
                const timeB = new Date(b.created_at || 0).getTime();
                return timeA - timeB;
              });
              return updated;
              }
            }
            
            // CRITICAL FIX: For messages from current user, check for duplicate by content + sender + time
            // This handles the case where the same message is received twice via socket (shouldn't happen, but safety check)
            if (isMyMessageInState) {
              const duplicateIndex = prev.findIndex((msg) => {
                // Skip temp messages (already handled above)
                if (msg.id && msg.id.startsWith('temp_')) return false;
                
                const msgSenderId = msg.sender_id || msg.senderId;
                const msgIsMine = msgSenderId === currentUserId;
                const msgContent = (msg.content || '').trim();
                const newContent = (normalizedMessage.content || '').trim();
                const sameContent = msgContent === newContent;
                
                const timeDiff = Math.abs(
                  new Date(msg.created_at || 0).getTime() - 
                  new Date(normalizedMessage.created_at || 0).getTime()
                );
                
                // Match if: same sender, same content, and within 5 seconds (tighter window for duplicates)
                return msgIsMine && sameContent && timeDiff < 5000;
              });
              
              if (duplicateIndex !== -1) {
                // Replace the duplicate (update status if needed)
                console.log('✅ Replacing duplicate message with updated version:', {
                  oldId: prev[duplicateIndex].id,
                  newId: normalizedMessage.id,
                  oldStatus: prev[duplicateIndex].status,
                  newStatus: normalizedMessage.status
                });
                const updated = [...prev];
                // CRITICAL FIX: Preserve the latest status when replacing duplicates
                const statusPriority = { 'read': 3, 'delivered': 2, 'sent': 1 };
                const currentPriority = statusPriority[prev[duplicateIndex].status as keyof typeof statusPriority] || 0;
                const newPriority = statusPriority[normalizedMessage.status as keyof typeof statusPriority] || 0;
                const finalStatus = newPriority > currentPriority ? normalizedMessage.status : prev[duplicateIndex].status;
                
                updated[duplicateIndex] = {
                  ...normalizedMessage,
                  status: finalStatus,
                };
                // Sort after replacement to ensure correct order
                updated.sort((a, b) => {
                  const timeA = new Date(a.created_at || 0).getTime();
                  const timeB = new Date(b.created_at || 0).getTime();
                  return timeA - timeB;
                });
                return updated;
              }
            }
            
            // CRITICAL FIX: Add new message immediately and sort by timestamp
            console.log('✅ Adding new message to list immediately');
            const updated = [...prev, normalizedMessage];
            // Sort messages by created_at to ensure correct chronological order
            updated.sort((a, b) => {
              const timeA = new Date(a.created_at || 0).getTime();
              const timeB = new Date(b.created_at || 0).getTime();
              return timeA - timeB;
            });
            return updated;
            } catch (error) {
              console.error('Error updating messages state:', error);
              return prev; // Return previous state on error
            }
          });
          
          // CRITICAL FIX: Scroll to bottom immediately (don't wait)
          setTimeout(() => scrollToBottom(), 50);
          
          // Mark messages as read when new message arrives (user is viewing chat)
          if (normalizedMessage.sender_id !== currentUserId) {
            // CRITICAL FIX: Mark as read immediately for real-time status updates
            setTimeout(async () => {
              try {
                // Mark all unread messages in conversation as read
                await messageService.markMessagesAsReadByConversationId(conversationId);
                // Emit read receipt for this conversation
              socket.emit('message_read', {
                conversationId,
              });
                console.log('✅ Marked messages as read when new message arrived');
              } catch (err) {
                console.error('Mark as read error:', err);
              }
            }, 300);
          } else {
            // For own messages, status will be updated via message_status_update event
            if (normalizedMessage.status === 'sent') {
              console.log('📤 Own message with sent status, waiting for status update');
            }
          }
        };

        // ========== STATUS UPDATE LISTENERS (set up before join) ==========
        const handleMessageStatusUpdate = (update: any) => {
          console.log('📊 Message status update received:', {
            update,
            conversationId: update.conversationId,
            currentConversationId: conversationId,
            messageId: update.messageId,
            status: update.status,
          });
          const currentUserId = user?.id;
          
          // CRITICAL FIX: Only process updates for this conversation
          if (update.conversationId && update.conversationId !== conversationId) {
            console.log('⚠️ Status update ignored - different conversation:', {
              updateConversationId: update.conversationId,
              currentConversationId: conversationId,
            });
            return;
          }
          
          setMessages((prev) => {
            try {
              console.log('📊 Processing status update, current messages count:', prev.length);
              let hasChanges = false;
              let matchedMessageIds: string[] = [];
              
              const updated = prev.map((msg) => {
                // CRITICAL FIX: Update specific message by ID (highest priority)
              if (msg.id === update.messageId) {
                  if (msg.status !== update.status) {
                    console.log('✅ Updating message status by ID:', {
                      messageId: msg.id,
                      oldStatus: msg.status,
                      newStatus: update.status,
                      senderId: msg.sender_id || msg.senderId,
                      currentUserId,
                    });
                    hasChanges = true;
                    matchedMessageIds.push(msg.id);
                return { ...msg, status: update.status };
                  } else {
                    console.log('⚠️ Status update received but status already matches:', {
                      messageId: msg.id,
                      currentStatus: msg.status,
                      updateStatus: update.status,
                    });
                  }
                  return msg;
                }
                
                // CRITICAL FIX: Also update status for messages in the same conversation if it's a bulk update
                // Only update messages sent by current user (we don't update other users' messages)
              const msgSenderId = msg.sender_id || msg.senderId;
                const isMyMessage = msgSenderId === currentUserId;
                const msgConvId = msg.conversation_id || msg.conversationId;
                
                if (update.conversationId && 
                    msgConvId === update.conversationId && 
                    isMyMessage) {
                  
                  // For read status: Update messages sent by current user that are delivered or sent
                  if (update.status === 'read' && msg.status !== 'read') {
                    console.log('✅ Bulk updating message to read:', {
                      messageId: msg.id,
                      oldStatus: msg.status,
                    });
                    hasChanges = true;
                    matchedMessageIds.push(msg.id);
                return { ...msg, status: 'read' };
              }
                  
                  // For delivered status: Update messages sent by current user that are still 'sent'
                  if (update.status === 'delivered' && msg.status === 'sent') {
                    console.log('✅ Bulk updating message to delivered:', {
                      messageId: msg.id,
                      oldStatus: msg.status,
                    });
                    hasChanges = true;
                    matchedMessageIds.push(msg.id);
                return { ...msg, status: 'delivered' };
                  }
              }
              return msg;
              });
              
              if (hasChanges) {
                console.log('✅ Status update applied to messages:', matchedMessageIds);
              } else {
                console.log('⚠️ Status update received but no changes applied. Message IDs in state:', prev.map(m => m.id));
              }
              
              // Force re-render by creating new array reference if changes were made
              return hasChanges ? [...updated] : prev;
            } catch (error) {
              console.error('❌ Error updating message status:', error);
              return prev; // Return previous state on error
            }
          });
        };

        // Listen for conversation-level status updates (when all messages are read)
        const handleConversationMessagesRead = (data: any) => {
          console.log('📖 Conversation messages read event:', data);
          if (data.conversationId === conversationId) {
            setMessages((prev) => {
              let hasChanges = false;
              const updated = prev.map((msg) => {
                const currentUserId = user?.id;
              const msgSenderId = msg.sender_id || msg.senderId;
                // Mark messages from current user as read if they were delivered or sent
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
          }
        };

        const handleMessageEdited = (editedMsg: any) => {
          if (editedMsg.conversation_id !== conversationId) return;
          
          setMessages((prev) =>
            prev.map(msg => {
              if (msg.id === editedMsg.id) {
                const normalized = normalizeMessage(editedMsg);
                return normalized ? { ...msg, ...normalized } : msg;
              }
              return msg;
            })
          );
        };

        const handleMessageDeleted = (deletedMsg: any) => {
          if (deletedMsg.conversation_id !== conversationId) return;
          
          setMessages((prev) =>
            prev.map(msg => {
              if (msg.id === deletedMsg.id) {
                return {
                  ...msg,
                  deleted_at: deletedMsg.deleted_at || new Date().toISOString(),
                  deleted_for_all: deletedMsg.deleted_for_all || false,
                };
              }
              return msg;
            })
          );
        };

        // ========== TYPING INDICATOR LISTENER (set up before join) ==========
        const handleTyping = (data: any) => {
          console.log('⌨️ Typing event received:', data);
          const currentUserId = user?.id;
          // Only process typing events for this conversation and from other users
          if (data.conversationId === conversationId && data.userId !== currentUserId) {
            setIsTyping(data.isTyping);
            // CRITICAL FIX: Auto-clear typing indicator after 3 seconds if isTyping is true
            if (data.isTyping) {
              // Clear any existing timeout
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
              // Set new timeout to clear typing indicator
              typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
              }, 3000);
            } else {
              // Clear typing immediately if isTyping is false
              setIsTyping(false);
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
              }
            }
          }
        };

        // ========== ONLINE/OFFLINE STATUS LISTENERS (set up before join) ==========
        // CRITICAL FIX: Use persistent listeners (not 'once') to catch all events
        const handleUserOnline = (data: any) => {
          if (data.userId) {
            setOnlineUserIds((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
          }
        };

        const handleUserOffline = (data: any) => {
          if (data.userId) {
            setOnlineUserIds((prev) => prev.filter((id) => id !== data.userId));
          }
        };

        const handleUserOnlineStatus = (data: any) => {
          if (!data.userId) return;
          if (data.isOnline === true) {
            setOnlineUserIds((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
          } else {
            setOnlineUserIds((prev) => prev.filter((id) => id !== data.userId));
          }
        };

        const handleMessageReactionAdded = (data: any) => {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === data.messageId) {
                const reactions = msg.reactions || [];
                if (!reactions.find((r: any) => (r.user_id || r.userId) === data.userId && r.reaction === data.reaction)) {
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

        // ========== REGISTER ALL LISTENERS (before joining room) ==========
        socket.on('new_message', handleNewMessage);
        socket.on('message_status_update', handleMessageStatusUpdate);
        socket.on('conversation_messages_read', handleConversationMessagesRead);
        socket.on('message_edited', handleMessageEdited);
        socket.on('message_deleted', handleMessageDeleted);
        socket.on('typing', handleTyping);
        socket.on('user_online', handleUserOnline);
        socket.on('user_offline', handleUserOffline);
        socket.on('user_online_status', handleUserOnlineStatus);
        socket.on('message_reaction_added', handleMessageReactionAdded);
        socket.on('message_reaction_removed', handleMessageReactionRemoved);
        const handleDisconnect = () => {
          setMessages((prev) => prev.map((m) => {
            if (!m.id?.startsWith('temp_')) return m;
            if ((m.sender_id !== user?.id && m.senderId !== user?.id) || m.status !== 'pending') return m;
            return { ...m, status: 'failed' };
          }));
        };
        socket.on('disconnect', handleDisconnect);

        const handleOnlineUsers = (data: { userIds?: string[] }) => {
          setOnlineUserIds((prev) => {
            const ids = data.userIds ?? [];
            return Array.isArray(ids) ? ids : prev;
          });
        };
        socket.on('online_users', handleOnlineUsers);
        socket.emit('get_online_users');

        socket.emit('join_conversation', conversationId);
        console.log('[socket] joined conversation room:', conversationId);

        socketRef.current = socket;

        // ========== CHECK ONLINE STATUS (after listeners and join) ==========
        // CRITICAL FIX: Check online status immediately after joining room
        // Also set up periodic checks (only for 1-to-1 conversations)
        const isGroup = conversationData?.type === 'group' || conversationData?.is_group;
        const isTaskGroup = conversationData?.isTaskGroup || conversationData?.is_task_group;
        if (!isGroup && !isTaskGroup && otherUserId) {
          // Check immediately (with small delay to ensure room join is complete)
          setTimeout(() => {
            checkOnlineStatus(otherUserId);
          }, 500);
          
          // Also check periodically
          onlineCheckInterval = setInterval(() => {
            checkOnlineStatus(otherUserId);
          }, 10000); // Check every 10 seconds (matching mobile)
        } else if (!isGroup && !isTaskGroup) {
          // If otherUserId is not set yet, check again after a delay
          setTimeout(() => {
            if (otherUserId) {
              checkOnlineStatus(otherUserId);
            }
          }, 2000);
        }

        // Cleanup: Mark pending temp messages as failed after 15s (no server ack); remove old temp after 30s
        const tempMessageCleanupInterval = setInterval(() => {
          setMessages((prev) => {
            const currentUserId = user?.id;
            const now = Date.now();
            const fifteenSecondsAgo = now - 15000;
            const thirtySecondsAgo = now - 30000;
            let next = prev;
            const myPending = prev.filter(msg => {
              if (!msg.id?.startsWith('temp_')) return false;
              if (msg.sender_id !== currentUserId && msg.senderId !== currentUserId) return false;
              return msg.status === 'pending';
            });
            const toMarkFailed = myPending.filter(m => new Date(m.created_at || 0).getTime() < fifteenSecondsAgo);
            if (toMarkFailed.length > 0) {
              next = next.map(m => (toMarkFailed.some(t => t.id === m.id) ? { ...m, status: 'failed' } : m));
            }
            const oldTemp = next.filter(msg => {
              if (!msg.id?.startsWith('temp_')) return false;
              if (msg.sender_id !== currentUserId && msg.senderId !== currentUserId) return false;
              return new Date(msg.created_at || 0).getTime() < thirtySecondsAgo;
            });
            if (oldTemp.length > 0) {
              next = next.filter(msg => !oldTemp.some(t => t.id === msg.id));
            }
            return next;
          });
        }, 5000);
        
        const cleanup = () => {
          try {
            if (onlineCheckInterval) {
              clearInterval(onlineCheckInterval);
              onlineCheckInterval = null;
            }
            if (tempMessageCleanupInterval) {
              clearInterval(tempMessageCleanupInterval);
            }
            socket.emit('leave_conversation', conversationId);
            socket.off('new_message', handleNewMessage);
            socket.off('typing');
            socket.off('message_status_update');
            socket.off('conversation_messages_read');
            socket.off('message_edited');
            socket.off('message_deleted');
            socket.off('message_reaction_added');
            socket.off('message_reaction_removed');
            socket.off('user_online', handleUserOnline);
            socket.off('user_offline', handleUserOffline);
            socket.off('user_online_status', handleUserOnlineStatus);
            socket.off('disconnect', handleDisconnect);
            socket.off('online_users', handleOnlineUsers);
          } catch (error) {
            console.error('[socket] cleanup error:', error);
          }
        };
        if (isMounted) socketCleanupRef.current = cleanup;
        else cleanup();
        return cleanup;
      } catch (error) {
        console.error('[socket] setup error:', error);
      }
    };

    setupSocket();

    return () => {
      isMounted = false;
      socketCleanupRef.current?.();
      socketCleanupRef.current = null;
      if (conversationId) {
        leaveConversationRoom(conversationId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, user?.id, otherUserId, conversationData?.type, conversationData?.is_group, conversationData?.isTaskGroup, conversationData?.is_task_group]);

  // Mark messages as read when conversation is opened
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      markAsReadMutation.mutate();
    }
  }, [conversationId]);

  // CRITICAL FIX: Periodically mark messages as read while chat is open and user is viewing
  // This ensures read receipts update in real-time for the sender
  useEffect(() => {
    if (!conversationId || messages.length === 0) return;

    // Check for unread messages from other users
    const checkAndMarkAsRead = async () => {
      const currentUserId = user?.id;
      const unreadMessages = messages.filter((msg: any) => {
        const msgSenderId = msg.sender_id || msg.senderId;
        return msgSenderId !== currentUserId && msg.status !== 'read' && !msg.deleted_at;
      });

      if (unreadMessages.length > 0) {
        console.log('📖 Found unread messages while chat is open, marking as read:', unreadMessages.length);
        try {
          // Mark messages as read via API
          await messageService.markMessagesAsReadByConversationId(conversationId);
          
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
  }, [conversationId, messages, user?.id]);

  // Recalculate unread count
  useEffect(() => {
    const currentUserId = user?.id;
    const unread = messages.filter(
      (msg: any) => {
        const msgSenderId = msg.sender_id || msg.senderId;
        return msgSenderId !== currentUserId && msg.status !== 'read' && !msg.deleted_at;
      }
    ).length;
    setUnreadCount(unread);
  }, [messages, user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Format time helper – now uses IST (Asia/Kolkata)
  const formatTime = (timestamp?: string) => formatChatTime(timestamp);

  // Format date helper – Today / Yesterday / short date in IST
  const formatDate = (timestamp?: string) => formatChatDate(timestamp);

  // Show date separator when the formatted IST date label changes
  const shouldShowDateSeparator = (currentMessage: any, previousMessage: any) => {
    if (!previousMessage) return true;
    const currentLabel = formatDate(currentMessage.created_at);
    const previousLabel = formatDate(previousMessage.created_at);
    return !!currentLabel && !!previousLabel && currentLabel !== previousLabel;
  };

  // Handle typing (with debouncing)
  const handleTyping = async (text: string) => {
    setMessage(text);

    try {
      const socket = await waitForSocketConnection();
      const currentUserId = user?.id;
      
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

  // Helper: get device local timestamp as "YYYY-MM-DD HH:MM:SS"
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

  // Handle send message
  const handleSend = async () => {
    if ((!message.trim() && !replyingTo && !editingMessage && pendingAttachments.length === 0) || !conversationId) return;

    try {
      if (editingMessage) {
        const socket = await waitForSocketConnection();
        await messageService.editMessage(editingMessage.id, message.trim());
        socket.emit('send_message', {
          conversationId,
          content: message.trim(),
          messageType: 'text',
          isEdit: true,
          messageId: editingMessage.id,
          deviceTimestamp: getDeviceLocalTimestamp(),
        });
        setEditingMessage(null);
        setMessage('');
      } else if (pendingAttachments.length > 0) {
        // Send caption as text first if present
        const caption = message.trim();
        if (caption) {
          const socket = await waitForSocketConnection();
          const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          lastPendingTempIdRef.current = tempId;
          const currentUserId = user?.id;
          const tempMessage = normalizeMessage({
            id: tempId,
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: caption,
            message_type: 'text',
            status: 'pending',
            created_at: undefined,
            sender_name: user?.name || 'You',
            reply_to_message_id: replyingTo?.id || null,
            reply_to: replyingTo ? { id: replyingTo.id, sender_id: replyingTo.sender_id, content: replyingTo.content, message_type: replyingTo.message_type, sender_name: replyingTo.sender_name } : null,
          });
          if (tempMessage) setMessages((prev) => [...prev, tempMessage]);
          socket.emit('send_message', { conversationId, text: caption, content: caption, messageType: 'text', replyToMessageId: replyingTo?.id || null, deviceTimestamp: getDeviceLocalTimestamp() });
          lastPendingTempIdRef.current = null;
          setMessage('');
          setReplyingTo(null);
        }
        setUploadingMedia(true);
        const toSend = [...pendingAttachments];
        setPendingAttachments([]);
        let mediaSocket: any = null;
        try {
          mediaSocket = await waitForSocketConnection();
        } catch (e) {
          setUploadingMedia(false);
          toast.error('No connection. Please check your internet.');
          throw e;
        }
        for (const item of toSend) {
          try {
            let uploadResponse: any;
            const messageType = item.type;
            switch (item.type) {
              case 'image': uploadResponse = await messageService.uploadImage(item.file); break;
              case 'video': uploadResponse = await messageService.uploadVideo(item.file); break;
              case 'audio': uploadResponse = await messageService.uploadAudio(item.file); break;
              case 'document': uploadResponse = await messageService.uploadDocument(item.file); break;
            }
            const { storedValue } = extractUploadedMedia(uploadResponse);
            if (!storedValue) throw new Error('Upload did not return key');
            mediaSocket.emit('send_message', {
              conversationId,
              messageType,
              mediaUrl: storedValue,
              fileName: item.name,
              fileSize: item.size,
              mimeType: item.file.type,
              replyToMessageId: replyingTo?.id || null,
              deviceTimestamp: getDeviceLocalTimestamp(),
            });
          } catch (err) {
            console.error('Upload error:', err);
            toast.error(`Failed to upload ${item.name}. Please try again.`);
          }
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        setUploadingMedia(false);
        setTimeout(() => scrollToBottom(), 100);
      } else {
        // Text only: add optimistic message as pending, then connect and emit
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        lastPendingTempIdRef.current = tempId;
        const currentUserId = user?.id;
        const tempMessage = normalizeMessage({
          id: tempId,
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: message.trim(),
          message_type: 'text',
          status: 'pending',
          created_at: undefined,
          sender_name: user?.name || 'You',
          reply_to_message_id: replyingTo?.id || null,
          reply_to: replyingTo ? { id: replyingTo.id, sender_id: replyingTo.sender_id, content: replyingTo.content, message_type: replyingTo.message_type, sender_name: replyingTo.sender_name } : null,
        });
        if (tempMessage) {
          setMessages((prev) => [...prev, tempMessage]);
          setMessage('');
          setReplyingTo(null);
          setTimeout(() => scrollToBottom(), 100);
        }
        const socket = await waitForSocketConnection();
        socket.emit('send_message', { conversationId, text: message.trim(), content: message.trim(), messageType: 'text', replyToMessageId: replyingTo?.id || null, deviceTimestamp: getDeviceLocalTimestamp() });
        lastPendingTempIdRef.current = null;
      }

      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message. Please try again.');
      // Mark the last optimistic message as failed (e.g. when offline / connection failed)
      const failedTempId = lastPendingTempIdRef.current;
      lastPendingTempIdRef.current = null;
      if (failedTempId) {
        setMessages((prev) => prev.map((m) => (m.id === failedTempId ? { ...m, status: 'failed' } : m)));
      }
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
    
    const currentUserId = user?.id;
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
    const currentUserId = user?.id;
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
      // Show toast notification (you can add a toast library)
    }
  };

  // Handle forward
  const handleForward = async () => {
    if (!selectedMessage) return;
    
    try {
      // For now, just show a message - in future, can open a conversation picker
      const targetConversationId = prompt('Enter conversation ID to forward to:');
      if (targetConversationId) {
        await messageService.forwardMessage(selectedMessage.id, targetConversationId);
    setSelectedMessage(null);
      }
    } catch (error) {
      console.error('Forward error:', error);
    }
  };

  // Add file to upload preview (show in strip, send when user clicks Send)
  const addFileToPending = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    const id = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    let previewUrl: string | undefined;
    if (type === 'image' || type === 'video') {
      previewUrl = URL.createObjectURL(file);
    }
    setPendingAttachments((prev) => [
      ...prev,
      {
        id,
        file,
        name: file.name,
        size: file.size,
        type,
        previewUrl,
        uploadProgress: null,
      },
    ]);
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

  // Handle media upload (immediate upload and send - used when no preview flow)
  const handleMediaSelect = async (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
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
      });

      setReplyingTo(null);
    } catch (error) {
      console.error('Media upload error:', error);
      toast.error('Failed to upload media. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // When user selects file from MediaUpload: add to preview strip (then Send will upload)
  const handleMediaSelectAddToPreview = (file: File, type: 'image' | 'video' | 'audio' | 'document') => {
    addFileToPending(file, type);
    setShowMediaUpload(false);
    setShowAttachmentMenu(false);
  };

  // Open file picker from "+" menu (Upload File / Image / Video)
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

  // Handle voice note
  const handleVoiceNoteComplete = async (audioBlob: Blob) => {
    setUploadingMedia(true);
    try {
      // Convert blob to file
      const audioFile = new File([audioBlob], 'voice-note.webm', { type: 'audio/webm' });
      const uploadResponse = await messageService.uploadVoiceNote(audioFile);

      const { storedValue } = extractUploadedMedia(uploadResponse);
      if (!storedValue) {
        throw new Error('No media key or URL returned from upload');
      }

      // Send message via socket
      const socket = await waitForSocketConnection();
      socket.emit('send_message', {
        conversationId,
        messageType: 'voice_note',
        mediaUrl: storedValue,
        fileName: 'voice-note.webm',
        fileSize: audioBlob.size,
        mimeType: 'audio/webm',
        duration: 0, // Duration will be calculated on backend
        replyToMessageId: replyingTo?.id || null,
      });

      setReplyingTo(null);
    } catch (error) {
      console.error('Voice note upload error:', error);
      toast.error('Failed to upload voice note. Please try again.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // Handle location share
  const handleLocationSelect = async (location: { lat: number; lng: number; address?: string }) => {
    try {
      const socket = await waitForSocketConnection();
      socket.emit('send_message', {
        conversationId,
        messageType: 'location',
        locationLat: location.lat,
        locationLng: location.lng,
        locationAddress: location.address,
        replyToMessageId: replyingTo?.id || null,
      });

      setReplyingTo(null);
    } catch (error) {
      console.error('Location share error:', error);
      toast.error('Failed to share location. Please try again.');
    }
  };

  // Handle message search
  const handleSearch = async () => {
    if (!searchQuery.trim() || !conversationId) return;

    try {
      const response = await messageService.searchMessagesInConversation(conversationId, searchQuery);
      const results = response.messages || response.data || [];
      setSearchResults(results.map((msg: any) => normalizeMessage(msg)).filter((msg: any) => msg !== null));
    } catch (error) {
      console.error('Search error:', error);
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

  // Get conversation name and photo
  // Extract other user from members array (excluding current user)
  const currentUserId = user?.id || user?.userId;
  const otherMembers = conversationData?.otherMembers || conversationData?.other_members || [];
  
  // Detect self-chat scenarios:
  // - URL format direct_<userId> where userId matches current user
  // - Direct conversation whose only member in otherMembers is the current user
  const isSelfConversation = !!currentUserId && (
    (conversationId?.startsWith('direct_') && conversationId.replace('direct_', '') === currentUserId) ||
    (
      !(conversationData?.is_group || conversationData?.is_task_group) &&
      otherMembers.length > 0 &&
      otherMembers.every((m: any) => {
        const memberId = m.id || m.user_id || m.userId;
        return memberId === currentUserId;
      })
    )
  );
  
  // Find the other user (not the current user) - check all possible ID fields
  const otherUser = otherMembers.find((m: any) => {
    const memberId = m.id || m.user_id || m.userId;
    return memberId && memberId !== currentUserId;
  });
  
  // Get the other user's name - never use current user's name for real 1:1 chats
  const otherUserName = otherUser?.name || otherUser?.user_name || '';
  const currentUserName = user?.name || '';
  
  // Determine conversation name
  // For direct chats: use other user's name, but handle explicit self-chat gracefully
  // For groups/task groups: use conversation name
  let conversationName = '';
  if (conversationData?.is_group || conversationData?.is_task_group) {
    conversationName = conversationData?.name || 'Group Chat';
  } else {
    // For direct chats, prioritize other user's name
    const conversationDataName = conversationData?.name || '';

    if (isSelfConversation) {
      // Explicit self-chat: show a friendly self label instead of "Unknown User"
      conversationName = currentUserName || 'You';
    } else if (conversationDataName && conversationDataName !== currentUserName && otherUserName) {
      // Use conversation name if it's not the current user's name and we have other user's name
      conversationName = conversationDataName;
    } else if (otherUserName && otherUserName !== currentUserName) {
      // Use other user's name if it's not the current user's name
      conversationName = otherUserName;
    } else if (conversationDataName && conversationDataName !== currentUserName) {
      // Fallback to conversation name if it's not current user's name
      conversationName = conversationDataName;
    } else if (isSelfConversation) {
      // Safety fallback for self-chat when we couldn't resolve a display name
      conversationName = 'You';
    } else {
      conversationName = 'Unknown User';
    }
  }
  const conversationPhoto = conversationData?.photoUrl || 
    conversationData?.group_photo || 
    (otherUser?.profile_photo || otherUser?.profile_photo_url) ||
    '';

  // Render message component
  const renderMessage = (msg: any, index: number) => {
    // Add null checks to prevent crashes
    if (!msg || !msg.id) {
      console.warn('Invalid message in render:', msg);
      return null;
    }
    
    const messageSenderId = msg.sender_id || msg.senderId;
    const currentUserId = user?.id;
    const isMyMessage = messageSenderId === currentUserId;
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = shouldShowDateSeparator(msg, previousMessage);
    // CRITICAL FIX: Get status from message, ensuring we use the latest status
    const messageStatus = msg.status || 'sent';
    const messageType = msg.message_type || 'text';

    // Timestamp debug: compare raw DB value, parsed Date, and displayed IST time
    if (msg.created_at && index < 10) {
      const parsed = parseTimestamp(msg.created_at);
      const display = formatTime(msg.created_at);
      console.log('[ChatTimeDebug][web]', {
        messageId: msg.id,
        rawCreatedAt: msg.created_at,
        parsedIso: parsed?.toISOString?.(),
        displayTime: display,
      });
    }

    // Status icon and color - debug log for status changes
    let statusIcon = null;
    let statusColor = '#6B7280';
    if (isMyMessage) {
      // Debug: Log status for troubleshooting (only for first few messages to avoid spam)
      if (index < 3) {
        console.log(`[renderMessage] Message ${msg.id} status: ${messageStatus}`, {
          messageId: msg.id,
          status: messageStatus,
          isMyMessage,
        });
      }
      
      if (messageStatus === 'failed') {
        statusIcon = 'error';
        statusColor = '#DC2626'; // Red for failed
      } else if (messageStatus === 'pending') {
        statusIcon = 'schedule';
        statusColor = '#9CA3AF'; // Gray for pending/sending
      } else if (messageStatus === 'read') {
        statusIcon = '✓✓';
        statusColor = '#7C3AED'; // Purple for read
      } else if (messageStatus === 'delivered') {
        statusIcon = '✓✓';
        statusColor = '#6B7280'; // Gray for delivered
      } else {
        statusIcon = '✓';
        statusColor = '#6B7280'; // Gray for sent
      }
    }

    // Deleted message
    if (msg.deleted_at && msg.deleted_for_all) {
      return (
        <div key={msg.id} className="w-full">
          {showDateSeparator && (
            <div className="flex justify-center">
              <span className="text-xs font-medium text-gray-400 bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full">
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

    return (
      <div key={msg.id} className="w-full">
        {showDateSeparator && (
          <div className="flex justify-center py-2">
            <span className="bg-gray-200/70 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium px-3 py-1 rounded-full">
              {formatDate(msg.created_at)}
            </span>
          </div>
        )}
        
        <div className={`flex gap-4 max-w-2xl ${isMyMessage ? 'ml-auto flex-row-reverse' : ''}`}>
          {!isMyMessage && (
            <img 
              alt="Avatar" 
              className="w-10 h-10 rounded-full object-cover self-end"
              src={conversationPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(conversationName)}&background=A800EB&color=fff`}
            />
          )}
          
          <div 
            className={`flex flex-col gap-1 ${isMyMessage ? 'items-end' : 'items-start'}`}
            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
          >
            {/* Sender name for group chats */}
            {!isMyMessage && ((conversationData?.type === 'group' || conversationData?.is_group) || (conversationData?.isTaskGroup || conversationData?.is_task_group)) && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                {msg.sender_name || 'Unknown'}
              </span>
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
                latitude={msg.location_lat || msg.latitude}
                longitude={msg.location_lng || msg.longitude}
                locationName={msg.location_address || msg.location_name}
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
              <div className={`${isMyMessage ? 'bg-[#EDE9FE] text-[#1F2937] p-4 rounded-2xl rounded-br-none shadow-md border border-[#A78BFA]' : 'bg-[#F9FAFB] dark:bg-gray-800 p-4 rounded-2xl rounded-bl-none shadow-sm border border-[#E5E7EB] dark:border-gray-700'}`}>
                {msg.reply_to && (
                  <div className="border-l-4 border-[#7C3AED] pl-2 mb-2">
                    <p className="text-xs font-semibold text-[#7C3AED]">
                      {msg.reply_to.sender_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-gray-400 truncate">
                      {msg.reply_to.content || `Sent a ${msg.reply_to.message_type}`}
                    </p>
                  </div>
                )}
                {msg.edited_at && (
                  <span className="text-[10px] text-[#6B7280] opacity-70 mr-2 italic">Edited</span>
                )}
                <p className={`text-sm ${isMyMessage ? 'text-[#1F2937]' : 'text-[#1F2937] dark:text-gray-200'}`}>{msg.content}</p>
                <div className={`flex items-center gap-1.5 mt-2 ${isMyMessage ? 'justify-end' : ''}`}>
                  <span className={`text-[11px] ${isMyMessage ? 'text-[#6B7280]' : 'text-[#6B7280] dark:text-gray-400'}`}>
                    {msg.created_at ? formatTime(msg.created_at) : (msg.status === 'pending' || msg.status === 'failed' ? '...' : '')}
                  </span>
                  {isMyMessage && statusIcon && (
                    <span 
                      className="material-icons-round text-[16px] font-semibold leading-none" 
                      style={{ color: statusColor }}
                      title={messageStatus === 'pending' ? 'Sending...' : messageStatus === 'failed' ? 'Failed to send' : undefined}
                    >
                      {statusIcon === '✓✓' ? 'done_all' : statusIcon === '✓' ? 'done' : statusIcon}
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

  const [conversationFilter, setConversationFilter] = useState<'All' | 'Direct' | 'Task Groups'>('All');
  const [conversationSearchQuery, setConversationSearchQuery] = useState('');

  // Right sidebar content for task groups (normal style, no special icons/labels)
  const rightSidebarContent = (conversationData?.isTaskGroup || conversationData?.is_task_group) ? (
    <>
      <div className="p-6 flex flex-col items-center border-b border-border-light dark:border-border-dark">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-xl mb-4 overflow-hidden">
          {conversationPhoto ? (
            <img src={conversationPhoto} alt={conversationName} className="w-full h-full rounded-2xl object-cover" />
          ) : (
            <span className="material-icons-outlined text-4xl">groups</span>
          )}
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center">{conversationName}</h3>
        <div className="flex gap-4 mt-6 w-full justify-center">
          <div className="flex flex-col items-center">
            <button className="w-10 h-10 rounded-full bg-secondary dark:bg-primary/20 flex items-center justify-center text-primary mb-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              <span className="material-icons-outlined">notifications_off</span>
          </button>
            <span className="text-xs text-gray-500">Mute</span>
          </div>
          <div className="flex flex-col items-center">
            <button className="w-10 h-10 rounded-full bg-secondary dark:bg-primary/20 flex items-center justify-center text-primary mb-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              <span className="material-icons-outlined">search</span>
            </button>
            <span className="text-xs text-gray-500">Search</span>
          </div>
          <div className="flex flex-col items-center">
            <button className="w-10 h-10 rounded-full bg-secondary dark:bg-primary/20 flex items-center justify-center text-primary mb-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition">
              <span className="material-icons-outlined">more_horiz</span>
            </button>
            <span className="text-xs text-gray-500">More</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Members ({conversationData?.members?.length || conversationData?.otherMembers?.length || 0})</h4>
        <div className="space-y-4">
          {(conversationData?.members || conversationData?.otherMembers || []).map((member: any, idx: number) => (
            <div key={member.id || idx} className="flex items-center gap-3">
              <img
                className="w-8 h-8 rounded-full object-cover"
                src={member.profile_photo_url || member.profilePhotoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'User')}&background=A800EB&color=fff`}
                alt={member.name || 'Member'}
              />
              <div>
                <p className="text-sm font-medium dark:text-gray-200">{member.name || 'Unknown'}</p>
                <p className="text-xs text-primary">{member.role === 'admin' ? 'Admin' : 'Member'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-border-light dark:border-border-dark">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Shared Media</h4>
        <div className="grid grid-cols-3 gap-2">
          {/* Placeholder for shared media */}
          <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 hover:text-primary cursor-pointer transition">
            <span className="text-xs font-medium">View All</span>
          </div>
        </div>
      </div>
    </>
  ) : undefined;

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
      onlineUserIds={onlineUserIds}
    />
  );

  const mainContent = (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] dark:bg-surface-dark relative overflow-hidden h-full">
        {/* Header */}
        <header className="h-20 border-b border-border-light dark:border-border-dark flex items-center justify-between px-6 bg-white/50 dark:bg-surface-dark/50 backdrop-blur-sm z-10">
          <button
            type="button"
            className="flex items-center gap-4 focus:outline-none"
            onClick={() => {
              if (!conversationData?.isTaskGroup && !conversationData?.is_task_group && otherUserId) {
                setShowUserProfile(true);
              }
            }}
          >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-md overflow-hidden">
              {conversationPhoto ? (
                <img src={conversationPhoto} alt={conversationName} className="w-full h-full rounded-xl object-cover" />
              ) : (
                <span className="material-icons-outlined opacity-50 text-xl">
                  {(conversationData?.isTaskGroup || conversationData?.is_task_group) || (conversationData?.is_group) ? 'groups' : 'person'}
                </span>
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
              ) : unreadCount > 0 ? (
                `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`
              ) : (() => {
                const isDirect = !(conversationData?.type === 'group' || conversationData?.is_group) && !(conversationData?.isTaskGroup || conversationData?.is_task_group);
                const isOnlineFromList = Boolean(otherUserId && (onlineUserIds ?? []).includes(otherUserId));
                if (!isDirect) return null;
                return isOnlineFromList ? (
                  <span className="flex items-center gap-1">
                    <span className="size-2 bg-green-500 rounded-full"></span>
                    <span>online</span>
                  </span>
                ) : (
                  <span>offline</span>
                );
              })()}
              </p>
          </div>
          </button>
          <div className="flex items-center gap-4 text-gray-400">
            <button 
              onClick={() => setShowMessageSearch(!showMessageSearch)}
              className="hover:text-primary transition"
              title="Search messages"
            >
              <span className="material-icons-outlined">search</span>
            </button>
            <button 
              onClick={handlePinClick}
              disabled={pinMutation.isLoading}
              className={`hover:text-primary transition ${isPinned ? 'text-primary' : ''}`}
              title={isPinned ? 'Unpin' : 'Pin'}
            >
              <span className="material-icons-outlined">push_pin</span>
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className="hover:text-primary transition"
                title="More options"
              >
                <span className="material-icons-outlined">more_vert</span>
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg z-20">
                    {!(conversationData?.is_group || conversationData?.is_task_group) && otherUserId && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowUserProfile(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                      >
                        <span className="material-icons-outlined text-lg">person</span>
                        View profile
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
        </div>
      </header>

      {/* Message Search */}
      {showMessageSearch && (
        <div className="px-4 py-2 bg-[#F9FAFB] dark:bg-gray-800 border-b border-[#E5E7EB] dark:border-gray-700">
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
              <div
                key={item.id}
                className="flex-shrink-0 w-32 h-32 relative group rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-gray-100 dark:bg-gray-800"
              >
                {item.type === 'image' && item.previewUrl ? (
                  <>
                    <img alt={item.name} className="w-full h-full object-cover" src={item.previewUrl} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(item.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                    >
                      <span className="material-icons-round !text-[14px]">close</span>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-[10px] text-white truncate font-medium">{item.name}</p>
                    </div>
                  </>
                ) : item.type === 'document' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(item.id)}
                      className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-gray-200/50 dark:bg-gray-700/50 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                    >
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
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(item.id)}
                      className="absolute top-1.5 right-1.5 z-10 w-6 h-6 bg-gray-200/50 dark:bg-gray-700/50 hover:bg-red-500 hover:text-white text-gray-600 dark:text-gray-300 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                    >
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

        {/* Plus menu (attachments): Upload File, Upload Image, Upload Video */}
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
          </div>
        )}
        <input
          ref={attachmentMenuInputRef}
          type="file"
          className="hidden"
          onChange={handleAttachmentMenuFileChange}
        />

        <div className="flex items-center gap-2 sm:gap-3 max-w-5xl mx-auto bg-gray-100 dark:bg-background-dark/70 p-2 sm:p-3 rounded-2xl border border-border-light dark:border-border-dark relative">
          {/* Plus button */}
          <button
            type="button"
            className="p-2 sm:p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-all disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            onClick={() => setShowAttachmentMenu((prev) => !prev)}
            disabled={uploadingMedia}
            title="More options"
            aria-label="More options"
          >
            {uploadingMedia ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            ) : (
              <span className="material-icons-round text-lg sm:text-xl">add_circle</span>
            )}
          </button>

          {/* Quick image shortcut (opens media picker) */}
          <button
            type="button"
            className="p-2 sm:p-2.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
            onClick={() => setShowMediaUpload(true)}
            disabled={uploadingMedia}
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
      </div>

      {/* Message Action Sheet */}
      <MessageActionSheet
        visible={!!selectedMessage}
        isMyMessage={(selectedMessage?.sender_id || selectedMessage?.senderId) === user?.id}
        isGroup={(conversationData?.type === 'group' || conversationData?.is_group) || false}
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

      {/* User Profile Modal */}
      <UserProfileModal
        userId={otherUserId}
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
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

  if (isAdmin) {
    return (
      <AdminLayout hideSearch>
        <div className="flex h-full">
          <div className="w-80 md:w-96 bg-background-light dark:bg-background-dark flex flex-col border-r border-border-light dark:border-border-dark relative">
            {conversationListContent}
          </div>
          <div className="flex-1 flex flex-col bg-surface-light dark:bg-surface-dark relative overflow-hidden">
            {mainContent}
            {rightSidebarContent && (
              <aside className="w-72 bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark hidden xl:flex flex-col overflow-y-auto">
                {rightSidebarContent}
              </aside>
            )}
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
      showRightSidebar={!!rightSidebarContent}
      rightSidebarContent={rightSidebarContent}
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
