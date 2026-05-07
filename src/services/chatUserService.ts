import api from './api';

export const chatUserService = {
  async searchUsers(query: string, organizationId?: string) {
    const params = { q: query, limit: 20 };
    const response = await api.get('/chat/users', { params });
    const payload = response.data || {};
    const users = Array.isArray(payload?.data) ? payload.data : [];
    if (!organizationId) return payload;

    const filtered = users.filter(
      (u: any) => (u?.organization_id || u?.organizationId) === organizationId
    );
    return {
      ...payload,
      data: filtered,
    };
  },
};


