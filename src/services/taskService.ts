import api from './api';
import { setTaskFinancial } from '../utils/taskFinancialStorage';
import { Task, TaskType, TaskCategory, TaskFrequency } from '../../../shared/src/types';

// Keep last successful tasks response in-memory so that
// GET /tasks returning 304 or an empty payload does not wipe
// the dashboard list. This mirrors the mobile "keep existing tasks"
// behavior for cache-friendly responses.
let lastTasksSnapshot: any[] | null = null;

function ingestTaskFinancial(task: any) {
  if (!task?.id) return;
  const hasValue = task.financial_value != null;
  const hasType = !!task.finance_type;
  if (hasValue || hasType) {
    setTaskFinancial(task.id, {
      financial_value: task.financial_value ?? null,
      finance_type: task.finance_type ?? null,
      source: 'mobile',
    });
  }
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  taskType: TaskType;
  startDate?: string;
  targetDate?: string;
  dueDate?: string;
  frequency?: TaskFrequency;
  specificWeekday?: number;
  category?: TaskCategory;
  assignedUserIds: string[];
  complianceId?: string;
}

export const taskService = {
  createTask: async (data: any) => {
    // Mobile format: task_type, assignee_ids, start_date, target_date, due_date, recurrence_type, auto_escalate
    // Note: api baseURL already includes /api, so use /tasks not /api/tasks
    const response = await api.post('/tasks', data);
    // Backend returns: { success: true, data: task } or { task: ... }
    return response.data.success ? response.data.data : response.data.task || response.data;
  },

  getTasks: async (filters?: {
    status?: string;
    category?: string;
    type?: string; // Mobile uses 'type', not 'taskType'
  }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.type) params.append('type', filters.type); // Mobile uses 'type'

    // Note: api baseURL already includes /api, so use /tasks not /api/tasks
    const response = await api.get(`/tasks?${params.toString()}`, {
      // Allow 304 to be treated as success so we can keep existing tasks
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // If backend returns 304 Not Modified, keep using the last successful snapshot.
    if (response.status === 304) {
      return lastTasksSnapshot || [];
    }

    // Backend returns: { tasks: [...] } or { data: [...] }
    const tasks = response.data?.tasks ?? response.data?.data ?? [];

    // If response payload is empty / missing, also keep prior snapshot.
    if (!tasks || (Array.isArray(tasks) && tasks.length === 0)) {
      return lastTasksSnapshot || [];
    }

    if (Array.isArray(tasks)) {
      tasks.forEach(ingestTaskFinancial);
      // Update snapshot only on a non-empty successful payload.
      lastTasksSnapshot = tasks;
    }

    return tasks;
  },

  getTask: async (taskId: string) => {
    // Note: api baseURL already includes /api, so use /tasks not /api/tasks
    const response = await api.get(`/tasks/${taskId}`);
    // Backend returns: { task: {...} } - extract the task object
    const task = response.data.task || response.data;
    ingestTaskFinancial(task);
    return task;
  },

  getTaskAssignments: async (taskId: string) => {
    const response = await api.get(`/tasks/${taskId}/assignments`);
    return response.data;
  },

  acceptTask: async (taskId: string) => {
    // Note: api baseURL already includes /api, so use /tasks not /api/tasks
    const response = await api.post(`/tasks/${taskId}/accept`);
    return response.data;
  },

  rejectTask: async (taskId: string, reason: string) => {
    // Mobile uses 'reason', not 'rejectionReason'
    // Note: api baseURL already includes /api, so use /tasks not /api/tasks
    const response = await api.post(`/tasks/${taskId}/reject`, { reason });
    return response.data;
  },

  completeTask: async (taskId: string) => {
    const response = await api.post(`/tasks/${taskId}/complete`);
    return response.data;
  },

  updateTask: async (taskId: string, updates: Partial<CreateTaskRequest>) => {
    const response = await api.patch(`/tasks/${taskId}`, updates);
    return response.data;
  },

  updateTaskStatus: async (taskId: string, status: string) => {
    try {
      const response = await api.patch(`/tasks/${taskId}/status`, { status });
      // Backend returns: { task: {...} } or { success: true, task: {...} }
      return response.data.task || response.data.data || response.data;
    } catch (error: any) {
      console.error('Update task status error:', error);
      // Re-throw with more details
      throw error;
    }
  },

  // Delete a task (web-only helper, uses existing API route)
  deleteTask: async (taskId: string) => {
    const response = await api.delete(`/tasks/${taskId}`);
    return response.data;
  },

  getMentionableTasks: async () => {
    const response = await api.get('/tasks/mentionable');
    return response.data;
  },

  // Compliance linking
  linkComplianceToTask: async (taskId: string, complianceId: string) => {
    const response = await api.post(`/tasks/${taskId}/compliance`, { complianceId });
    return response.data;
  },

  unlinkComplianceFromTask: async (taskId: string, complianceId: string) => {
    const response = await api.delete(`/tasks/${taskId}/compliance/${complianceId}`);
    return response.data;
  },

  getTaskCompliances: async (taskId: string) => {
    const response = await api.get(`/tasks/${taskId}/compliance`);
    return response.data;
  },

  /**
   * Mark the current user's task assignment as completed.
   * Mirrors the mobile implementation:
   * POST /tasks/:taskId/members/:userId/complete
   */
  markMemberComplete: async (taskId: string, userId: string) => {
    const response = await api.post(`/tasks/${taskId}/members/${userId}/complete`);
    return response.data;
  },

  /**
   * Verify another member's completion for a task.
   * Mirrors the mobile implementation:
   * POST /tasks/:taskId/members/:userId/verify
   */
  verifyMemberCompletion: async (taskId: string, userId: string) => {
    const response = await api.post(`/tasks/${taskId}/members/${userId}/verify`);
    return response.data;
  },

  /**
   * Reassign a member's task back into TODO state.
   * Mirrors the mobile implementation:
   * POST /tasks/:taskId/members/:userId/reassign
   */
  reassignMember: async (taskId: string, userId: string) => {
    const response = await api.post(`/tasks/${taskId}/members/${userId}/reassign`);
    return response.data;
  },

  /**
   * Add assignees to an existing task.
   * Mirrors the mobile / backend implementation:
   * POST /tasks/:taskId/assignees
   *
   * NOTE: This is separate from adding members to the conversation.
   * New assignees will join the task group conversation only when they accept the task.
   */
  addTaskAssignees: async (taskId: string, assigneeIds: string[]) => {
    const response = await api.post(`/tasks/${taskId}/assignees`, {
      assignee_ids: assigneeIds,
    });
    return response.data;
  },
};

