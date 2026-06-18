import { taskService } from '../services/taskService';
import { getTaskUserActionFlags } from './taskDashboardUserActions';

export type BulkActionRunResult = {
  succeeded: number;
  failed: number;
  errors: string[];
};

async function runPerTask(
  tasks: any[],
  runner: (task: any) => Promise<void>
): Promise<BulkActionRunResult> {
  const result: BulkActionRunResult = { succeeded: 0, failed: 0, errors: [] };
  for (const task of tasks) {
    try {
      await runner(task);
      result.succeeded += 1;
    } catch (error: any) {
      result.failed += 1;
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        'Unknown error';
      result.errors.push(`${task.title || task.id}: ${msg}`);
    }
  }
  return result;
}

export async function bulkMoveTasksToInProgress(
  tasks: any[],
  currentUserId: string,
  options?: { userRole?: string; dueSoonDays?: number }
): Promise<BulkActionRunResult> {
  const eligible = tasks.filter(
    (task) => getTaskUserActionFlags(task, currentUserId, options).canMoveToInProgress
  );
  return runPerTask(eligible, async (task) => {
    const flags = getTaskUserActionFlags(task, currentUserId, options);
    if (!flags.isCreator) {
      await taskService.acceptTask(String(task.id));
    }
    await taskService.updateTaskStatus(String(task.id), 'in_progress');
  });
}

export async function bulkMarkTasksComplete(
  tasks: any[],
  currentUserId: string,
  options?: { userRole?: string; dueSoonDays?: number }
): Promise<BulkActionRunResult> {
  const eligible = tasks.filter(
    (task) => getTaskUserActionFlags(task, currentUserId, options).canMarkComplete
  );
  return runPerTask(eligible, async (task) => {
    const flags = getTaskUserActionFlags(task, currentUserId, options);
    if (flags.isCreator) {
      await taskService.ownerCompleteTask(String(task.id));
    } else {
      await taskService.markMemberComplete(String(task.id), currentUserId);
    }
  });
}

export async function bulkRequestTaskDelete(
  tasks: any[],
  currentUserId: string,
  reason: string,
  options?: { userRole?: string; dueSoonDays?: number }
): Promise<BulkActionRunResult> {
  const eligible = tasks.filter(
    (task) => getTaskUserActionFlags(task, currentUserId, options).canRequestDelete
  );
  return runPerTask(eligible, async (task) => {
    await taskService.requestTaskDelete(String(task.id), reason);
  });
}

export async function bulkExitTasksWithComments(
  tasks: any[],
  currentUserId: string,
  comment: string,
  options?: { userRole?: string; dueSoonDays?: number }
): Promise<BulkActionRunResult> {
  const eligible = tasks.filter(
    (task) => getTaskUserActionFlags(task, currentUserId, options).canExitWithComments
  );
  return runPerTask(eligible, async (task) => {
    await taskService.createExitRequest(String(task.id), comment);
  });
}

export async function bulkDeleteTasks(
  tasks: any[],
  currentUserId: string,
  options?: { userRole?: string; dueSoonDays?: number }
): Promise<BulkActionRunResult> {
  const eligible = tasks.filter(
    (task) => getTaskUserActionFlags(task, currentUserId, options).canDeleteDirect
  );
  return runPerTask(eligible, async (task) => {
    await taskService.deleteTask(String(task.id));
  });
}

export function formatBulkActionSummary(result: BulkActionRunResult, actionLabel: string): string {
  if (result.failed === 0) {
    return `${actionLabel} applied to ${result.succeeded} task(s).`;
  }
  if (result.succeeded === 0) {
    return `${actionLabel} failed for all selected tasks.`;
  }
  return `${actionLabel}: ${result.succeeded} succeeded, ${result.failed} failed.`;
}
