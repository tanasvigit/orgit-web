import api from './api';

export interface Conversation {
  conversationId: string; // UUID or "direct_<userId>"
  id?: string; // Alias for conversationId
  type?: 'direct' | 'group';
  is_group?: boolean;
  name: string;
  photoUrl?: string;
  group_photo?: string;
  isPinned?: boolean;
  is_pinned?: boolean;
  unreadCount?: number;
  unread_count?: number;
  lastMessage?: {
    id: string;
    content: string;
    messageType?: string;
    message_type?: string;
    senderId?: string;
    sender_id?: string;
    senderName?: string;
    sender_name?: string;
    createdAt?: string;
    created_at?: string;
  };
  last_message?: any;
  lastMessageTime?: string;
  last_message_time?: string;
  otherMembers?: Array<{ id: string; name: string; profile_photo_url?: string; profile_photo?: string; phone?: string }>;
  other_members?: Array<{ id: string; name: string; profile_photo_url?: string; profile_photo?: string; phone?: string }>;
  isTaskGroup?: boolean;
  is_task_group?: boolean;
  taskId?: string | null;
  task_id?: string | null;
  role?: string;
  createdAt?: string;
  created_at?: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export type ConversationScope = 'all' | 'chat' | 'task';

export interface CreateConversationRequest {
  otherUserId: string;
}

export interface CreateConversationResponse {
  conversationId: string;
}

export interface ConversationDetailsResponse {
  conversation: Conversation;
}

export interface PinConversationRequest {
  is_pinned: boolean;
}

export interface CreateGroupRequest {
  name: string;
  memberIds: string[];
  group_photo?: string;
}

export interface CreateGroupResponse {
  conversationId: string;
}

export interface AddGroupMembersRequest {
  memberIds: string[];
}

export interface UpdateGroupRequest {
  name?: string;
  group_photo?: string;
}

export interface User {
  id: string;
  name: string;
  mobile?: string;
  phone?: string;
  profile_photo_url?: string;
  profile_photo?: string;
  organization_id?: string;
  organizationId?: string;
}

export interface UsersListResponse {
  users: User[];
}

export const conversationService = {
  /**
   * Get all conversations for the current user
   */
  getConversations: async (scope: ConversationScope = 'all'): Promise<Conversation[]> => {
    const response = await api.get<ConversationResponse>('/conversations', {
      params: { scope },
    });
    // Normalize the response to match our Conversation interface
    const conversations = (response.data.conversations || response.data as any).map((conv: any) => {
      const otherMembers = conv.other_members || conv.otherMembers || [];
      // For direct chats, if name is empty, get it from otherMembers
      let conversationName = conv.name || '';
      if (!conversationName && !conv.is_group && !conv.is_task_group && otherMembers.length > 0) {
        conversationName = otherMembers[0]?.name || otherMembers[0]?.userName || otherMembers[0]?.mobile || '';
      }
      
      return {
        conversationId: conv.id || conv.conversationId,
        id: conv.id || conv.conversationId,
        type: (conv.is_group ? 'group' : 'direct') as 'direct' | 'group',
        is_group: conv.is_group,
        name: conversationName,
        photoUrl: conv.group_photo || conv.photoUrl || (otherMembers.length > 0 ? (otherMembers[0]?.profile_photo_url || otherMembers[0]?.profile_photo || otherMembers[0]?.profilePhotoUrl) : ''),
        group_photo: conv.group_photo || conv.photoUrl,
        isPinned: conv.is_pinned ?? conv.isPinned ?? false,
        is_pinned: conv.is_pinned ?? conv.isPinned ?? false,
        unreadCount: conv.unread_count ?? conv.unreadCount ?? 0,
        unread_count: conv.unread_count ?? conv.unreadCount ?? 0,
        lastMessage: conv.last_message ? {
          id: conv.last_message.id || '',
          content: conv.last_message.content || '',
          messageType: conv.last_message.message_type || conv.last_message.messageType || 'text',
          message_type: conv.last_message.message_type || conv.last_message.messageType || 'text',
          senderId: conv.last_message.sender_id || conv.last_message.senderId || '',
          sender_id: conv.last_message.sender_id || conv.last_message.senderId || '',
          senderName: conv.last_message.sender_name || conv.last_message.senderName || '',
          sender_name: conv.last_message.sender_name || conv.last_message.senderName || '',
          createdAt: conv.last_message.created_at || conv.last_message.createdAt || '',
          created_at: conv.last_message.created_at || conv.last_message.createdAt || '',
        } : undefined,
        last_message: conv.last_message,
        lastMessageTime: conv.last_message_time || conv.lastMessageTime || conv.created_at || conv.createdAt,
        last_message_time: conv.last_message_time || conv.lastMessageTime || conv.created_at || conv.createdAt,
        otherMembers: otherMembers,
        other_members: otherMembers,
        isTaskGroup: conv.is_task_group ?? conv.isTaskGroup ?? false,
        is_task_group: conv.is_task_group ?? conv.isTaskGroup ?? false,
        taskId: conv.task_id ?? conv.taskId ?? null,
        task_id: conv.task_id ?? conv.taskId ?? null,
        role: conv.role,
        createdAt: conv.created_at || conv.createdAt,
        created_at: conv.created_at || conv.createdAt,
      };
    });
    
    return conversations;
  },

  /**
   * Create a direct conversation with another user
   */
  createConversation: async (otherUserId: string): Promise<string> => {
    const response = await api.post<CreateConversationResponse>('/conversations/create', {
      otherUserId,
    });
    return response.data.conversationId;
  },

  /**
   * Get conversation details by conversationId
   */
  getConversationDetails: async (conversationId: string): Promise<Conversation> => {
    try {
      const response = await api.get<ConversationDetailsResponse>(`/conversations/${conversationId}`);
      const data = response.data as any;
      const conv = data.conversation || data;
      const members = data.members || conv.members || [];
      // is_pinned is on the current user's membership, returned at top level by API (not on conversation)
      const isPinned = data.is_pinned ?? data.isPinned ?? conv.is_pinned ?? conv.isPinned ?? false;
    
    // Extract other members (excluding current user) for direct conversations
    let otherMembers: any[] = [];
    if (!conv.is_group && !conv.is_task_group && members.length > 0) {
      // Use all members - the component will filter out the current user
      otherMembers = members.map((m: any) => ({
        id: m.id || m.user_id || m.userId,
        name: m.name || m.userName || m.mobile || m.phone || '',
        mobile: m.mobile || m.phone || '',
        phone: m.mobile || m.phone || '',
        profile_photo_url: m.profile_photo_url || m.profile_photo || m.profilePhotoUrl,
        profile_photo: m.profile_photo_url || m.profile_photo || m.profilePhotoUrl,
        profilePhotoUrl: m.profile_photo_url || m.profile_photo || m.profilePhotoUrl,
        userName: m.userName || m.name,
      }));
    } else {
      // For groups, use existing otherMembers or members
      otherMembers = conv.other_members || conv.otherMembers || members || [];
    }
    
    // For direct chats, if name is empty, get it from otherMembers
    let conversationName = conv.name || '';
    if (!conversationName && !conv.is_group && !conv.is_task_group && otherMembers.length > 0) {
      conversationName = otherMembers[0]?.name || otherMembers[0]?.userName || otherMembers[0]?.mobile || '';
    }
    
    return {
      conversationId: conv.id || conv.conversationId || conversationId,
      id: conv.id || conv.conversationId || conversationId,
      type: conv.is_group ? 'group' : 'direct',
      is_group: conv.is_group,
      name: conversationName,
      photoUrl: conv.group_photo || conv.photoUrl || (otherMembers.length > 0 ? (otherMembers[0]?.profile_photo_url || otherMembers[0]?.profile_photo || otherMembers[0]?.profilePhotoUrl) : ''),
      group_photo: conv.group_photo || conv.photoUrl,
      isPinned,
      is_pinned: isPinned,
      unreadCount: conv.unread_count ?? conv.unreadCount ?? 0,
      unread_count: conv.unread_count ?? conv.unreadCount ?? 0,
      lastMessage: conv.last_message,
      last_message: conv.last_message,
      lastMessageTime: conv.last_message_time || conv.lastMessageTime,
      last_message_time: conv.last_message_time || conv.lastMessageTime,
      otherMembers: otherMembers.length > 0 ? otherMembers : (conv.other_members || conv.otherMembers || []),
      other_members: otherMembers.length > 0 ? otherMembers : (conv.other_members || conv.otherMembers || []),
      isTaskGroup: conv.is_task_group ?? conv.isTaskGroup ?? false,
      is_task_group: conv.is_task_group ?? conv.isTaskGroup ?? false,
      // Preserve any task linkage so task UIs (Task module) can navigate to the task
      taskId: (conv as any).task_id ?? (conv as any).taskId,
      task_id: (conv as any).task_id ?? (conv as any).taskId,
      role: conv.role,
      createdAt: conv.created_at || conv.createdAt,
      created_at: conv.created_at || conv.createdAt,
    };
    } catch (error: any) {
      // If conversation doesn't exist (e.g., for direct_ format before first message),
      // return a minimal conversation object
      if (conversationId.startsWith('direct_')) {
        const otherUserId = conversationId.replace('direct_', '');
        return {
          conversationId: conversationId,
          id: conversationId,
          type: 'direct',
          is_group: false,
          name: '',
          photoUrl: '',
          group_photo: '',
          isPinned: false,
          is_pinned: false,
          unreadCount: 0,
          unread_count: 0,
          otherMembers: [{ id: otherUserId, name: '', phone: '' }],
          other_members: [{ id: otherUserId, name: '', phone: '' }],
          isTaskGroup: false,
          is_task_group: false,
        };
      }
      throw error;
    }
  },

  /**
   * Get all users (for creating new conversations)
   */
  getAllUsers: async (): Promise<User[]> => {
    const response = await api.get<UsersListResponse>('/conversations/users/list');
    const raw = response.data.users || [];
    return raw.map((u: any) => ({
      ...u,
      organization_id: u.organization_id ?? u.organizationId,
      organizationId: u.organizationId ?? u.organization_id,
    }));
  },

  /** Same-organization directory for new chat and assign-people pickers. */
  getOrgContacts: async (): Promise<User[]> => {
    const response = await api.get<UsersListResponse>('/conversations/users/org');
    const raw = response.data.users || [];
    return raw.map((u: any) => ({
      ...u,
      mobile: u.mobile ?? u.phone,
      phone: u.phone ?? u.mobile,
      organization_id: u.organization_id ?? u.organizationId,
      organizationId: u.organizationId ?? u.organization_id,
      profilePhotoUrl: u.profilePhotoUrl ?? u.profile_photo_url ?? u.profile_photo,
    }));
  },

  /**
   * Pin or unpin a conversation
   */
  pinConversation: async (conversationId: string, isPinned: boolean): Promise<any> => {
    const response = await api.put(`/conversations/${conversationId}/pin`, {
      is_pinned: isPinned,
    });
    return response.data;
  },

  /**
   * Create a group conversation
   */
  createGroup: async (name: string, memberIds: string[], groupPhoto?: string): Promise<string> => {
    const response = await api.post<CreateGroupResponse>('/conversations/groups/create', {
      name,
      memberIds,
      group_photo: groupPhoto,
    });
    return response.data.conversationId;
  },

  /**
   * Add members to a group conversation.
   * For task groups, pass taskId so the backend can add members to task_assignees (so they see the task in Task Management).
   */
  addGroupMembers: async (conversationId: string, memberIds: string[], taskId?: string): Promise<any> => {
    const body: { memberIds: string[]; taskId?: string } = { memberIds };
    if (taskId) body.taskId = taskId;
    const response = await api.post(`/conversations/groups/${conversationId}/members`, body);
    return response.data;
  },

  /**
   * Remove a member from a group conversation
   */
  removeGroupMember: async (conversationId: string, memberId: string): Promise<any> => {
    const response = await api.delete(`/conversations/groups/${conversationId}/members/${memberId}`);
    return response.data;
  },

  /**
   * Update group conversation details
   */
  updateGroup: async (conversationId: string, name?: string, groupPhoto?: string): Promise<any> => {
    const response = await api.put(`/conversations/groups/${conversationId}`, {
      name,
      group_photo: groupPhoto,
    });
    return response.data;
  },

  /**
   * Create a task group conversation
   */
  createTaskGroupConversation: async (taskId: string, name: string, memberIds: string[]): Promise<string> => {
    const response = await api.post<{ conversationId: string }>('/conversations/groups/task-group', {
      taskId,
      name,
      memberIds,
    });
    return response.data.conversationId;
  },
};

