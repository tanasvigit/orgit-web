import api from './api';

export interface TaskBulkUploadResult {
  updated: { tasks: number };
  errors: Array<{ sheet?: string; row?: number; message: string }>;
}

export interface TaskBulkUploadEnqueueResponse {
  uploadId: string;
  totalRows: number;
  status: string;
  validationErrors?: Array<{ sheet?: string; row?: number; message: string }>;
}

export interface TaskBulkUploadStatusResponse {
  totalRows: number;
  status: string;
  processedCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  errors?: Array<{ rowIndex: number; message: string }>;
}

export const taskBulkService = {
  /**
   * Download Excel template for tasks bulk upload.
   */
  getTemplate: async (): Promise<void> => {
    const response = await api.get('/admin/tasks/bulk/template', {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Task_template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  /**
   * Upload filled Excel file; enqueues for processing and returns uploadId.
   */
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ success: boolean; data: TaskBulkUploadEnqueueResponse }>(
      '/admin/tasks/bulk/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },

  /**
   * Get status of a task bulk upload. Poll until status is 'completed' or 'failed'.
   */
  getStatus: (uploadId: string) => {
    return api.get<{ success: boolean; data: TaskBulkUploadStatusResponse }>(
      `/admin/tasks/bulk/status/${uploadId}`
    );
  },

  /**
   * Poll status until completed or failed. Resolves with final status. Polls every 2s, max 10 min.
   */
  pollUntilDone: async (
    uploadId: string,
    onProgress?: (data: TaskBulkUploadStatusResponse) => void
  ): Promise<TaskBulkUploadStatusResponse> => {
    const maxAttempts = 300;
    const intervalMs = 2000;
    for (let i = 0; i < maxAttempts; i++) {
      const res = await api.get<{ success: boolean; data: TaskBulkUploadStatusResponse }>(
        `/admin/tasks/bulk/status/${uploadId}`
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
