import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import { waitForSocketConnection, onSocketEvent, offSocketEvent } from '../services/socketService';

/**
 * Shows in-app toasts when the backend emits notification:new (tasks, messages, etc.).
 */
export const NotificationSocketBridge: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { updateCounts } = useNotifications();
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;
    let handler: ((payload: any) => void) | null = null;

    const setup = async () => {
      try {
        await waitForSocketConnection();
        if (!mounted) return;

        handler = (payload: any) => {
          if (!mounted) return;
          const type = String(payload?.type || '').toLowerCase();
          const isTaskNotification =
            type.includes('task') ||
            payload?.related_entity_type === 'task' ||
            payload?.refType === 'task';
          const isMessageNotification =
            type.includes('message') || type === 'message_received';
          if (!isTaskNotification && !isMessageNotification) {
            const title = payload?.title || 'Notification';
            const body = payload?.description || payload?.body || '';
            const message = body ? `${title}: ${body}` : title;
            toast.info(message, 5000);
            updateCounts();
          }
        };

        onSocketEvent('notification:new', handler);
      } catch (e) {
        console.warn('[NotificationSocketBridge] socket setup failed:', e);
      }
    };

    setup();

    return () => {
      mounted = false;
      if (handler) {
        offSocketEvent('notification:new', handler);
      }
    };
  }, [isAuthenticated, toast, updateCounts]);

  return null;
};
