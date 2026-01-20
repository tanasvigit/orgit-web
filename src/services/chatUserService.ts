import api from './api';

export const chatUserService = {
  async searchUsers(query: string) {
    const params = { q: query, limit: 20 };
    const response = await api.get('/chat/users', { params });
    return response.data;
  },
};


