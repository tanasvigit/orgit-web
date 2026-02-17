import api from './api';

export interface TaskBulkUploadResult {
  updated: { tasks: number };
  errors: Array<{ sheet?: string; row?: number; message: string }>;
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
   * Upload filled Excel file; returns updated counts and any row errors.
   */
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ success: boolean; data: { updated: { tasks: number }; errors: TaskBulkUploadResult['errors'] } }>(
      '/admin/tasks/bulk/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },
};
