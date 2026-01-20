import api from './api';

export interface DocumentTemplateFilters {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const documentTemplateService = {
  getAll: (filters?: DocumentTemplateFilters) =>
    api.get('/super-admin/document-templates', { params: filters }),
  getById: (id: string) => api.get(`/super-admin/document-templates/${id}`),
  create: (data: any) => api.post('/super-admin/document-templates', data),
  update: (id: string, data: any) => api.put(`/super-admin/document-templates/${id}`, data),
  delete: (id: string) => api.delete(`/super-admin/document-templates/${id}`),
  getVersions: (id: string) => api.get(`/super-admin/document-templates/${id}/versions`),
  generatePreview: (id: string) => api.post(`/super-admin/document-templates/${id}/preview`),
  getActiveTemplates: () => api.get('/super-admin/document-templates/active'),
};

