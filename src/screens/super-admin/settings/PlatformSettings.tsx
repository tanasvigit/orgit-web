import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { SuperAdminLayout } from '../../../components/super-admin/SuperAdminLayout';
import { platformSettingsService } from '../../../services/platformSettingsService';
import { PlatformSettings as PlatformSettingsType } from '../../../../shared/src/types';

export const PlatformSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [autoEscalation, setAutoEscalation] = useState<PlatformSettingsType['autoEscalation']>({
    enabled: true,
    unacceptedHours: 24,
    overdueDays: 2,
    missedRecurrenceEnabled: true,
  });
  const [reminder, setReminder] = useState<PlatformSettingsType['reminder']>({
    dueSoonDays: 3,
    pushEnabled: true,
    emailEnabled: true,
    reminderIntervals: [24, 12, 6],
  });
  const [recurringTasks, setRecurringTasks] = useState<PlatformSettingsType['recurringTasks']>({
    defaultFrequencies: ['weekly', 'monthly', 'quarterly', 'yearly'],
    autoCalculateDueDate: true,
    escalationEnabled: true,
  });
  const [system, setSystem] = useState<PlatformSettingsType['system']>({
    maintenanceMode: false,
    features: {},
  });

  const { data: settings, isLoading } = useQuery(
    'platformSettings',
    () => platformSettingsService.getAll().then((res) => res.data.data)
  );

  useEffect(() => {
    if (settings) {
      setAutoEscalation(settings.autoEscalation);
      setReminder(settings.reminder);
      setRecurringTasks(settings.recurringTasks);
      setSystem(settings.system);
    }
  }, [settings]);

  const updateAutoEscalationMutation = useMutation(
    (config: PlatformSettingsType['autoEscalation']) => platformSettingsService.updateAutoEscalation(config),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('platformSettings');
        alert('Auto-escalation configuration saved successfully');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const updateReminderMutation = useMutation(
    (config: PlatformSettingsType['reminder']) => platformSettingsService.updateReminder(config),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('platformSettings');
        alert('Reminder configuration saved successfully');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const updateRecurringTasksMutation = useMutation(
    (settings: PlatformSettingsType['recurringTasks']) => platformSettingsService.updateRecurringTasks(settings),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('platformSettings');
        alert('Recurring task settings saved successfully');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const updateSystemMutation = useMutation(
    (settings: PlatformSettingsType['system']) => platformSettingsService.updateSystem(settings),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('platformSettings');
        alert('System settings saved successfully');
      },
      onError: (error: any) => {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleAddReminderInterval = () => {
    setReminder({
      ...reminder,
      reminderIntervals: [...reminder.reminderIntervals, 24],
    });
  };

  const handleRemoveReminderInterval = (index: number) => {
    setReminder({
      ...reminder,
      reminderIntervals: reminder.reminderIntervals.filter((_, i) => i !== index),
    });
  };

  const handleUpdateReminderInterval = (index: number, value: number) => {
    const newIntervals = [...reminder.reminderIntervals];
    newIntervals[index] = value;
    setReminder({
      ...reminder,
      reminderIntervals: newIntervals,
    });
  };

  const handleToggleFrequency = (frequency: string) => {
    const currentFrequencies = [...recurringTasks.defaultFrequencies];
    const index = currentFrequencies.indexOf(frequency);
    if (index > -1) {
      currentFrequencies.splice(index, 1);
    } else {
      currentFrequencies.push(frequency);
    }
    setRecurringTasks({
      ...recurringTasks,
      defaultFrequencies: currentFrequencies,
    });
  };

  if (isLoading) {
    return (
      <SuperAdminLayout breadcrumbs={[{ label: 'Platform Settings' }]}>
        <div className="flex items-center justify-center min-h-screen">Loading settings...</div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout breadcrumbs={[{ label: 'Platform Settings' }]}>
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Platform Settings</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
            Configure platform-wide defaults for auto-escalation, reminders, and recurring tasks
          </p>
        </div>

        {/* Auto Escalation Configuration */}
        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-2xl text-orange-500">warning</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Auto Escalation Configuration</h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Auto Escalation</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Automatically escalate tasks based on configured rules</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={autoEscalation.enabled}
                  onChange={(e) => setAutoEscalation({ ...autoEscalation, enabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            {autoEscalation.enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Unaccepted Task Escalation (Hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                    value={autoEscalation.unacceptedHours}
                    onChange={(e) => setAutoEscalation({ ...autoEscalation, unacceptedHours: parseInt(e.target.value, 10) })}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Escalate if task is not accepted within this many hours</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Overdue Task Escalation (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                    value={autoEscalation.overdueDays}
                    onChange={(e) => setAutoEscalation({ ...autoEscalation, overdueDays: parseInt(e.target.value, 10) })}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Escalate if task is overdue by this many days</p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Missed Recurrence Escalation</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Escalate recurring tasks that miss their scheduled date</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={autoEscalation.missedRecurrenceEnabled}
                      onChange={(e) => setAutoEscalation({ ...autoEscalation, missedRecurrenceEnabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              </>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => updateAutoEscalationMutation.mutate(autoEscalation)}
                disabled={updateAutoEscalationMutation.isLoading}
                className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">save</span>
                {updateAutoEscalationMutation.isLoading ? 'Saving...' : 'Save Auto Escalation'}
              </button>
            </div>
          </div>
        </div>

        {/* Reminder Configuration */}
        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-2xl text-blue-500">notifications_active</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reminder Configuration</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Due Soon Days Threshold
              </label>
              <input
                type="number"
                min="1"
                max="30"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                value={reminder.dueSoonDays}
                onChange={(e) => setReminder({ ...reminder, dueSoonDays: parseInt(e.target.value, 10) })}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tasks within this many days of due date are marked as "Due Soon"</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Push Notifications</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable push notifications for reminders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={reminder.pushEnabled}
                  onChange={(e) => setReminder({ ...reminder, pushEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Notifications</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable email notifications for reminders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={reminder.emailEnabled}
                  onChange={(e) => setReminder({ ...reminder, emailEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reminder Intervals (Hours Before Due Date)
              </label>
              <div className="space-y-2">
                {reminder.reminderIntervals.map((interval, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="168"
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800"
                      value={interval}
                      onChange={(e) => handleUpdateReminderInterval(index, parseInt(e.target.value, 10))}
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">hours before due date</span>
                    {reminder.reminderIntervals.length > 1 && (
                      <button
                        onClick={() => handleRemoveReminderInterval(index)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={handleAddReminderInterval}
                  className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Add Reminder Interval
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => updateReminderMutation.mutate(reminder)}
                disabled={updateReminderMutation.isLoading}
                className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">save</span>
                {updateReminderMutation.isLoading ? 'Saving...' : 'Save Reminder Config'}
              </button>
            </div>
          </div>
        </div>

        {/* Recurring Task Settings */}
        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-2xl text-green-500">repeat</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Recurring Task Settings</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Default Frequency Options
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['weekly', 'monthly', 'quarterly', 'yearly', 'specific_weekday'].map((freq) => (
                  <label key={freq} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recurringTasks.defaultFrequencies.includes(freq)}
                      onChange={() => handleToggleFrequency(freq)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{freq.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Calculate Due Date</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Automatically calculate due dates for recurring tasks</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={recurringTasks.autoCalculateDueDate}
                  onChange={(e) => setRecurringTasks({ ...recurringTasks, autoCalculateDueDate: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Escalation for Recurring Tasks</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enable escalation for missed recurring tasks</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={recurringTasks.escalationEnabled}
                  onChange={(e) => setRecurringTasks({ ...recurringTasks, escalationEnabled: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => updateRecurringTasksMutation.mutate(recurringTasks)}
                disabled={updateRecurringTasksMutation.isLoading}
                className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">save</span>
                {updateRecurringTasksMutation.isLoading ? 'Saving...' : 'Save Recurring Task Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* System Configuration */}
        <div className="bg-super-admin-surface-light dark:bg-super-admin-surface-dark rounded-xl shadow-soft border border-super-admin-border-light dark:border-super-admin-border-dark p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-2xl text-gray-500">settings</span>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">System Configuration</h3>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Maintenance Mode</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Put the platform in maintenance mode (blocks all user access)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={system.maintenanceMode}
                  onChange={(e) => setSystem({ ...system, maintenanceMode: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => updateSystemMutation.mutate(system)}
                disabled={updateSystemMutation.isLoading}
                className="flex items-center gap-2 bg-super-admin-primary hover:bg-super-admin-primary-hover text-white px-5 py-2.5 rounded-lg shadow-sm transition-all font-medium disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-xl">save</span>
                {updateSystemMutation.isLoading ? 'Saving...' : 'Save System Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
};

