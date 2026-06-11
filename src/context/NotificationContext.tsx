import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { conversationService } from '../services/conversationService';
import { notificationService } from '../services/notificationService';
import { onSocketEvent } from '../services/socketService';
import { normalizeConvId } from '../utils/notificationConvId';
import {
  sumUnreadMap,
  mergeTaskUnreadMaps,
  mergeChatCount,
} from '../utils/notificationUnreadMerge';

export type NotificationCounts = {
  chat: number;
  tasks: number;
  documents: number;
  compliance: number;
  inbox: number;
};

type NotificationContextValue = {
  counts: NotificationCounts;
  taskChatUnreadByConvId: Record<string, number>;
  updateCounts: () => Promise<void>;
  updateChatCount: () => Promise<void>;
  updateTaskCount: () => Promise<void>;
  clearConversationUnread: (conversationId: string) => void;
  reduceChatUnread: (by?: number) => void;
  setActiveViewingConversation: (conversationId: string | null) => void;
  loading: boolean;
};

const defaultCounts: NotificationCounts = {
  chat: 0,
  tasks: 0,
  documents: 0,
  compliance: 0,
  inbox: 0,
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}

function resolveUserId(user: { id?: string; userId?: string } | null | undefined) {
  return user?.id ?? user?.userId ?? null;
}

function resolveMessageConvCandidates(message: any): string[] {
  return [
    normalizeConvId(message?.conversation_id ?? message?.conversationId),
    normalizeConvId(message?.legacy_conversation_id),
  ].filter(Boolean);
}

function resolveTaskConvKey(message: any, taskConvIds: Set<string>): string {
  const candidates = resolveMessageConvCandidates(message);
  for (const id of candidates) {
    if (taskConvIds.has(id)) return id;
  }
  return candidates[0] || '';
}

