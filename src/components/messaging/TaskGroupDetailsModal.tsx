import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { taskService } from '../../services/taskService';
import { conversationService } from '../../services/conversationService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { format } from 'date-fns';
import { Avatar } from '../shared';

interface TaskGroupDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  taskId: string | null | undefined;
  conversationId?: string | null;
  conversationData?: any;
  /** When true, open the modal with Add Members section expanded (e.g. from "+" menu) */
  openAddMembers?: boolean;
}

export const TaskGroupDetailsModal: React.FC<TaskGroupDetailsModalProps> = ({
  visible,
  onClose,
  taskId,
  conversationId,
  conversationData,
  openAddMembers = false,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [showAddMembers, setShowAddMembers] = useState(false);

  React.useEffect(() => {
    if (visible && openAddMembers) {
      setShowAddMembers(true);
    }
  }, [visible, openAddMembers]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Fetch conversation details directly to ensure we have the latest data
  const { data: latestConversationData } = useQuery(
    ['conversation', conversationId],
    () => conversationService.getConversationDetails(conversationId!),
    { 
      enabled: visible && !!conversationId,
      refetchOnWindowFocus: false,
    }
  );

  // Use latest conversation data if available, otherwise fall back to prop
  const activeConversationData = latestConversationData || conversationData;
  
  // Get group members from conversation data
  const groupMembers = activeConversationData?.otherMembers || activeConversationData?.data?.otherMembers || activeConversationData?.other_members || [];
  
  // Get current user ID
  const currentUserId = user?.id || user?.userId;

  // Extract taskId from conversation data if not provided as prop
  const effectiveTaskId = taskId || activeConversationData?.taskId || activeConversationData?.data?.taskId || activeConversationData?.task_id || null;

  // Fetch task details
  const { data: taskData, isLoading: isLoadingTask, error: taskError } = useQuery(
    ['task', effectiveTaskId],
    () => taskService.getTask(effectiveTaskId!),
    { enabled: visible && !!effectiveTaskId }
  );

  // taskService.getTask already extracts the task object, so taskData should be the task directly
  const task = taskData;

  // Replicate Task Details page: fetch all users when Add Members is open, then filter by name/mobile
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery(
    ['all-users'],
    () => conversationService.getAllUsers(),
    { enabled: showAddMembers && visible }
  );

  // Filter out users who are already group members
  const availableUsers = useMemo(() => {
    if (!allUsers || !Array.isArray(allUsers)) return [];
    return allUsers.filter(
      (u: any) => !groupMembers.some((m: any) => (m.id || m.userId) === u.id)
    );
  }, [allUsers, groupMembers]);

  // By default show same-organisation members (company employees); on search show all matching users including outsiders
  const currentOrgId = user?.organizationId || (user as any)?.organization_id;
  const filteredUsers = useMemo(() => {
    const hasSearch = (searchQuery || '').trim().length > 0;
    const q = searchQuery.trim().toLowerCase();
    if (hasSearch) {
      return availableUsers.filter(
        (u: any) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.mobile || u.phone || '').toString().toLowerCase().includes(q)
      );
    }
    if (currentOrgId) {
      const sameOrg = availableUsers.filter(
        (u: any) => (u.organization_id || u.organizationId) === currentOrgId
      );
      return sameOrg.length > 0 ? sameOrg : availableUsers;
    }
    return availableUsers;
  }, [availableUsers, searchQuery, currentOrgId]);

  // Add members mutation (also adds new members as task assignees on backend so they get TODO / Accept / Reject)
  const addMembersMutation = useMutation(
    (memberIds: string[]) => conversationService.addGroupMembers(conversationId!, memberIds),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['conversation', conversationId]);
        queryClient.invalidateQueries('conversations');
        if (effectiveTaskId) {
          queryClient.invalidateQueries(['task', effectiveTaskId]);
          queryClient.invalidateQueries('dashboard');
        }
        setShowAddMembers(false);
        setSearchQuery('');
        setSelectedUserIds([]);
        toast.success('Members added successfully!');
      },
      onError: (error: any) => {
        toast.error(`Failed to add members: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  // Exit group mutation
  const exitGroupMutation = useMutation(
    () => conversationService.removeGroupMember(conversationId!, currentUserId!),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('conversations');
        onClose();
        // Navigate back to messages list
        navigate(isAdmin ? '/admin/messages' : '/messages');
        toast.success('You have left the group');
      },
      onError: (error: any) => {
        toast.error(`Failed to exit group: ${error.response?.data?.error || error.message}`);
      },
    }
  );

  const handleAddMembers = () => {
    if (selectedUserIds.length === 0) {
      toast.error('Please select at least one member to add');
      return;
    }
    addMembersMutation.mutate(selectedUserIds);
  };

  const handleExitGroup = () => {
    toast.confirm('Are you sure you want to exit this group?', {
      onConfirm: () => exitGroupMutation.mutate(),
      confirmLabel: 'Exit',
      cancelLabel: 'Cancel',
    });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'in_progress':
      case 'inprogress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'overdue':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-primary dark:bg-primary/90 rounded-t-2xl">
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            <span className="material-icons-outlined">assignment</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Task Details Section - Show first if available */}
          {isLoadingTask ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3 text-gray-500 dark:text-gray-400">Loading task details...</span>
            </div>
          ) : taskError ? (
            <div className="text-center py-8 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
              <span className="material-icons-outlined text-red-400 text-4xl mb-2">error_outline</span>
              <p className="text-red-600 dark:text-red-400 font-medium mb-1">Error loading task details</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {(taskError as any)?.message || 'Failed to fetch task information'}
              </p>
            </div>
          ) : effectiveTaskId && task ? (
            <div className="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              {/* Task Title/Name - Always visible */}
              <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <span className="material-icons-outlined text-base align-middle mr-1">assignment</span>
                  Task Name
                </label>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {task.title || task.name || 'Untitled Task'}
                </h3>
              </div>

              {/* Description - Always visible */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <span className="material-icons-outlined text-base align-middle mr-1">description</span>
                  Description
                </label>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 min-h-[60px]">
                  {task.description ? (
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {task.description}
                    </p>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 text-sm italic">No description provided</p>
                  )}
                </div>
              </div>

              {/* All Three Dates - Always visible in grid */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <span className="material-icons-outlined text-base align-middle mr-1">calendar_month</span>
                  Important Dates
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Start Date - Always visible */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                      <span className="material-icons-outlined text-sm align-middle mr-1">event</span>
                      Start Date
                    </label>
                    <p className="text-gray-900 dark:text-white font-semibold text-base">
                      {(() => {
                        try {
                          const dateStr = task.start_date || task.startDate;
                          if (!dateStr) return 'Not set';
                          const date = new Date(dateStr);
                          return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM dd, yyyy');
                        } catch {
                          return 'Not set';
                        }
                      })()}
                    </p>
                    {(!task.start_date && !task.startDate) && (
                      <p className="text-gray-400 dark:text-gray-500 italic text-xs mt-1">Start date not set</p>
                    )}
                  </div>

                  {/* Target Date - Always visible */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                      <span className="material-icons-outlined text-sm align-middle mr-1">flag</span>
                      Target Date
                    </label>
                    <p className="text-gray-900 dark:text-white font-semibold text-base">
                      {(() => {
                        try {
                          const dateStr = task.target_date || task.targetDate;
                          if (!dateStr) return 'Not set';
                          const date = new Date(dateStr);
                          return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM dd, yyyy');
                        } catch {
                          return 'Not set';
                        }
                      })()}
                    </p>
                    {(!task.target_date && !task.targetDate) && (
                      <p className="text-gray-400 dark:text-gray-500 italic text-xs mt-1">Target date not set</p>
                    )}
                  </div>

                  {/* Due Date - Always visible */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                      <span className="material-icons-outlined text-sm align-middle mr-1">schedule</span>
                      Due Date
                    </label>
                    <p className="text-gray-900 dark:text-white font-semibold text-base">
                      {(() => {
                        try {
                          const dateStr = task.due_date || task.dueDate;
                          if (!dateStr) return 'Not set';
                          const date = new Date(dateStr);
                          return isNaN(date.getTime()) ? 'Invalid date' : format(date, 'MMM dd, yyyy');
                        } catch {
                          return 'Not set';
                        }
                      })()}
                    </p>
                    {(!task.due_date && !task.dueDate) && (
                      <p className="text-gray-400 dark:text-gray-500 italic text-xs mt-1">Due date not set</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status - Optional but visible if available */}
              {task.status && (
                <div className="flex items-center gap-4 flex-wrap pt-2">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        task.status
                      )}`}
                    >
                      {task.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {/* Recurrence Info */}
              {(task.task_type === 'recurring' || task.taskType === 'recurring') && (task.recurrence_type || task.recurrenceType) && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Recurrence Pattern
                  </label>
                  <p className="text-gray-900 dark:text-white font-medium text-sm capitalize">
                    {task.recurrence_type || task.recurrenceType}
                    {(task.recurrence_interval || task.recurrenceInterval) && ` (Every ${task.recurrence_interval || task.recurrenceInterval})`}
                  </p>
                </div>
              )}

              {/* Auto Escalate */}
              {(task.auto_escalate !== undefined || task.autoEscalate !== undefined) && (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Auto Escalate
                  </label>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      (task.auto_escalate || task.autoEscalate)
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {(task.auto_escalate || task.autoEscalate) ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              )}

              {/* Assignees */}
              {task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <span className="material-icons-outlined text-base align-middle mr-1">person</span>
                    Assigned To ({task.assignees.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {task.assignees.map((assignee: any) => (
                      <div
                        key={assignee.id || assignee.user_id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700"
                      >
                        {assignee.profile_photo_url || assignee.profilePhotoUrl ? (
                          <img
                            src={assignee.profile_photo_url || assignee.profilePhotoUrl}
                            alt={assignee.name || 'User'}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-xs">
                            {(assignee.name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {assignee.name || assignee.mobile || 'Unknown'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Created Date */}
              {(task.created_at || task.createdAt) && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span className="material-icons-outlined text-sm align-middle mr-1">calendar_today</span>
                    Created On
                  </label>
                  <p className="text-gray-900 dark:text-white font-medium text-sm">
                    {(() => {
                      try {
                        const date = new Date(task.created_at || task.createdAt);
                        return isNaN(date.getTime()) ? 'Not available' : format(date, 'MMM dd, yyyy hh:mm a');
                      } catch {
                        return 'Not available';
                      }
                    })()}
                  </p>
                </div>
              )}
            </div>
          ) : !effectiveTaskId ? (
            <div className="text-center py-8 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/30">
              <span className="material-icons-outlined text-gray-400 text-4xl mb-2">assignment</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No task ID available</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                This conversation may not be linked to a task
              </p>
            </div>
          ) : null}

          {/* Group Members Section - Always visible to all members */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                <span className="material-icons-outlined text-base align-middle mr-1">people</span>
                Group Members ({groupMembers.length})
              </label>
              <button
                onClick={() => setShowAddMembers(!showAddMembers)}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                <span className="material-icons-outlined text-sm">person_add</span>
                Add Members
              </button>
            </div>
            
            {/* Add Members UI - same flow as Task Details page (search by name or mobile, show numbers) */}
            {showAddMembers && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or mobile number..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                
                {isLoadingUsers && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Loading users...</p>
                )}
                
                {filteredUsers.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                    {filteredUsers.map((user: any) => (
                      <button
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                          selectedUserIds.includes(user.id)
                            ? 'bg-primary/20 border-2 border-primary'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="rounded"
                        />
                        <Avatar size="sm" src={user.profilePhotoUrl || user.profile_photo_url} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user.name || user.mobile}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {user.mobile}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                
                {searchQuery && !isLoadingUsers && filteredUsers.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                    No users found or all users are already members
                  </p>
                )}
                
                {!searchQuery && !isLoadingUsers && filteredUsers.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                    Start typing to search for users
                  </p>
                )}
                
                <div className="flex gap-2">
                  <button
                    onClick={handleAddMembers}
                    disabled={selectedUserIds.length === 0 || addMembersMutation.isLoading}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {addMembersMutation.isLoading ? 'Adding...' : `Add ${selectedUserIds.length} Member(s)`}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMembers(false);
                      setSearchQuery('');
                      setSelectedUserIds([]);
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="flex flex-wrap gap-2">
              {groupMembers.length > 0 ? (
                groupMembers.map((member: any) => {
                  const memberId = member.id || member.userId;
                  const isCurrentUser = memberId === currentUserId;
                  return (
                    <div
                      key={memberId}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        isCurrentUser
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      {member.profile_photo_url || member.profilePhotoUrl ? (
                        <img
                          src={member.profile_photo_url || member.profilePhotoUrl}
                          alt={member.name || member.userName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                          {(member.name || member.userName || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.name || member.userName || 'Unknown'}
                        {isCurrentUser && ' (You)'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No members found</p>
              )}
            </div>
          </div>

          {/* Exit Group Button - Visible to all members */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleExitGroup}
              disabled={exitGroupMutation.isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium text-sm disabled:opacity-50"
            >
              <span className="material-icons-outlined text-base">exit_to_app</span>
              {exitGroupMutation.isLoading ? 'Exiting...' : 'Exit Group'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
