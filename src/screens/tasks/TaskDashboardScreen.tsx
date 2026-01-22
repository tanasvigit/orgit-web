import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { conversationService } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { TaskCreateModal } from '../../components/tasks/TaskCreateModal';

export const TaskDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'one_time' | 'recurring'>('one_time');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTaskCreateModal, setShowTaskCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch tasks
  const { data: tasksData, isLoading, refetch, error } = useQuery(
    ['tasks', activeTab],
    () => taskService.getTasks({ type: activeTab }),
    {
      onSuccess: () => {
        setRefreshing(false);
      },
      onError: (error: any) => {
        console.error('Error fetching tasks:', error);
        setRefreshing(false);
      }
    }
  );

  const tasks = tasksData || [];

  // Filter tasks by search query
  const filteredTasks = React.useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const lower = searchQuery.toLowerCase();
    return tasks.filter((task: any) =>
      task.title?.toLowerCase().includes(lower) ||
      task.description?.toLowerCase().includes(lower)
    );
  }, [tasks, searchQuery]);

  // Separate pending and all tasks
  const pendingTasks = filteredTasks.filter((task: any) => task.status === 'pending');
  const allTasks = filteredTasks.filter((task: any) => task.status !== 'pending');

  // Format date helper (matching mobile)
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === today.toDateString()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    } catch {
      return '';
    }
  };

  // Check if task is overdue
  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Get priority color
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  // Get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'in_progress': return '#7C3AED';
      case 'completed': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    refetch();
  };

  // Handle accept task
  const acceptTaskMutation = useMutation(
    (taskId: string) => taskService.acceptTask(taskId),
    {
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries(['tasks']);
      }
    }
  );

  // Handle reject task
  const rejectTaskMutation = useMutation(
    ({ taskId, reason }: { taskId: string; reason: string }) => taskService.rejectTask(taskId, reason),
    {
      onSuccess: () => {
        refetch();
        queryClient.invalidateQueries(['tasks']);
      }
    }
  );

  const handleAccept = (taskId: string) => {
    acceptTaskMutation.mutate(taskId);
  };

  const handleReject = (taskId: string) => {
    navigate(`/tasks/${taskId}`, { state: { showReject: true } });
  };

  // Render task card - Desktop optimized
  const renderTask = (task: any) => {
    const isPending = task.status === 'pending';
    const overdue = isOverdue(task.due_date);
    const priorityColor = getPriorityColor(task.priority);
    const statusColor = getStatusColor(task.status);
    
    // Check current user's acceptance status
    const currentUserStatus = task.current_user_status;
    const hasAccepted = currentUserStatus?.has_accepted || false;
    const hasRejected = currentUserStatus?.has_rejected || false;
    const isAssigned = task.assignees?.some((a: any) => a.id === user?.id);
    
    // User can accept/reject if assigned, task is pending, and they haven't accepted/rejected
    const canAccept = isPending && isAssigned && !hasAccepted && !hasRejected;
    const canReject = isPending && isAssigned && !hasRejected && !hasAccepted;
    
    // Calculate acceptance count
    const acceptedCount = task.accepted_count || 0;
    const totalAssignees = task.total_assignees || 0;

    return (
      <div
        key={task.id}
        className="flex flex-col gap-3 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-primary/30 dark:hover:border-primary/50 transition-all group"
        onClick={() => navigate(isAdmin ? `/admin/tasks/${task.id}` : `/tasks/${task.id}`)}
      >
        {/* Header with Status and Priority */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isPending && (
              <span 
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                Pending
              </span>
            )}
            {task.status === 'in_progress' && (
              <span 
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                In Progress
              </span>
            )}
            {task.status === 'completed' && (
              <span 
                className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                style={{ backgroundColor: statusColor }}
              >
                Completed
              </span>
            )}
            {task.priority === 'high' && (
              <div className="flex items-center gap-1.5" style={{ color: priorityColor }}>
                <span className="material-symbols-outlined text-base">priority_high</span>
                <span className="text-xs font-semibold">High</span>
              </div>
            )}
            {task.priority === 'medium' && (
              <div className="flex items-center gap-1.5" style={{ color: priorityColor }}>
                <span className="material-symbols-outlined text-base">equalizer</span>
                <span className="text-xs font-semibold">Medium</span>
              </div>
            )}
            {task.priority === 'low' && (
              <div className="flex items-center gap-1.5" style={{ color: priorityColor }}>
                <span className="material-symbols-outlined text-base">low_priority</span>
                <span className="text-xs font-semibold">Low</span>
              </div>
            )}
          </div>
          {overdue && task.status !== 'completed' && (
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-semibold">
              <span className="material-symbols-outlined text-sm">warning</span>
              Overdue
            </div>
          )}
        </div>

        {/* Task Title */}
        <h3 className="text-gray-900 dark:text-white text-lg font-bold leading-tight group-hover:text-primary dark:group-hover:text-primary-light transition-colors">
          {task.title}
        </h3>
        
        {/* Due Date */}
        <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
          <span className="material-symbols-outlined text-base mr-2">event</span>
          <span>Due {formatDate(task.due_date)}</span>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Acceptance Status */}
        {isPending && totalAssignees > 1 && (
          <div className="flex items-center justify-between gap-2 text-gray-500 dark:text-gray-400 text-sm pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">people</span>
              <span>{acceptedCount} of {totalAssignees} accepted</span>
            </div>
            {hasAccepted && (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span className="text-xs font-semibold">You accepted</span>
              </div>
            )}
          </div>
        )}

        {/* Accept/Reject Buttons */}
        {(canAccept || canReject) && (
          <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            {canReject && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReject(task.id);
                }}
                className="flex-1 flex items-center justify-center h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined text-lg mr-2">close</span>
                Reject
              </button>
            )}
            {canAccept && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAccept(task.id);
                }}
                className="flex-1 flex items-center justify-center h-10 rounded-lg bg-primary text-white font-semibold text-sm shadow-md hover:bg-primary/90 transition-colors"
              >
                <span className="material-symbols-outlined text-lg mr-2">check</span>
                Accept
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Main content component
  const mainContent = (
    <div className="p-6 md:p-8 relative">
      {/* Create Task Button - Top Right Corner (Admin only) */}
      {isAdmin && (
        <button
          onClick={() => setShowTaskCreateModal(true)}
          className="fixed top-24 right-8 z-40 bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-4 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/40 active:scale-95 hover:scale-105"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Create Task</span>
        </button>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">
            Task Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Manage your tasks and track progress
          </p>
        </div>
        {/* Show Create Button for Employee Layout (Admin has it in top right corner) */}
        {!isAdmin && (
          <div className="flex-shrink-0">
            <button
              onClick={() => setShowTaskCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Create Task
            </button>
          </div>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Tab Container */}
          <div className="flex h-10 items-center rounded-lg bg-gray-100 dark:bg-slate-700 p-1 shadow-inner">
            <button
              onClick={() => setActiveTab('one_time')}
              className={`px-4 h-full flex items-center justify-center rounded-md transition-all duration-200 ${
                activeTab === 'one_time'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
              } text-xs font-semibold whitespace-nowrap`}
            >
              One-Time
            </button>
            <button
              onClick={() => setActiveTab('recurring')}
              className={`px-4 h-full flex items-center justify-center rounded-md transition-all duration-200 ${
                activeTab === 'recurring'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
              } text-xs font-semibold whitespace-nowrap`}
            >
              Recurring
            </button>
          </div>

          {/* Search Bar - Navbar Style */}
          <div className="relative w-full sm:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-[18px] pointer-events-none">
              search
            </span>
            <input
              className="w-full bg-slate-100 dark:bg-slate-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-primary-600 rounded-full py-2 pl-10 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-0 focus:outline-none transition-all"
              placeholder="Search..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                title="Clear search"
              >
                <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-base">
                  close
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-400 dark:text-gray-500 text-sm">Loading tasks...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800">
          <span className="material-symbols-outlined text-6xl text-red-400 dark:text-red-500 mb-4">error</span>
          <p className="text-red-600 dark:text-red-400 text-lg font-medium mb-2">Error loading tasks</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            {error instanceof Error ? error.message : 'Failed to fetch tasks. Please try again.'}
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Retry
          </button>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
            task_alt
          </span>
          <p className="text-gray-400 dark:text-gray-500 text-lg font-medium mb-2">No tasks found</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            {searchQuery ? 'Try adjusting your search' : 'Get started by creating your first task'}
          </p>
          <button
            onClick={() => setShowTaskCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Create Task
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Review Section */}
          {pendingTasks.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-primary dark:text-purple-400 uppercase tracking-wider mb-1">
                    PENDING REVIEW
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {pendingTasks.length} task{pendingTasks.length !== 1 ? 's' : ''} awaiting your action
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pendingTasks.map((task: any) => renderTask(task))}
              </div>
            </div>
          )}

          {/* All Tasks Section */}
          {allTasks.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    ALL TASKS
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {allTasks.length} task{allTasks.length !== 1 ? 's' : ''} total
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allTasks.map((task: any) => renderTask(task))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Create Modal */}
      <TaskCreateModal
        visible={showTaskCreateModal}
        onClose={() => setShowTaskCreateModal(false)}
        onSuccess={() => {
          setShowTaskCreateModal(false);
          refetch();
        }}
      />
    </div>
  );

  if (isAdmin) {
    return (
      <AdminLayout>
        {mainContent}
      </AdminLayout>
    );
  }

  // Employee route - use EmployeeLayout
  return (
    <EmployeeLayout>
      {mainContent}
    </EmployeeLayout>
  );
};