function isCurrentUser(readerId: unknown, userId: string | null): boolean {
  return readerId != null && userId != null && String(readerId) === String(userId);
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const userId = resolveUserId(user);
  const [counts, setCounts] = useState<NotificationCounts>(defaultCounts);
  const [taskChatUnreadByConvId, setTaskChatUnreadByConvId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearedConvIdsRef = useRef<Set<string>>(new Set());
  const optimisticDeltaRef = useRef<Record<string, number>>({});
  const lastApiUnreadRef = useRef<Record<string, number>>({});
  const optimisticChatDeltaRef = useRef(0);
  const lastChatApiRef = useRef(0);
  const taskConvIdsRef = useRef<Set<string>>(new Set());
  const activeViewingConvIdRef = useRef<string | null>(null);

  const scheduleSync = useCallback((fn: () => void) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      fn();
    }, 400);
  }, []);

  const fetchChatCount = useCallback(async () => {
    if (!userId) return 0;
    try {
      const conversations = await conversationService.getConversations('chat');
      return (conversations || []).reduce(
        (sum, conv) => sum + (Number(conv.unreadCount ?? conv.unread_count ?? 0) || 0),
        0
      );
    } catch {
      return 0;
    }
  }, [userId]);

  const fetchTaskGroupChatUnread = useCallback(async () => {
    if (!userId) return { total: 0, byConvId: {} as Record<string, number> };
    try {
      const conversations = await conversationService.getConversations('task');
      const byConvId: Record<string, number> = {};
      const convIds = new Set<string>();
      let total = 0;
      for (const c of conversations || []) {
        const id = normalizeConvId(c.id ?? c.conversationId);
        if (!id) continue;
        convIds.add(id);
        const n = Number(c.unreadCount ?? c.unread_count ?? 0) || 0;
        byConvId[id] = n;
        total += n;
      }
      taskConvIdsRef.current = convIds;
      return { total, byConvId };
    } catch {
      return { total: 0, byConvId: {} };
    }
  }, [userId]);

  const fetchInboxCount = useCallback(async () => {
    if (!userId) return 0;
    return notificationService.getUnreadCount();
  }, [userId]);

  const applyChatCountFromApi = useCallback((apiCount: number) => {
    const merged = mergeChatCount(
      apiCount,
      optimisticChatDeltaRef.current,
      lastChatApiRef.current
    );
    optimisticChatDeltaRef.current = merged.delta;
    lastChatApiRef.current = merged.lastApi;
    setCounts((prev) => ({ ...prev, chat: merged.display }));
  }, []);

  const updateChatCount = useCallback(async () => {
    const chatCount = await fetchChatCount();
    applyChatCountFromApi(chatCount);
  }, [fetchChatCount, applyChatCountFromApi]);

  const applyTaskUnreadFromApi = useCallback((byConvId: Record<string, number>) => {
    setTaskChatUnreadByConvId((prev) => {
      const merged = mergeTaskUnreadMaps(
        prev,
        byConvId,
        clearedConvIdsRef.current,
        optimisticDeltaRef.current,
        lastApiUnreadRef.current
      );
      setCounts((c) => ({ ...c, tasks: sumUnreadMap(merged) }));
      return merged;
    });
  }, []);

  const updateTaskCount = useCallback(async () => {
    const taskGroupUnread = await fetchTaskGroupChatUnread();
    applyTaskUnreadFromApi(taskGroupUnread.byConvId);
  }, [fetchTaskGroupChatUnread, applyTaskUnreadFromApi]);

  const updateCounts = useCallback(async () => {
    if (!userId) {
      clearedConvIdsRef.current.clear();
      optimisticDeltaRef.current = {};
      lastApiUnreadRef.current = {};
      optimisticChatDeltaRef.current = 0;
      lastChatApiRef.current = 0;
      taskConvIdsRef.current = new Set();
      activeViewingConvIdRef.current = null;
      setTaskChatUnreadByConvId({});
      setCounts(defaultCounts);
      return;
    }

    setLoading(true);
    try {
      const [chatCount, taskGroupUnread, inboxCount] = await Promise.all([
        fetchChatCount(),
        fetchTaskGroupChatUnread(),
        fetchInboxCount(),
      ]);

      const chatMerged = mergeChatCount(
        chatCount,
        optimisticChatDeltaRef.current,
        lastChatApiRef.current
      );
      optimisticChatDeltaRef.current = chatMerged.delta;
      lastChatApiRef.current = chatMerged.lastApi;

      setTaskChatUnreadByConvId((prev) => {
        const merged = mergeTaskUnreadMaps(
          prev,
          taskGroupUnread.byConvId,
          clearedConvIdsRef.current,
          optimisticDeltaRef.current,
          lastApiUnreadRef.current
        );
        setCounts({
          chat: chatMerged.display,
          tasks: sumUnreadMap(merged),
          documents: 0,
          compliance: 0,
          inbox: inboxCount,
        });
        return merged;
      });
    } catch (error) {
      console.error('Error updating notification counts:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchChatCount, fetchTaskGroupChatUnread, fetchInboxCount]);

  const reduceChatUnread = useCallback(
    (by = 1) => {
      const n = Math.max(0, Number(by) || 0);
      if (n <= 0) return;
      optimisticChatDeltaRef.current = Math.max(0, optimisticChatDeltaRef.current - n);
      setCounts((prev) => ({ ...prev, chat: Math.max(0, prev.chat - n) }));
      scheduleSync(() => { void updateChatCount(); });
    },
    [scheduleSync, updateChatCount]
  );

  const clearConversationUnread = useCallback(
    (conversationId: string) => {
      const key = normalizeConvId(conversationId);
      if (!key) return;
      clearedConvIdsRef.current.add(key);
      optimisticDeltaRef.current[key] = 0;
      setTaskChatUnreadByConvId((prev) => {
        const next = { ...prev, [key]: 0 };
        setCounts((c) => ({ ...c, tasks: sumUnreadMap(next) }));
        return next;
      });
      scheduleSync(() => {
        void updateTaskCount();
      });
    },
    [scheduleSync, updateTaskCount]
  );

  const bumpUnreadForMessage = useCallback(
    (message: any) => {
      const senderId = message?.sender_id ?? message?.senderId;
      const isFromOther = senderId != null && String(senderId) !== String(userId);
      if (!isFromOther) return;

      const convId = resolveTaskConvKey(message, taskConvIdsRef.current);
      const isTaskGroup =
        Boolean(message?.is_task_group || message?.isTaskGroup) ||
        (convId && taskConvIdsRef.current.has(convId));

      if (convId && activeViewingConvIdRef.current === convId) {
        return;
      }

      if (isTaskGroup && convId) {
        clearedConvIdsRef.current.delete(convId);
        optimisticDeltaRef.current[convId] = (optimisticDeltaRef.current[convId] || 0) + 1;
        setTaskChatUnreadByConvId((prev) => {
          const apiBase = Number(lastApiUnreadRef.current[convId] || 0);
          const nextCount = apiBase + optimisticDeltaRef.current[convId];
          const next = { ...prev, [convId]: nextCount };
          setCounts((c) => ({ ...c, tasks: sumUnreadMap(next) }));
          return next;
        });
      } else {
        optimisticChatDeltaRef.current += 1;
        setCounts((prev) => ({ ...prev, chat: prev.chat + 1 }));
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setCounts(defaultCounts);
      setTaskChatUnreadByConvId({});
      return;
    }
    void updateCounts();
  }, [isAuthenticated, userId, updateCounts]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const unsubs = [
      onSocketEvent('new_message', bumpUnreadForMessage),
      onSocketEvent('conversation_messages_read', (data: any) => {
        const readerId = data?.userId ?? data?.readByUserId;
        if (!isCurrentUser(readerId, userId)) return;
        if (data?.conversationId) clearConversationUnread(String(data.conversationId));
      }),
      onSocketEvent('notification:new', (payload: any) => {
        const type = String(payload?.type || '').toLowerCase();
        if (type === 'message_received') return;
        void updateCounts();
      }),
      onSocketEvent('task:status_changed', () => { void updateCounts(); }),
      onSocketEvent('task:recurrence_created', () => { void updateCounts(); }),
    ];

    return () => {
      unsubs.forEach((off) => off());
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [
    isAuthenticated,
    userId,
    bumpUnreadForMessage,
    clearConversationUnread,
    updateCounts,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    const interval = setInterval(() => { void updateCounts(); }, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, userId, updateCounts]);

  const setActiveViewingConversation = useCallback((conversationId: string | null) => {
    activeViewingConvIdRef.current = conversationId
      ? normalizeConvId(conversationId)
      : null;
  }, []);

  const value = useMemo(
    () => ({
      counts,
      taskChatUnreadByConvId,
      updateCounts,
      updateChatCount,
      updateTaskCount,
      clearConversationUnread,
      reduceChatUnread,
      setActiveViewingConversation,
      loading,
    }),
    [counts, taskChatUnreadByConvId, updateCounts, updateChatCount, updateTaskCount, clearConversationUnread, reduceChatUnread, setActiveViewingConversation, loading]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
