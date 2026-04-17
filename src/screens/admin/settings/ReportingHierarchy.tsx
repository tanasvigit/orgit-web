import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getReportingHierarchy, updateReportingHierarchy } from '../../../services/settingsService';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useToast } from '../../../context/ToastContext';

interface HierarchyData {
  [key: string]: any;
}

export const ReportingHierarchy: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<HierarchyData>({});
  const [error, setError] = useState<string | null>(null);

  const { data: hierarchyResponse, isLoading } = useQuery('reportingHierarchy', getReportingHierarchy, {
    onSuccess: (data) => {
      if (data?.data) {
        setFormData(data.data);
      } else if (data && typeof data === 'object') {
        setFormData(data);
      }
    },
  });

  const updateMutation = useMutation(updateReportingHierarchy, {
    onSuccess: () => {
      queryClient.invalidateQueries('reportingHierarchy');
      setIsEditing(false);
      setError(null);
      toast.success('Reporting hierarchy updated successfully');
    },
    onError: (error: any) => {
      setError(error.response?.data?.error || 'Failed to update reporting hierarchy');
      toast.error(error.response?.data?.error || 'Failed to update reporting hierarchy');
    },
  });

  const handleSave = () => {
    setError(null);
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    // Reset form data to original
    if (hierarchyResponse?.data) {
      setFormData(hierarchyResponse.data);
    } else if (hierarchyResponse && typeof hierarchyResponse === 'object') {
      setFormData(hierarchyResponse);
    }
    setIsEditing(false);
    setError(null);
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderHierarchyForm = () => {
    if (!formData || Object.keys(formData).length === 0) {
      return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            No hierarchy data available. Click "Edit" to create a new hierarchy structure.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {Object.entries(formData).map(([key, value]) => (
          <div key={key} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
              {key.replace(/_/g, ' ')}
            </label>
            {isEditing ? (
              <input
                type="text"
                value={typeof value === 'object' ? JSON.stringify(value) : String(value || '')}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    handleFieldChange(key, parsed);
                  } catch {
                    handleFieldChange(key, e.target.value);
                  }
                }}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark"
              />
            ) : (
              <p className="text-text-main-light dark:text-text-main-dark">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || 'N/A')}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-text-main-light dark:text-text-main-dark">Reporting Hierarchy</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Manage your organization's reporting structure and hierarchy
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isLoading}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {updateMutation.isLoading ? (
                    <>
                      <span className="material-icons-outlined animate-spin">refresh</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined">save</span>
                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
              >
                <span className="material-icons-outlined">edit</span>
                Edit Hierarchy
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-primary">Loading...</div>
          </div>
        ) : (
          renderHierarchyForm()
        )}

        {!isLoading && (!formData || Object.keys(formData).length === 0) && !isEditing && (
          <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="material-icons-outlined text-blue-600 dark:text-blue-400">info</span>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">Getting Started</h3>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  Click "Edit Hierarchy" to start configuring your organization's reporting structure. This will allow you to define how employees report to each other within your organization.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return <AdminLayout>{content}</AdminLayout>;
};

