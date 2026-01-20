import api from './api';
import { PlatformSettings } from '../../shared/src/types';

export const platformSettingsService = {
  getAll: () => api.get('/super-admin/settings'),
  getSetting: (key: string) => api.get(`/super-admin/settings/${key}`),
  getAutoEscalation: () => api.get('/super-admin/settings/auto_escalation'),
  updateAutoEscalation: (config: PlatformSettings['autoEscalation']) =>
    api.put('/super-admin/settings/auto-escalation', config),
  getReminder: () => api.get('/super-admin/settings/reminder'),
  updateReminder: (config: PlatformSettings['reminder']) =>
    api.put('/super-admin/settings/reminder', config),
  getRecurringTasks: () => api.get('/super-admin/settings/recurring_tasks'),
  updateRecurringTasks: (settings: PlatformSettings['recurringTasks']) =>
    api.put('/super-admin/settings/recurring-tasks', settings),
  getSystem: () => api.get('/super-admin/settings/system'),
  updateSystem: (settings: PlatformSettings['system']) =>
    api.put('/super-admin/settings/system', settings),
};

