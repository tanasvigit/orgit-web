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
   * Download Excel template (GET blob, trigger save).
   * @param only - 'organisation' | 'employees' | 'service-list' | 'entity-list' | undefined (full template).
   */
  getTemplate: async (only?: 'organisation' | 'employees' | 'service-list' | 'entity-list'): Promise<void> => {
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
