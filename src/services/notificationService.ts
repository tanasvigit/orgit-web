import api from './api';

export const notificationService = {
  getUnreadCount: async (): Promise<number> => {
    try {
      const response = await api.get('/notifications/count');
      return Number(response.data?.unread ?? 0) || 0;
    } catch {
      return 0;
    }
  },
};
