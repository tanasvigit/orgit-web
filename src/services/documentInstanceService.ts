import api from './api';

const API_BASE_URL = '/document-instances';

export interface DocumentInstance {
  id: string;
  templateId: string;
  organizationId: string;
  title: string;
  filledData: Record<string, any>;
  pdfUrl: string;
  status: 'draft' | 'final' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentInstanceFilters {
  status?: 'draft' | 'final' | 'archived' | '';
  templateId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateDocumentInstancePayload {
  templateId: string;
  filledData: Record<string, any>;
  title: string;
  status?: 'draft' | 'final';
}

export interface UpdateDocumentInstancePayload {
  filledData?: Record<string, any>;
  title?: string;
  status?: 'draft' | 'final';
}

export const documentInstanceService = {
  async list(filters?: DocumentInstanceFilters): Promise<{
    instances: DocumentInstance[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.templateId) params.append('templateId', filters.templateId);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const res = await api.get(`${API_BASE_URL}?${params.toString()}`);
    return res.data.data;
  },

  async getById(id: string): Promise<DocumentInstance> {
    const res = await api.get(`${API_BASE_URL}/${id}`);
    return res.data.data;
  },

  async create(payload: CreateDocumentInstancePayload): Promise<DocumentInstance> {
    const res = await api.post(API_BASE_URL, payload);
    return res.data.data;
  },

  async update(id: string, payload: UpdateDocumentInstancePayload): Promise<DocumentInstance> {
    const res = await api.put(`${API_BASE_URL}/${id}`, payload);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`${API_BASE_URL}/${id}`);
  },

  async download(id: string): Promise<Blob> {
    const res = await api.get(`${API_BASE_URL}/${id}/download`, {
      responseType: 'blob',
    });
    return res.data;
  },

  async share(id: string): Promise<{ shareUrl: string }> {
    // TODO: Implement share functionality if needed
    const res = await api.post(`${API_BASE_URL}/${id}/share`);
    return res.data.data;
  },
};

