import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { getReminderConfig, updateReminderConfig } from '../../../services/settingsService';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useToast } from '../../../context/ToastContext';

interface ReminderConfig {
  dueSoonDays?: number;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  reminderIntervals?: number[];
}

export const ReminderConfig: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [config, setConfig] = useState<ReminderConfig>({
    dueSoonDays: 3,
    pushEnabled: true,
    emailEnabled: true,
    reminderIntervals: [24, 12, 6],
  });

  const { data: configResponse, isLoading, error } = useQuery('reminder-config', getReminderConfig, {
    onSuccess: (data) => {
      if (data.success && data.data) {
        setConfig(data.data);
      }
    },
    onError: (error: any) => {
      console.error('Error loading reminder config:', error);
    },
  });

  const updateMutation = useMutation(updateReminderConfig, {
    onSuccess: () => {
      toast.success('Reminder configuration updated successfully');
      navigate(-1);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update configuration');
    },
  });

  const handleSave = () => {
    updateMutation.mutate(config);
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <div className="max-w-4xl mx-auto w-full p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-main-light dark:text-text-main-dark mb-1">
              Reminder Configuration
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure due soon days and reminder intervals
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="material-icons-outlined text-6xl text-red-500 mb-4">error_outline</span>
            <p className="text-red-600 dark:text-red-400 mb-2">Failed to load configuration</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {(error as any)?.response?.data?.error || (error as any)?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Due Soon Days */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Due Soon Days</label>
              <input
                type="number"
                min="1"
                max="30"
                value={config.dueSoonDays || 3}
                onChange={(e) => setConfig({ ...config, dueSoonDays: parseInt(e.target.value) || 3 })}
                placeholder="Days before due date"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Number of days before due date to send reminders (1-30 days)</p>
            </div>

            {/* Push Notifications */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Push Notifications</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Enable push notification reminders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.pushEnabled ?? true}
                    onChange={(e) => setConfig({ ...config, pushEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Email Notifications */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Email Notifications</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Enable email reminders</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.emailEnabled ?? true}
                    onChange={(e) => setConfig({ ...config, emailEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Reminder Intervals */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Reminder Intervals (Hours)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Comma-separated list (e.g., 24,12,6)</p>
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
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Hours before due date to send reminders (1-168 hours each)</p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isLoading}
                className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md shadow-primary/20"
              >
                {updateMutation.isLoading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return <AdminLayout>{content}</AdminLayout>;
};

