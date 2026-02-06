import api from './api';

export interface EntityMasterUploadResult {
  updated: {
    organizations: number;
    cost_centres: number;
    branches: number;
    client_entities: number;
    client_entity_services: number;
  };
  errors: Array<{ sheet?: string; row?: number; message: string }>;
}

export const entityMasterBulkService = {
  /**
   * Download entity master Excel template (GET blob, trigger save).
   */
  getTemplate: async (): Promise<void> => {
    const response = await api.get('/admin/entity-master/template', {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'entity_master_template.xlsx';
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
    return api.post<{ success: boolean; data: EntityMasterUploadResult }>(
      '/admin/entity-master/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  },
};
