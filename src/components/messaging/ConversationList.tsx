import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Conversation } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId?: string;
  filter: 'All' | 'Direct' | 'Task Groups';
  searchQuery: string;
  onFilterChange: (filter: 'All' | 'Direct' | 'Task Groups') => void;
  onSearchChange: (query: string) => void;
  onCreateNew: () => void;
  hideHeader?: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  currentConversationId,
  filter,
  searchQuery,
  onFilterChange,
  onSearchChange,
  onCreateNew,
  hideHeader = false,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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

  const getConversationName = (conv: Conversation) => {
    // For direct chats, prioritize otherMembers name
    if (!conv.is_group && !conv.is_task_group && conv.otherMembers && conv.otherMembers.length > 0) {
      const member = conv.otherMembers[0] as any;
      return member.name || member.userName || member.mobile || member.phone || conv.name || 'Unknown';
    }
    // For groups/task groups, use the conversation name
    if (conv.name) return conv.name;
    // Fallback to otherMembers if available
    if (conv.otherMembers && conv.otherMembers.length > 0) {
      const member = conv.otherMembers[0] as any;
      return member.name || member.userName || member.mobile || member.phone || 'Unknown';
    }
    return 'Unknown';
  };

  const getConversationPhoto = (conv: Conversation) => {
    // For direct chats, prioritize otherMembers photo
    if (!conv.is_group && !conv.is_task_group && conv.otherMembers && conv.otherMembers.length > 0) {
      const member = conv.otherMembers[0] as any;
      return member.profile_photo_url || member.profile_photo || member.profilePhotoUrl || conv.photoUrl || conv.group_photo || '';
    }
    // For groups/task groups, use the group photo
    const firstMember = conv.otherMembers?.[0] as any;
    return conv.photoUrl || conv.group_photo || firstMember?.profile_photo_url || firstMember?.profile_photo || firstMember?.profilePhotoUrl || '';
  };

  const getLastMessagePreview = (conv: Conversation) => {
    const lastMsg = conv.lastMessage || conv.last_message;
    if (!lastMsg) return 'No messages yet';
    
    const content = lastMsg.content || '';
    const senderName = lastMsg.senderName || lastMsg.sender_name || '';
    const currentUserId = user?.id;
    const isFromMe = (lastMsg.senderId || lastMsg.sender_id) === currentUserId;
    
    if (conv.type === 'group' || conv.is_group) {
      return `${isFromMe ? 'You' : senderName}: ${content}`;
    }
    return content;
  };

  const getConversationId = (conv: Conversation) => {
    return conv.conversationId || conv.id || '';
  };

  // Filter conversations
  const filteredConversations = React.useMemo(() => {
    let filtered = conversations;

    if (filter === 'Direct') {
      // Show only direct chats (not groups, not task groups)
      filtered = filtered.filter(conv => 
        (conv.type === 'direct' || (!conv.is_group && !conv.is_task_group)) && 
        !(conv.isTaskGroup || conv.is_task_group)
      );
    } else if (filter === 'Task Groups') {
      filtered = filtered.filter(conv => conv.isTaskGroup || conv.is_task_group);
    }
    // For 'All', show everything (no filter applied)

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

    return filtered.sort((a, b) => {
      const aPinned = a.isPinned || a.is_pinned || false;
      const bPinned = b.isPinned || b.is_pinned || false;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      const aTime = new Date(a.lastMessageTime || a.last_message_time || 0).getTime();
      const bTime = new Date(b.lastMessageTime || b.last_message_time || 0).getTime();
      return bTime - aTime;
    });
  }, [conversations, filter, searchQuery]);

  // Separate conversations: Task Groups and Pinned go to "Priority & Tasks", others go to "Recent Messages"
  const pinnedConversations = filteredConversations.filter(conv => 
    conv.isPinned || conv.is_pinned || conv.isTaskGroup || conv.is_task_group
  );
  const recentConversations = filteredConversations.filter(conv => 
    !(conv.isPinned || conv.is_pinned) && !(conv.isTaskGroup || conv.is_task_group)
  );

  return (
    <>
      {!hideHeader && (
        <div className="p-6 pb-2">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Messages</h1>
          </div>
          <div className="relative mb-6 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <span className="material-icons-outlined text-xl">search</span>
              </span>
              <input
                className="w-full pl-10 pr-4 py-3 rounded-xl border-none bg-white dark:bg-surface-dark shadow-sm focus:ring-2 focus:ring-primary text-sm placeholder-gray-400 dark:text-gray-200"
                placeholder="Search chats or tasks..."
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <button
              onClick={onCreateNew}
              className="w-10 h-10 bg-secondary dark:bg-primary/20 rounded-xl flex items-center justify-center text-primary transition hover:scale-105 shrink-0"
              title="New Chat"
            >
              <span className="material-icons-outlined">edit</span>
            </button>
          </div>
          <div className="bg-white dark:bg-surface-dark p-1 rounded-xl flex shadow-sm mb-4">
            {(['All', 'Direct', 'Task Groups'] as const).map((filterType) => (
              <button
                key={filterType}
                onClick={() => onFilterChange(filterType)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  filter === filterType
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {filterType}
              </button>
            ))}
          </div>
        </div>
      )}
      {hideHeader && (
        <div className="p-4 pb-2 border-b border-border-light dark:border-border-dark">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <span className="material-icons-outlined text-lg">search</span>
              </span>
              <input
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark focus:ring-2 focus:ring-primary text-sm placeholder-gray-400 dark:text-gray-200"
                placeholder="Search chats or tasks..."
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <button
              onClick={onCreateNew}
              className="w-10 h-10 bg-secondary dark:bg-primary/20 rounded-xl flex items-center justify-center text-primary transition hover:scale-105 shrink-0"
              title="New Chat"
            >
              <span className="material-icons-outlined">edit</span>
            </button>
          </div>
          <div className="bg-white dark:bg-surface-dark p-1 rounded-xl flex shadow-sm">
            {(['All', 'Direct', 'Task Groups'] as const).map((filterType) => (
              <button
                key={filterType}
                onClick={() => onFilterChange(filterType)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  filter === filterType
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {filterType}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {pinnedConversations.length > 0 && (
          <div>
            <h3 className="flex items-center text-xs font-bold text-primary uppercase tracking-wider mb-3 px-2">
              <span className="material-icons-round text-sm mr-1">push_pin</span>
              Priority & Tasks
            </h3>
            <div className="space-y-2">
              {pinnedConversations.map((conv) => {
                const convId = getConversationId(conv);
                const convName = getConversationName(conv);
                const convPhoto = getConversationPhoto(conv);
                const lastMessage = getLastMessagePreview(conv);
                const unreadCount = conv.unreadCount || conv.unread_count || 0;
                const isPinned = conv.isPinned || conv.is_pinned || false;
                const lastMessageTime = conv.lastMessageTime || conv.last_message_time;
                const timeDisplay = formatTime(lastMessageTime);
                const isTaskGroup = conv.isTaskGroup || conv.is_task_group;
                const isActive = convId === currentConversationId;

                return (
                  <div
                    key={convId}
                    className={`bg-white dark:bg-surface-dark p-3 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer border-l-4 ${
                      isActive ? 'border-primary bg-primary/5' : isPinned ? 'border-primary' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    } group`}
                    onClick={() => {
                      if (isTaskGroup) {
                        navigate(isAdmin ? `/admin/messages/task-group/${convId}` : `/messages/task-group/${convId}`);
                      } else {
                        navigate(isAdmin ? `/admin/messages/${convId}` : `/messages/${convId}`);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        {isTaskGroup ? (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-800 to-primary flex items-center justify-center text-white shadow-lg">
                            {convPhoto ? (
                              <img src={convPhoto} alt={convName} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              <span className="material-icons-outlined opacity-50 text-2xl">folder</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-lg overflow-hidden">
                            {convPhoto ? (
                              <img src={convPhoto} alt={convName} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              <span className="material-icons-outlined text-2xl">person</span>
                            )}
                          </div>
                        )}
                        {isTaskGroup && (
                          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-surface-dark p-0.5 rounded-full">
                            <div className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center">
                              <span className="material-icons-round text-[10px]">assignment</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{convName}</h4>
                          <span className={`text-xs ${isPinned ? 'text-primary font-medium' : 'text-gray-400'}`}>
                            {timeDisplay}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isTaskGroup && (
                            <span className="bg-accent-pink dark:bg-red-900/30 text-accent-text dark:text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded">URGENT</span>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{lastMessage}</p>
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <div className="flex flex-col items-end gap-1">
                          <span className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {recentConversations.length > 0 && (
          <div>
            <h3 className="flex items-center text-xs font-bold text-primary uppercase tracking-wider mb-3 px-2 mt-4">
              <span className="material-icons-round text-sm mr-1">person</span>
              Recent Messages
            </h3>
            <div className="space-y-1">
              {recentConversations.map((conv) => {
                const convId = getConversationId(conv);
                const convName = getConversationName(conv);
                const convPhoto = getConversationPhoto(conv);
                const lastMessage = getLastMessagePreview(conv);
                const unreadCount = conv.unreadCount || conv.unread_count || 0;
                const lastMessageTime = conv.lastMessageTime || conv.last_message_time;
                const timeDisplay = formatTime(lastMessageTime);
                const isGroup = conv.type === 'group' || conv.is_group;
                const isActive = convId === currentConversationId;

                return (
                  <div
                    key={convId}
                    className={`p-3 rounded-2xl transition cursor-pointer flex items-center gap-3 ${
                      isActive
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'hover:bg-white dark:hover:bg-surface-dark hover:shadow-sm'
                    }`}
                    onClick={() => {
                      if (isGroup && (conv.isTaskGroup || conv.is_task_group)) {
                        navigate(isAdmin ? `/admin/messages/task-group/${convId}` : `/messages/task-group/${convId}`);
                      } else {
                        navigate(isAdmin ? `/admin/messages/${convId}` : `/messages/${convId}`);
                      }
                    }}
                  >
                    <div className="relative">
                      {convPhoto ? (
                        <img
                          alt={convName}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-gray-700"
                          src={convPhoto}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                          <span className="material-icons-round text-blue-600 dark:text-blue-400 text-2xl">
                            {isGroup ? 'groups' : 'person'}
                          </span>
                        </div>
                      )}
                      {!isGroup && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-700 rounded-full"></span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{convName}</h4>
                        <span className="text-xs text-gray-400">{timeDisplay}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        {lastMessage.includes('done_all') && (
                          <span className="material-icons-round text-[14px] text-primary">done_all</span>
                        )}
                        <p className="truncate">{lastMessage}</p>
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <span className="w-2.5 h-2.5 bg-primary rounded-full"></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pinnedConversations.length === 0 && recentConversations.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-400 text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

