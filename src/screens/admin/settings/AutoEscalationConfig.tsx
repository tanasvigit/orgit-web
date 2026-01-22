import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { getAutoEscalationConfig, updateAutoEscalationConfig } from '../../../services/settingsService';
import { AdminLayout } from '../../../components/admin/AdminLayout';

interface AutoEscalationConfig {
  enabled?: boolean;
  unacceptedHours?: number;
  overdueDays?: number;
  missedRecurrenceEnabled?: boolean;
}

export const AutoEscalationConfig: React.FC = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AutoEscalationConfig>({
    enabled: true,
    unacceptedHours: 24,
    overdueDays: 2,
    missedRecurrenceEnabled: true,
  });

  const { data: configResponse, isLoading, error } = useQuery('auto-escalation-config', getAutoEscalationConfig, {
    onSuccess: (data) => {
      if (data.success && data.data) {
        setConfig(data.data);
      }
    },
    onError: (error: any) => {
      console.error('Error loading auto-escalation config:', error);
    },
  });

  const updateMutation = useMutation(updateAutoEscalationConfig, {
    onSuccess: () => {
      alert('Auto-escalation configuration updated successfully');
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
      <div className="max-w-4xl mx-auto w-full p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-text-main-light dark:text-text-main-dark mb-1">
              Auto Escalation Configuration
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure rules for automatic task escalation
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
            {/* Enable Auto Escalation */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Enable Auto Escalation
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically escalate tasks based on configured rules
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled ?? true}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Unaccepted Hours */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Unaccepted Hours
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={config.unacceptedHours || 24}
                onChange={(e) => setConfig({ ...config, unacceptedHours: parseInt(e.target.value) || 24 })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Number of hours before escalating tasks that have not been accepted (1-168 hours)
              </p>
            </div>

            {/* Overdue Days */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Overdue Days
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={config.overdueDays || 2}
                onChange={(e) => setConfig({ ...config, overdueDays: parseInt(e.target.value) || 2 })}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Number of days after due date before escalating overdue tasks (1-30 days)
              </p>
            </div>

            {/* Missed Recurrence Enabled */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Escalate Missed Recurrence
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically escalate recurring tasks that miss their scheduled date
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.missedRecurrenceEnabled ?? true}
                    onChange={(e) => setConfig({ ...config, missedRecurrenceEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
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
