import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Avatar } from '../../components/shared';
import { complianceService, getScopeBadge } from '../../services/complianceService';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { ComplianceMaster } from '../../../shared/src/types';
import { AdminComplianceExcelGrid } from '../admin/compliance/AdminComplianceExcelGrid';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';

export const ComplianceManagementHome: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ category: '', status: '', scope: '', search: '', page: 1, limit: 20 });
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [showExcelEditor, setShowExcelEditor] = useState(false);
  const [selectedCompliance, setSelectedCompliance] = useState<ComplianceMaster | null>(null);
  const [showAssignTaskModal, setShowAssignTaskModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  const { data, isLoading } = useQuery(
    ['compliance', filters],
    () => complianceService.getAll(filters as any).then((res) => res.data.data)
  );

  const items: ComplianceMaster[] = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.ceil(totalItems / filters.limit);

  const openAssignTaskModal = (compliance: ComplianceMaster) => {
    setSelectedCompliance(compliance);
    setShowAssignTaskModal(true);
  };

  const handleTaskCreated = () => {
    setShowAssignTaskModal(false);
    setSelectedCompliance(null);
    queryClient.invalidateQueries('tasks');
  };

  const content = (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Management</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {isAdmin ? 'Manage compliance requirements for your organisation' : 'View compliance requirements'}
              </p>
            </div>
            {isAdmin && !showExcelEditor && (
              <button
                onClick={() => setShowExcelEditor(true)}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-medium"
              >
                <span className="material-icons-outlined text-lg">add</span>
                Add Compliance
              </button>
            )}
            {isAdmin && showExcelEditor && (
              <button
                onClick={() => setShowExcelEditor(false)}
                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-medium"
              >
                <span className="material-icons-outlined text-lg">arrow_back</span>
                Back to List
              </button>
            )}
          </div>

        {/* Filters and View Toggle */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-3 flex-1">
            <input
              type="text"
              placeholder="Search by title, description..."
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm flex-1 min-w-[200px]"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />
            <select
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
            >
              <option value="">All Categories</option>
              <option value="Tax">Tax</option>
              <option value="Labour">Labour</option>
              <option value="Corporate">Corporate</option>
              <option value="Environmental">Environmental</option>
            </select>
            <select
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          {(isAdmin || isEmployee) && !showExcelEditor && (
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="material-icons-outlined text-base mr-1">table_view</span>
                Table
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="material-icons-outlined text-base mr-1">grid_view</span>
                Cards
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6">
        {isAdmin && showExcelEditor ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-[calc(100vh-200px)]">
            <AdminComplianceExcelGrid onSave={() => {
              setShowExcelEditor(false);
              queryClient.invalidateQueries(['compliance']);
            }} />
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading compliances...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <span className="material-icons-outlined text-gray-400 text-3xl">description</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400">No compliance items found</p>
            {isAdmin && (
              <button
                onClick={() => setShowExcelEditor(true)}
                className="mt-4 flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg shadow-sm transition-colors font-medium mx-auto"
              >
                <span className="material-icons-outlined text-lg">add</span>
                Add Your First Compliance
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scope</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map((item) => {
                    const scopeBadge = getScopeBadge(item.scope);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <span className="material-icons-outlined text-primary">
                                {item.category === 'Tax' || item.category === 'GST' ? 'receipt_long' :
                                  item.category === 'Labour' ? 'work' :
                                    item.category === 'Corporate' ? 'domain' :
                                      item.category === 'Environmental' ? 'eco' : 'gavel'}
                              </span>
        </div>
                <div>
                              <Link
                                to={isAdmin ? `/admin/compliance/${item.id}` : `/compliance/${item.id}`}
                                className="text-sm font-semibold text-gray-900 dark:text-white hover:text-primary transition-colors"
                              >
                                {item.title}
                              </Link>
                              {item.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 max-w-md">
                                  {item.description}
                                </p>
                              )}
                </div>
              </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900 dark:text-gray-300">{item.category || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {item.complianceType === 'RECURRING' ? `${item.complianceType}${item.frequency ? ` (${item.frequency})` : ''}` : item.complianceType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              item.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {item.status || 'N/A'}
                            </span>
                            {isAdmin && item.approvalStatus && (
                              <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${
                                item.approvalStatus === 'Approved'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              }`}>
                                {item.approvalStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            item.scope === 'GLOBAL'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          }`}>
                            {scopeBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to={isAdmin ? `/admin/compliance/${item.id}` : `/compliance/${item.id}`}
                              className="text-primary hover:text-primary-dark transition-colors"
                            >
                              View
                            </Link>
                            {(isAdmin || user?.role === 'super_admin' || isEmployee) && (
                              <button
                                onClick={() => openAssignTaskModal(item)}
                                className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors flex items-center gap-1"
                                title="Assign as Task"
                              >
                                <span className="material-icons-outlined text-base">assignment</span>
                                Assign Task
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, totalItems)} of {totalItems} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                    disabled={filters.page === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Page {filters.page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setFilters({ ...filters, page: Math.min(totalPages, filters.page + 1) })}
                    disabled={filters.page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const scopeBadge = getScopeBadge(item.scope);
              return (
              <div
                key={item.id}
                  className="group bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/30 transition-all"
              >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:bg-primary group-hover:text-white text-primary transition-colors">
                      <span className="material-icons-outlined">
                        {item.category === 'Tax' || item.category === 'GST' ? 'receipt_long' :
                          item.category === 'Labour' ? 'work' :
                            item.category === 'Corporate' ? 'domain' :
                              item.category === 'Environmental' ? 'eco' : 'gavel'}
                      </span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <h3 
                    onClick={() => navigate(isAdmin ? `/admin/compliance/${item.id}` : `/compliance/${item.id}`)}
                    className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                  >
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.category || 'N/A'}</span>
                    <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.complianceType === 'RECURRING' ? `${item.complianceType}${item.frequency ? ` (${item.frequency})` : ''}` : item.complianceType || 'N/A'}
                    </span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      item.scope === 'GLOBAL'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {scopeBadge.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <Link
                        to={isAdmin ? `/admin/compliance/${item.id}` : `/compliance/${item.id}`}
                        className="text-primary hover:text-primary-dark transition-colors text-xs font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </Link>
                      {(isAdmin || user?.role === 'super_admin' || isEmployee) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAssignTaskModal(item);
                          }}
                          className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors flex items-center gap-1 text-xs font-medium"
                          title="Assign as Task"
                        >
                          <span className="material-icons-outlined text-sm">assignment</span>
                          Assign Task
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Assign as Task Modal */}
      {showAssignTaskModal && selectedCompliance && (
        <TaskCreateModal
          visible={showAssignTaskModal}
          onClose={() => {
            setShowAssignTaskModal(false);
            setSelectedCompliance(null);
          }}
          onSuccess={handleTaskCreated}
          initialTitle={selectedCompliance.title}
          initialDescription={selectedCompliance.description || `Compliance: ${selectedCompliance.title}\n\nCategory: ${selectedCompliance.category || 'N/A'}\nType: ${selectedCompliance.complianceType || 'N/A'}`}
          initialDueDate={selectedCompliance.dueDate ? new Date(selectedCompliance.dueDate) : undefined}
          complianceId={selectedCompliance.id}
        />
      )}
    </div>
  );

  if (isAdmin) {
    return (
      <AdminLayout>
        {content}
      </AdminLayout>
    );
  }

  // Employee route - use EmployeeLayout (no BottomNav)
  return (
    <EmployeeLayout>
      {content}
    </EmployeeLayout>
  );
};
