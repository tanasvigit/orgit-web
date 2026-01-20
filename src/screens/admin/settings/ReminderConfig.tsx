import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { getReminderConfig, updateReminderConfig } from '../../../services/settingsService';
import { AdminLayout } from '../../../components/admin/AdminLayout';

interface ReminderConfig {
  dueSoonDays?: number;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  reminderIntervals?: number[];
}

export const ReminderConfig: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ReminderConfig>({
    dueSoonDays: 3,
    pushEnabled: true,
    emailEnabled: true,
    reminderIntervals: [24, 12, 6],
  });

  const { data: configResponse, isLoading } = useQuery('reminder-config', getReminderConfig, {
    onSuccess: (data) => {
      if (data.success && data.data) {
        setConfig(data.data);
      }
    },
  });

  const updateMutation = useMutation(updateReminderConfig, {
    onSuccess: () => {
      alert('Reminder configuration updated successfully');
      navigate(-1);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to update configuration');
    },
  });

  const handleSave = () => {
    updateMutation.mutate(config);
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark">Reminder Configuration</h1>
          <button
            onClick={handleSave}
            disabled={updateMutation.isLoading}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {updateMutation.isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-primary">Loading...</div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Due Soon Days</label>
              <input
                type="number"
                value={config.dueSoonDays || 0}
                onChange={(e) => setConfig({ ...config, dueSoonDays: parseInt(e.target.value) || 0 })}
                placeholder="Days before due date"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark"
              />
              <p className="mt-1 text-xs text-gray-500">Number of days before due date to send reminders</p>
            </div>

            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <p className="font-semibold text-text-main-light dark:text-text-main-dark">Push Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enable push notification reminders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.pushEnabled || false}
                  onChange={(e) => setConfig({ ...config, pushEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <p className="font-semibold text-text-main-light dark:text-text-main-dark">Email Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enable email reminders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.emailEnabled || false}
                  onChange={(e) => setConfig({ ...config, emailEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reminder Intervals (Hours)
              </label>
              <p className="text-xs text-gray-500 mb-2">Comma-separated list (e.g., 24,12,6)</p>
              <input
                type="text"
                value={config.reminderIntervals?.join(',') || ''}
                onChange={(e) => {
                  const intervals = e.target.value
                    .split(',')
                    .map((i) => parseInt(i.trim()))
                    .filter((i) => !isNaN(i));
                  setConfig({ ...config, reminderIntervals: intervals });
                }}
                placeholder="24, 12, 6"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return <AdminLayout>{content}</AdminLayout>;
};

