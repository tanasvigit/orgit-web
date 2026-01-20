import api from './api';
import { ComplianceMaster, ComplianceDocument } from '../../shared/src/types';

export interface ComplianceFilters {
  category?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  scope?: 'GLOBAL' | 'ORG';
  search?: string;
  page?: number;
  limit?: number;
}

export const complianceService = {
  getAll: (filters?: ComplianceFilters) =>
    api.get('/compliance', { params: filters }),
  getById: (id: string) => api.get(`/compliance/${id}`),
  create: (data: Partial<ComplianceMaster>) => api.post('/compliance', data),
  update: (id: string, data: Partial<ComplianceMaster>) => api.put(`/compliance/${id}`, data),
  updateStatus: (id: string, status: 'ACTIVE' | 'INACTIVE') =>
    api.patch(`/compliance/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/compliance/${id}`),
  getCategories: () => api.get('/compliance/categories'),
  
  // Document methods
  uploadDocument: (complianceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/compliance/${complianceId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  getDocuments: (complianceId: string) =>
    api.get(`/compliance/${complianceId}/documents`),
  deleteDocument: (complianceId: string, documentId: string) =>
    api.delete(`/compliance/${complianceId}/documents/${documentId}`),
};

/**
 * Helper to get scope badge info
 */
export const getScopeBadge = (scope: 'GLOBAL' | 'ORG') => {
  return {
    label: scope === 'GLOBAL' ? '🌐 Global' : '🏢 Organisation',
    color: scope === 'GLOBAL' ? 'blue' : 'green',
  };
};
