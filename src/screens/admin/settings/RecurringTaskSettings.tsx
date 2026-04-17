import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { getRecurringTaskSettings, updateRecurringTaskSettings } from '../../../services/settingsService';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useToast } from '../../../context/ToastContext';

interface RecurringTaskSettings {
  defaultFrequencies?: string[];
  autoCalculateDueDate?: boolean;
  escalationEnabled?: boolean;
}

const availableFrequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'specific_weekday', label: 'Specific Weekday' },
];

export const RecurringTaskSettings: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState<RecurringTaskSettings>({
    defaultFrequencies: ['weekly', 'monthly', 'quarterly', 'yearly'],
    autoCalculateDueDate: true,
    escalationEnabled: true,
  });

  const { data: settingsResponse, isLoading, error } = useQuery('recurring-task-settings', getRecurringTaskSettings, {
    onSuccess: (data) => {
      if (data.success && data.data) {
        setSettings(data.data);
      }
    },
    onError: (error: any) => {
      console.error('Error loading recurring task settings:', error);
    },
  });

  const updateMutation = useMutation(updateRecurringTaskSettings, {
    onSuccess: () => {
      toast.success('Recurring task settings updated successfully');
      navigate(-1);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update settings');
    },
  });

  const handleSave = () => {
    updateMutation.mutate(settings);
  };

  const toggleFrequency = (frequency: string) => {
    const currentFrequencies = settings.defaultFrequencies || [];
    if (currentFrequencies.includes(frequency)) {
      setSettings({
        ...settings,
        defaultFrequencies: currentFrequencies.filter((f) => f !== frequency),
      });
    } else {
      setSettings({
        ...settings,
        defaultFrequencies: [...currentFrequencies, frequency],
      });
    }
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <div className="max-w-4xl mx-auto w-full p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-main-light dark:text-text-main-dark mb-1">
              Recurring Task Settings
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure default frequency options, due date calculation, and escalation behavior
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
            <p className="text-red-600 dark:text-red-400 mb-2">Failed to load settings</p>
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
            {/* Default Frequencies */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Default Frequency Options
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select which frequency options should be available when creating recurring tasks
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {availableFrequencies.map((freq) => {
                  const isSelected = settings.defaultFrequencies?.includes(freq.value) ?? false;
                  return (
                    <button
                      key={freq.value}
                      onClick={() => toggleFrequency(freq.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{freq.label}</span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto Calculate Due Date */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Auto Calculate Due Date
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically calculate due dates for recurring tasks based on frequency
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoCalculateDueDate ?? true}
                    onChange={(e) => setSettings({ ...settings, autoCalculateDueDate: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>

            {/* Escalation Enabled */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Enable Escalation for Recurring Tasks
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically escalate recurring tasks that miss their scheduled date
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.escalationEnabled ?? true}
                    onChange={(e) => setSettings({ ...settings, escalationEnabled: e.target.checked })}
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
                disabled={updateMutation.isLoading || (settings.defaultFrequencies?.length ?? 0) === 0}
                className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md shadow-primary/20"
              >
                {updateMutation.isLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return <AdminLayout>{content}</AdminLayout>;
};
