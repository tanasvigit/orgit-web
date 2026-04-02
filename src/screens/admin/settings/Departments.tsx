import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../../../services/settingsService';
import { AdminLayout } from '../../../components/admin/AdminLayout';
import { useToast } from '../../../context/ToastContext';

interface Department {
  id?: string;
  name: string;
  description?: string;
}

export const Departments: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const { data: departmentsResponse, isLoading } = useQuery('departments', getDepartments);
  const departments: Department[] = departmentsResponse?.data || departmentsResponse || [];

  const createMutation = useMutation(createDepartment, {
    onSuccess: () => {
      queryClient.invalidateQueries('departments');
      setModalVisible(false);
      setEditingDepartment(null);
      setFormData({ name: '', description: '' });
      toast.success('Department created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create department');
    },
  });

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: any }) => updateDepartment(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('departments');
        setModalVisible(false);
        setEditingDepartment(null);
        setFormData({ name: '', description: '' });
        toast.success('Department updated successfully');
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.error || 'Failed to update department');
      },
    }
  );

  const deleteMutation = useMutation(deleteDepartment, {
    onSuccess: () => {
      queryClient.invalidateQueries('departments');
      toast.success('Department deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete department');
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    if (editingDepartment && editingDepartment.id) {
      updateMutation.mutate({ id: editingDepartment.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (dept: Department) => {
    if (!dept.id) {
      toast.error('This department cannot be deleted as it is stored in user records');
      return;
    }

    toast.confirm(`Are you sure you want to delete "${dept.name}"?`, {
      onConfirm: () => deleteMutation.mutate(dept.id!),
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
  };

  const openEditModal = (dept: Department | null = null) => {
    if (dept) {
      setEditingDepartment(dept);
      setFormData({
        name: dept.name || '',
        description: dept.description || '',
      });
    } else {
      setEditingDepartment(null);
      setFormData({ name: '', description: '' });
    }
    setModalVisible(true);
  };

  const content = (
    <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-text-main-light dark:text-text-main-dark">Departments</h1>
          <button
            onClick={() => openEditModal(null)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
          >
            <span className="material-icons-outlined">add</span>
            Add Department
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-primary">Loading...</div>
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="material-icons-outlined text-6xl text-gray-400 mb-4">domain</span>
            <p className="text-gray-500 dark:text-gray-400 mb-2">No departments yet</p>
            <p className="text-sm text-gray-400">Click the button above to create one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => (
              <div
                key={dept.id || dept.name}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-1">
                  <p className="font-semibold text-text-main-light dark:text-text-main-dark">{dept.name}</p>
                  {dept.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{dept.description}</p>
                  )}
                </div>
                {dept.id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(dept)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <span className="material-icons-outlined">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
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
                {editingDepartment ? 'Edit Department' : 'Add Department'}
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
                  Department Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter department name"
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

