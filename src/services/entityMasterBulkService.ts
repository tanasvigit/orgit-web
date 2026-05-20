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

export const entityMasterBulkService = {
  /**
   * Download Excel template (GET blob, trigger save).
   * @param only - 'organisation' | 'organisation-structure' | 'employees' | 'service-list' | 'entity-list' | undefined (full template).
   */
  getTemplate: async (
    only?: 'organisation' | 'organisation-structure' | 'employees' | 'service-list' | 'entity-list'
  ): Promise<void> => {
    const params = only ? { only } : undefined;
    console.log('[EntityMaster] getTemplate', { only, params });
    const response = await api.get('/admin/entity-master/template', {
      responseType: 'blob',
      params,
    });
    const blob = response.data as Blob;
    const filename =
      only === 'organisation'
        ? 'Entity_Master_template.xlsx'
        : only === 'organisation-structure'
          ? 'Org_Structure_template.xlsx'
          : only === 'employees'
            ? 'Employee_template.xlsx'
            : only === 'service-list'
              ? 'Service_List_template.xlsx'
              : only === 'entity-list'
                ? 'Entity_List_template.xlsx'
                : 'OrgIt_Settings_template.xlsx';
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    console.log('[EntityMaster] template downloaded', { filename });
  },

  /**
   * Upload filled Excel file; enqueues for processing and returns uploadId.
   */
  uploadFile: (file: File) => {
    console.log('[EntityMaster] uploadFile', { name: file.name, size: file.size, type: file.type });
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

  /**
   * Get status of an entity master bulk upload. Poll until status is 'completed' or 'failed'.
   */
  getStatus: (uploadId: string) => {
    return api.get<{ success: boolean; data: EntityMasterBulkStatusResponse }>(
      `/admin/entity-master/status/${uploadId}`
    );
  },

  /**
   * Poll status until completed or failed. Resolves with final status. Polls every 2s, max 10 min.
   */
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
