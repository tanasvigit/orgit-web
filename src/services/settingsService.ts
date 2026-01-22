import api from './api';

// Departments
export const getDepartments = async () => {
  const response = await api.get('/admin/departments');
  return response.data;
};

export const createDepartment = async (data: { name: string; description?: string }) => {
  const response = await api.post('/admin/departments', data);
  return response.data;
};

export const updateDepartment = async (id: string, data: { name: string; description?: string }) => {
  const response = await api.put(`/admin/departments/${id}`, data);
  return response.data;
};

export const deleteDepartment = async (id: string) => {
  const response = await api.delete(`/admin/departments/${id}`);
  return response.data;
};

// Designations
export const getDesignations = async () => {
  const response = await api.get('/admin/designations');
  return response.data;
};

export const createDesignation = async (data: { name: string; description?: string; level?: string }) => {
  const response = await api.post('/admin/designations', data);
  return response.data;
};

export const updateDesignation = async (id: string, data: { name: string; description?: string; level?: string }) => {
  const response = await api.put(`/admin/designations/${id}`, data);
  return response.data;
};

export const deleteDesignation = async (id: string) => {
  const response = await api.delete(`/admin/designations/${id}`);
  return response.data;
};

// Reminder Configuration
export const getReminderConfig = async () => {
  const response = await api.get('/admin/settings/reminder');
  return response.data;
};

export const updateReminderConfig = async (data: {
  dueSoonDays?: number;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  reminderIntervals?: number[];
}) => {
  const response = await api.put('/admin/settings/reminder', data);
  return response.data;
};

// Auto Escalation Configuration
export const getAutoEscalationConfig = async () => {
  const response = await api.get('/admin/settings/auto-escalation');
  return response.data;
};

export const updateAutoEscalationConfig = async (data: {
  enabled?: boolean;
  unacceptedHours?: number;
  overdueDays?: number;
  missedRecurrenceEnabled?: boolean;
}) => {
  const response = await api.put('/admin/settings/auto-escalation', data);
  return response.data;
};

// Recurring Task Settings
export const getRecurringTaskSettings = async () => {
  const response = await api.get('/admin/settings/recurring-tasks');
  return response.data;
};

export const updateRecurringTaskSettings = async (data: {
  defaultFrequencies?: string[];
  autoCalculateDueDate?: boolean;
  escalationEnabled?: boolean;
}) => {
  const response = await api.put('/admin/settings/recurring-tasks', data);
  return response.data;
};

// Reporting Hierarchy
export const getReportingHierarchy = async () => {
  const response = await api.get('/organization/hierarchy');
  return response.data;
};

export const updateReportingHierarchy = async (data: any) => {
  const response = await api.put('/organization/hierarchy', data);
  return response.data;
};

