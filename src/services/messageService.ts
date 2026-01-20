import api from './api';
import { Message, MessageType, MessageVisibilityMode } from '../../../shared/src/types';

export interface SendMessageRequest {
  receiverId?: string;
  groupId?: string;
  conversationId?: string; // New: support conversationId
  messageType: MessageType;
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  visibilityMode?: MessageVisibilityMode;
  replyToMessageId?: string;
  forwardedFromMessageId?: string;
  mentions?: string[];
  taskMentions?: string[];
}

export const messageService = {
  sendMessage: async (data: SendMessageRequest) => {
    const response = await api.post('/messages/send', data);
    return response.data;
  },

  getMessages: async (receiverId?: string, groupId?: string, limit = 50, before?: string) => {
    const params = new URLSearchParams();
    if (receiverId) params.append('receiverId', receiverId);
    if (groupId) params.append('groupId', groupId);
    params.append('limit', limit.toString());
    if (before) params.append('before', before);

    const response = await api.get(`/messages?${params.toString()}`);
    return response.data;
  },

  markAsRead: async (receiverId?: string, groupId?: string) => {
    const response = await api.post('/messages/mark-read', { receiverId, groupId });
    return response.data;
  },

  editMessage: async (messageId: string, content: string) => {
    const response = await api.put(`/messages/${messageId}`, { content });
    return response.data;
  },

  deleteMessage: async (messageId: string, deleteForAll = false) => {
    const response = await api.delete(`/messages/${messageId}`, {
      data: { deleteForAll },
    });
    return response.data;
  },

  pinMessage: async (messageId: string, groupId: string, isPinned: boolean) => {
    const response = await api.post(`/messages/${messageId}/pin`, { groupId, isPinned });
    return response.data;
  },

  starMessage: async (messageId: string) => {
    const response = await api.post(`/messages/${messageId}/star`);
    return response.data;
  },

  unstarMessage: async (messageId: string) => {
    const response = await api.delete(`/messages/${messageId}/star`);
    return response.data;
  },

  searchMessages: async (query: string, receiverId?: string, groupId?: string, limit = 50) => {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    if (receiverId) params.append('receiverId', receiverId);
    if (groupId) params.append('groupId', groupId);

    const response = await api.get(`/messages/search?${params.toString()}`);
    return response.data;
  },

  /**
   * Get messages by conversationId (supports both UUID and "direct_<userId>" format)
   * Matches mobile implementation with proper fallback handling
   */
  getMessagesByConversationId: async (conversationId: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    const response = await api.get(`/messages/${conversationId}?${params.toString()}`);
    
    // Backend returns: { messages: [...] } (no success field)
    if (response.data && response.data.messages) {
      return response.data.messages;
    }
    // Fallback for old format
    if (response.data && response.data.success && response.data.messages) {
      return response.data.messages;
    }
    // Another fallback
    if (response.data && response.data.data) {
      return response.data.data;
    }
    return [];
  },

  /**
   * Mark messages as read by conversationId
   */
  markMessagesAsReadByConversationId: async (conversationId: string) => {
    const response = await api.put(`/messages/${conversationId}/read`);
    return response.data;
  },

  /**
   * Add reaction to a message
   */
  addReaction: async (messageId: string, reaction: string) => {
    const response = await api.post(`/messages/${messageId}/reactions`, { reaction });
    return response.data;
  },

  /**
   * Remove reaction from a message
   */
  removeReaction: async (messageId: string, reaction: string) => {
    const response = await api.delete(`/messages/${messageId}/reactions/${reaction}`);
    return response.data;
  },

  /**
   * Forward a message to another conversation
   */
  forwardMessage: async (messageId: string, conversationId?: string, receiverId?: string, groupId?: string) => {
    const response = await api.post(`/messages/${messageId}/forward`, {
      conversationId,
      receiverId,
      groupId,
    });
    return response.data;
  },

  /**
   * Search messages in a conversation (matches mobile - uses 'q' parameter)
   */
  searchMessagesInConversation: async (conversationId: string, query: string, limit = 50) => {
    const params = new URLSearchParams({
      q: query, // Backend expects 'q' not 'query' (matching mobile)
      limit: limit.toString(),
    });
    const response = await api.get(`/messages/search/${conversationId}?${params.toString()}`);
    // Backend returns: { success: true, messages: [...] } or { success: true, data: [...] }
    return response.data.success ? (response.data.messages || response.data.data || []) : [];
  },

  /**
   * Get all starred messages
   */
  getStarredMessages: async () => {
    const response = await api.get('/messages/starred/all');
    return response.data;
  },

  /**
   * Upload image file
   */
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/messages/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Upload video file
   */
  uploadVideo: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/messages/upload/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Upload audio file
   */
  uploadAudio: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/messages/upload/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Upload document file
   */
  uploadDocument: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/messages/upload/document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Upload voice note
   */
  uploadVoiceNote: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/messages/upload/voice-note', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

