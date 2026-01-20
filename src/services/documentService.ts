import api from './api';
import { Document } from '../../../shared/src/types';

const API_BASE_URL = '/documents';

export interface UploadDocumentPayload {
  title: string;
  category?: string;
  description?: string;
  file: File;
}

export interface UpdateDocumentPayload {
  title?: string; // Only Super Admin can update title
  category?: string; // Only Super Admin can update category
  description?: string; // Admin and Employee can update description (body/content) of GLOBAL templates
}

export const documentService = {
  async list(): Promise<Document[]> {
    const res = await api.get(API_BASE_URL);
    return res.data.data;
  },

  async getById(id: string): Promise<Document> {
    const res = await api.get(`${API_BASE_URL}/${id}`);
    return res.data.data;
  },

  async upload(payload: UploadDocumentPayload): Promise<Document> {
    const formData = new FormData();
    formData.append('title', payload.title);
    if (payload.category) formData.append('category', payload.category);
    if (payload.description) formData.append('description', payload.description);
    formData.append('file', payload.file);

    const res = await api.post(API_BASE_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },

  async update(id: string, payload: UpdateDocumentPayload): Promise<Document> {
    const res = await api.put(`${API_BASE_URL}/${id}`, payload);
    return res.data.data;
  },

  async updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<Document> {
    const res = await api.patch(`${API_BASE_URL}/${id}/status`, { status });
    return res.data.data;
  },

  async softDelete(id: string): Promise<void> {
    await api.delete(`${API_BASE_URL}/${id}`);
  },
};


