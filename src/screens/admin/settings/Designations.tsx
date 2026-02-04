import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getDesignations, createDesignation, updateDesignation, deleteDesignation } from '../../../services/settingsService';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useToast } from '../../../context/ToastContext';

interface Designation {
  id?: string;
  name: string;
  description?: string;
  level?: number | string;
}

export const Designations: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', level: '' });

  const { data: designationsResponse, isLoading } = useQuery('designations', getDesignations);
  const designations: Designation[] = designationsResponse?.data || designationsResponse || [];

  const createMutation = useMutation(createDesignation, {
    onSuccess: () => {
      queryClient.invalidateQueries('designations');
      setModalVisible(false);
      setEditingDesignation(null);
      setFormData({ name: '', description: '', level: '' });
      toast.success('Designation created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create designation');
    },
  });

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: any }) => updateDesignation(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('designations');
        setModalVisible(false);
        setEditingDesignation(null);
        setFormData({ name: '', description: '', level: '' });
        toast.success('Designation updated successfully');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to update designation');
      },
    }
  );

  const deleteMutation = useMutation(deleteDesignation, {
    onSuccess: () => {
      queryClient.invalidateQueries('designations');
      toast.success('Designation deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete designation');
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Designation name is required');
      return;
    }

    const payload = {
      name: formData.name,
      description: formData.description,
      level: formData.level ? parseInt(formData.level) : undefined,
    };

    if (editingDesignation && editingDesignation.id) {
      updateMutation.mutate({ id: editingDesignation.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (desig: Designation) => {
    if (!desig.id) {
      toast.error('This designation cannot be deleted as it is stored in user records');
      return;
    }

    toast.confirm(`Are you sure you want to delete "${desig.name}"?`, {
      onConfirm: () => deleteMutation.mutate(desig.id!),
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const openEditModal = (desig: Designation | null = null) => {
    if (desig) {
      setEditingDesignation(desig);
      setFormData({
        name: desig.name || '',
        description: desig.description || '',
        level: desig.level ? desig.level.toString() : '',
      });
    } else {
      setEditingDesignation(null);
      setFormData({ name: '', description: '', level: '' });
    }
    setModalVisible(true);
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark">Designations</h1>
          <button
            onClick={() => openEditModal(null)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <span className="material-icons-outlined">add</span>
            Add Designation
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-primary">Loading...</div>
          </div>
        ) : designations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="material-icons-outlined text-6xl text-gray-400 mb-4">badge</span>
            <p className="text-gray-500 dark:text-gray-400 mb-2">No designations yet</p>
            <p className="text-sm text-gray-400">Click the button above to create one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {designations.map((desig) => (
              <div
                key={desig.id || desig.name}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <p className="font-semibold text-text-main-light dark:text-text-main-dark">{desig.name}</p>
                  {desig.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{desig.description}</p>
                  )}
                  {desig.level && (
                    <p className="text-xs text-gray-400 mt-1">Level: {desig.level}</p>
                  )}
                </div>
                {desig.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(desig)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <span className="material-icons-outlined">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(desig)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                {editingDesignation ? 'Edit Designation' : 'Add Designation'}
              </h2>
              <button
                onClick={() => setModalVisible(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Designation Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter designation name"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description (optional)"
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Level (optional)</label>
                <input
                  type="number"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="Enter level (numeric)"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text-main-light dark:text-text-main-dark"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={createMutation.isLoading || updateMutation.isLoading}
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {createMutation.isLoading || updateMutation.isLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return <AdminLayout>{content}</AdminLayout>;
};

