import api from './api';

export interface DocumentManagementSettings {
  enabled: boolean;
  checkedByUserId?: string | null;
  approvedByUserId?: string | null;
}

export const documentManagementSettingsService = {
  async get(): Promise<DocumentManagementSettings> {
    const res = await api.get('/admin/document-management-settings');
    return res.data.data;
  },

  async update(settings: DocumentManagementSettings): Promise<DocumentManagementSettings> {
    const res = await api.put('/admin/document-management-settings', settings);
    return res.data.data;
  },
};

