import api from './api';

export interface EntityMasterUploadResult {
  updated: {
    organizations: number;
    organization_structure_nodes?: number;
    task_services: number;
    client_entities: number;
    client_entity_services: number;
    employees: number;
  };
  errors: Array<{ sheet?: string; row?: number; message: string }>;
}

export interface EntityMasterBulkEnqueueResponse {
  uploadId: string;
  status: string;
}

export interface EntityMasterBulkStatusResponse {
  status: string;
  processedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  summary?: {
    organizations?: number;
    organization_structure_nodes?: number;
    task_services?: number;
    client_entities?: number;
    client_entity_services?: number;
    employees?: number;
    tasks?: number;
    totalErrors?: number;
  };
  errors?: Array<{ sheet?: string; row?: number; message: string }>;
}

export const MASTER_BULK_FILENAME = 'OrgIt_Master_Bulk.xlsx';

export const entityMasterBulkService = {
  /** Download unified OrgIt Master Bulk workbook. */
  getTemplate: async (): Promise<void> => {
    const response = await api.get('/admin/entity-master/template', {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = MASTER_BULK_FILENAME;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ success: boolean; data: EntityMasterBulkEnqueueResponse }>(
      '/admin/entity-master/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },

  getStatus: (uploadId: string) => {
    return api.get<{ success: boolean; data: EntityMasterBulkStatusResponse }>(
      `/admin/entity-master/status/${uploadId}`
    );
  },

  pollUntilDone: async (
    uploadId: string,
    onProgress?: (data: EntityMasterBulkStatusResponse) => void
  ): Promise<EntityMasterBulkStatusResponse> => {
    const maxAttempts = 300;
    const intervalMs = 2000;
    for (let i = 0; i < maxAttempts; i++) {
      const res = await api.get<{ success: boolean; data: EntityMasterBulkStatusResponse }>(
        `/admin/entity-master/status/${uploadId}`
      );
      const data = res.data?.data;
      if (!data) throw new Error('Invalid status response');
      if (onProgress) onProgress(data);
      if (data.status === 'completed' || data.status === 'failed') return data;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Polling timed out');
  },
};
