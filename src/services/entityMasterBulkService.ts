import api from './api';

export interface EntityMasterUploadResult {
  updated: {
    organizations: number;
    cost_centres: number;
    branches: number;
    task_services: number;
    client_entities: number;
    client_entity_services: number;
    employees: number;
  };
  errors: Array<{ sheet?: string; row?: number; message: string }>;
}

export const entityMasterBulkService = {
  /**
   * Download entity master Excel template (GET blob, trigger save).
   * @param onlyOrganisation - If true, requests single-sheet Entity Master template (for /admin/entity-master page).
   */
  getTemplate: async (onlyOrganisation?: boolean): Promise<void> => {
    const params = onlyOrganisation ? { only: 'organisation' } : undefined;
    console.log('[EntityMaster] getTemplate', { onlyOrganisation, params });
    const response = await api.get('/admin/entity-master/template', {
      responseType: 'blob',
      params,
    });
    const blob = response.data as Blob;
    const filename = onlyOrganisation ? 'Entity_Master_template.xlsx' : 'OrgIt_Settings_template.xlsx';
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
   * Upload filled Excel file; returns updated counts and any row errors.
   */
  uploadFile: (file: File) => {
    console.log('[EntityMaster] uploadFile', { name: file.name, size: file.size, type: file.type });
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
