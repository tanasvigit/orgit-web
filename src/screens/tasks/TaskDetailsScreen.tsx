import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { taskService } from '../../services/taskService';
import { useAuth } from '../../context/AuthContext';
import { EmployeeLayout } from '../../components/employee/EmployeeLayout';
import { AdminLayout } from '../../components/admin/AdminLayout';

export const TaskDetailsScreen: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showRejectModal, setShowRejectModal] = useState(location.state?.showReject || false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const isAdmin = user?.role === 'admin' || location.pathname.startsWith('/admin');

  // Fetch task
  const { data: taskData, isLoading, error: taskError } = useQuery(
    ['task', taskId],
    () => taskService.getTask(taskId!),
    { enabled: !!taskId }
  );

  // taskService.getTask already extracts the task object, so taskData should be the task directly
  const task = taskData;
  
  // Ensure assignees is always an array (handle case where it might be a string or null)
  const assignees = React.useMemo(() => {
    if (!task?.assignees) return [];
    if (Array.isArray(task.assignees)) return task.assignees;
    if (typeof task.assignees === 'string') {
      try {
        return JSON.parse(task.assignees);
      } catch {
        return [];
      }
    }
    return [];
  }, [task?.assignees]);
  
  // Normalize task with assignees array
  const normalizedTask = task ? { ...task, assignees } : null;

  // Accept task mutation
  const acceptTaskMutation = useMutation(
    () => taskService.acceptTask(taskId!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        // Navigate to task chat if conversation_id exists
        const currentTask = normalizedTask || task;
        if (currentTask?.conversation_id) {
          navigate(`/messages/task-group/${currentTask.conversation_id}`);
        } else {
          navigate('/tasks');
        }
      }
    }
  );

  // Reject task mutation
  const rejectTaskMutation = useMutation(
    (reason: string) => taskService.rejectTask(taskId!, reason),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
        setShowRejectModal(false);
        setRejectionReason('');
      }
    }
  );

  // Update task status mutation
  const updateStatusMutation = useMutation(
    (status: string) => taskService.updateTaskStatus(taskId!, status),
    {
      onSuccess: (data) => {
        console.log('Task status updated successfully:', data);
        queryClient.invalidateQueries(['task', taskId]);
        queryClient.invalidateQueries(['tasks']);
        queryClient.invalidateQueries(['dashboard']);
        queryClient.invalidateQueries(['dashboard-statistics']);
      },
      onError: (error: any) => {
        console.error('Failed to update task status:', error);
        console.error('Error response:', error.response);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to update task status';
        alert(errorMessage);
      }
    }
  );

  // Format date helper (matching mobile)
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Not set';
    }
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

  // Get status label
  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'pending': return 'Pending Approval';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'rejected': return 'Rejected';
      default: return status || 'Unknown';
    }
  };

  // Check if user can accept/reject
  const isAssigned = normalizedTask?.assignees?.some((a: any) => (a.id || a.user_id || a.userId) === (user?.id || user?.userId));
  const currentUserStatus = normalizedTask?.current_user_status;
  const hasAccepted = currentUserStatus?.has_accepted || false;
  const hasRejected = currentUserStatus?.has_rejected || false;
  
  const canAccept = isAssigned && !hasAccepted && !hasRejected;
  const canReject = isAssigned && !hasRejected && !hasAccepted;

  // Handle accept
  const handleAccept = async () => {
    try {
      setProcessing(true);
      await acceptTaskMutation.mutateAsync();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to accept task');
    } finally {
      setProcessing(false);
    }
  };

  // Handle reject
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please enter a reason for rejection');
      return;
    }

    try {
      setProcessing(true);
      await rejectTaskMutation.mutateAsync(rejectionReason.trim());
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject task');
    } finally {
      setProcessing(false);
    }
  };

  // Loading state
  if (isLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400 text-sm">Loading task details...</p>
        </div>
      </div>
    );

    if (isAdmin) {
      return <AdminLayout>{loadingContent}</AdminLayout>;
    }
    return <EmployeeLayout>{loadingContent}</EmployeeLayout>;
  }

  // Error or not found state
  if (taskError || !task) {
    const errorContent = (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-red-400 dark:text-red-500 mb-4">error</span>
          <p className="text-red-600 dark:text-red-400 text-lg font-medium mb-2">
            {taskError ? 'Error loading task' : 'Task not found'}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mb-6">
            {taskError instanceof Error ? taskError.message : 'The task you are looking for does not exist or you do not have permission to view it.'}
          </p>
          <button
            onClick={() => navigate(isAdmin ? '/admin/tasks' : '/tasks')}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] mx-auto"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Back to Tasks
          </button>
        </div>
      </div>
    );

    if (isAdmin) {
      return <AdminLayout>{errorContent}</AdminLayout>;
    }
    return <EmployeeLayout>{errorContent}</EmployeeLayout>;
  }

  // Use normalizedTask if available, fallback to task
  const displayTask = normalizedTask || task;
  
  const statusColor = getStatusColor(displayTask.status);
  const priorityColor = getPriorityColor(displayTask.priority);
  const isOverdue = displayTask.due_date && new Date(displayTask.due_date) < new Date() && displayTask.status !== 'completed';

  const content = (
    <div className="p-6 md:p-8">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
            Task Details
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            View and manage task information
          </p>
        </div>
      </div>

      {/* Scrollable Content */}
      <main className="max-w-4xl mx-auto">
        {/* Task Info Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="flex gap-2 flex-wrap">
              {displayTask.status === 'pending' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  {getStatusLabel(displayTask.status)}
                </span>
              )}
              {displayTask.status === 'in_progress' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  In Progress
                </span>
              )}
              {displayTask.status === 'completed' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  Completed
                </span>
              )}
              {displayTask.status === 'rejected' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: statusColor }}
                >
                  Rejected
                </span>
              )}
              {displayTask.priority === 'high' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: priorityColor }}
                >
                  High Priority
                </span>
              )}
              {displayTask.priority === 'medium' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: priorityColor }}
                >
                  Medium Priority
                </span>
              )}
              {displayTask.priority === 'low' && (
                <span 
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: priorityColor }}
                >
                  Low Priority
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isOverdue && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-semibold">
                  <span className="material-symbols-outlined text-base">warning</span>
                  Overdue
                </div>
              )}
              {/* Status Change Dropdown */}
              <div className="relative">
                <select
                  value={displayTask.status || 'pending'}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    if (newStatus !== displayTask.status) {
                      updateStatusMutation.mutate(newStatus);
                    }
                  }}
                  disabled={updateStatusMutation.isLoading}
                  className="appearance-none bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
                  <span className="material-symbols-outlined text-base">arrow_drop_down</span>
                </span>
              </div>
            </div>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold leading-tight text-gray-900 dark:text-white mb-3">{displayTask.title}</h2>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">calendar_today</span>
              <span>Created: {formatDate(displayTask.created_at)}</span>
            </div>
            {displayTask.id && (
              <div className="flex items-center gap-2">
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span>ID: #{displayTask.id.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Description Card */}
        {displayTask.description && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-purple-400 mb-3">
              DESCRIPTION
            </h3>
            <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
              {displayTask.description}
            </p>
          </div>
        )}

        {/* Date Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-purple-400 uppercase">
              <span className="material-symbols-outlined text-base">play_circle</span>
              START DATE
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {formatDate(displayTask.start_date)}
            </span>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-purple-400 uppercase">
              <span className="material-symbols-outlined text-base">flag</span>
              TARGET DATE
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {formatDate(displayTask.target_date)}
            </span>
          </div>
          <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-5 border-2 border-primary/30 dark:border-primary/40 flex flex-col gap-2">
            <span className="flex items-center gap-2 text-xs font-bold text-primary dark:text-purple-400 uppercase">
              <span className="material-symbols-outlined text-base">event</span>
              DUE DATE
            </span>
            <span className="text-lg font-bold text-primary dark:text-purple-300">
              {formatDate(displayTask.due_date)}
            </span>
          </div>
        </div>

        {/* Assigned To Card - Full Details */}
        <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-purple-400">
              ASSIGNED TO
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {assignees.length || 0} {assignees.length === 1 ? 'Assignee' : 'Assignees'}
            </span>
          </div>

          {/* Assignees List with Full Details */}
          {assignees && assignees.length > 0 ? (
            <div className="space-y-3">
              {assignees.map((assignee: any) => {
                const assigneeId = assignee.id || assignee.user_id || assignee.userId;
                const currentUserId = user?.id || user?.userId;
                const isCurrentUser = assigneeId === currentUserId;
                return (
                  <div
                    key={assigneeId || assignee.id || assignee.userId}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                      assignee.has_accepted
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                    } ${isCurrentUser ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    {/* Profile Photo */}
                    <div className="relative flex-shrink-0">
                      {assignee.profile_photo_url || assignee.profile_photo ? (
                        <img
                          src={assignee.profile_photo_url || assignee.profile_photo}
                          alt={assignee.name || 'Assignee'}
                          className="w-14 h-14 rounded-full object-cover border-2 border-white dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg border-2 border-white dark:border-slate-700">
                          {(assignee.name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {assignee.has_accepted && (
                        <div className="absolute -bottom-1 -right-1 size-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined text-white text-xs">check</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white truncate">
                              {assignee.name || 'Unknown User'}
                            </h4>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-semibold rounded-full whitespace-nowrap">
                                You
                              </span>
                            )}
                            {assignee.has_accepted && (
                              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full whitespace-nowrap flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">check_circle</span>
                                Accepted
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {/* Mobile Number */}
                        {assignee.mobile || assignee.phone ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-base text-gray-400">phone</span>
                            <span className="font-medium">{assignee.mobile || assignee.phone}</span>
                          </div>
                        ) : null}

                        {/* Department */}
                        {assignee.department ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-base text-gray-400">business</span>
                            <span className="font-medium">{assignee.department}</span>
                          </div>
                        ) : null}

                        {/* Designation */}
                        {assignee.designation ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <span className="material-symbols-outlined text-base text-gray-400">badge</span>
                            <span className="font-medium">{assignee.designation}</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Status */}
                      {assignee.status && (
                        <div className="mt-2">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                              assignee.status === 'active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {assignee.status === 'active' ? 'Active' : assignee.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <span className="material-symbols-outlined text-4xl mb-2 opacity-50">person_off</span>
              <p className="text-sm">No assignees for this task</p>
            </div>
          )}

          {/* Summary Footer */}
          {assignees && assignees.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">people</span>
                    <span className="font-medium">{assignees.length} Total</span>
                  </span>
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span className="font-medium">
                      {assignees.filter((a: any) => a.has_accepted).length} Accepted
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <span className="material-symbols-outlined text-base">schedule</span>
                    <span className="font-medium">
                      {assignees.filter((a: any) => !a.has_accepted).length} Pending
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Auto Escalation Rules */}
        {displayTask.auto_escalate && (
          <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">warning</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Auto Escalation Rules</h3>
            </div>
            <div className="p-4">
              <ul className="space-y-4 relative pl-2">
                <div className="absolute left-[15px] top-2 bottom-6 w-0.5 bg-gray-100 dark:bg-gray-700"></div>
                <li className="relative flex gap-4 items-start">
                  <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-gray-300 dark:bg-gray-600 ring-4 ring-white dark:ring-slate-800"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">LEVEL 1</span>
                    <span className="text-sm text-gray-700 dark:text-gray-200">Notify Manager if not accepted within 24h</span>
                  </div>
                </li>
                <li className="relative flex gap-4 items-start">
                  <div className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-orange-300 dark:bg-orange-500 ring-4 ring-white dark:ring-slate-800"></div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">LEVEL 2</span>
                    <span className="text-sm text-gray-700 dark:text-gray-200">Escalate to Dept Head if overdue &gt; 2 days</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Activity Log */}
        {displayTask.activities && displayTask.activities.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm mb-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-purple-400 mb-3">
              ACTIVITY LOG
            </h3>
            {displayTask.activities.slice(0, 5).map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  {activity.message || `${activity.activity_type} - ${activity.new_value || ''}`}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(activity.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Action Bar */}
      {(canAccept || canReject) && (
        <div className="max-w-4xl mx-auto mt-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex gap-3">
              {canReject && (
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={processing}
                  className="flex-1 rounded-lg border border-red-500/30 bg-white dark:bg-slate-800 px-6 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                  Reject
                </button>
              )}
              {canAccept && (
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex-[2] rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[20px]">check</span>
                      <span>Accept Task</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowRejectModal(false)}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reject Task</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejection
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection (Required if rejecting)..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || processing}
                className="flex-1 py-3 px-4 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Wrap in appropriate layout
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
