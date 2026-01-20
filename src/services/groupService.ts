import api from './api';

export interface CreateGroupRequest {
  name?: string;
  photoUrl?: string;
  memberIds: string[];
}

export const groupService = {
  createGroup: async (data: CreateGroupRequest) => {
    const response = await api.post('/groups', data);
    return response.data;
  },

  getUserGroups: async () => {
    const response = await api.get('/groups');
    return response.data;
  },

  getGroup: async (groupId: string) => {
    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  },

  getGroupMembers: async (groupId: string) => {
    const response = await api.get(`/groups/${groupId}/members`);
    return response.data;
  },

  addMembers: async (groupId: string, memberIds: string[]) => {
    const response = await api.post(`/groups/${groupId}/members`, { memberIds });
    return response.data;
  },

  removeMember: async (groupId: string, memberId: string) => {
    const response = await api.delete(`/groups/${groupId}/members/${memberId}`);
    return response.data;
  },

  updateGroup: async (groupId: string, updates: { name?: string; photoUrl?: string }) => {
    const response = await api.put(`/groups/${groupId}`, updates);
    return response.data;
  },
};

