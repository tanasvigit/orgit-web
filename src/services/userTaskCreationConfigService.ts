import api from './api';
import { mergeTaskCreationUserConfig, type TaskCreationUserConfig } from '../utils/taskCreationUserConfig';

export const taskCreationUserConfigQueryKey = ['task-creation-user-config'] as const;

export async function getTaskCreationUserConfig(): Promise<TaskCreationUserConfig> {
  const res = await api.get<{ success?: boolean; data?: TaskCreationUserConfig }>(
    '/auth/task-creation-user-config'
  );
  const data = res.data?.data;
  if (data && typeof data.dueDaysFromStart === 'number') {
    return mergeTaskCreationUserConfig(data);
  }
  throw new Error('Invalid task creation config response');
}

export async function updateTaskCreationUserConfig(
  payload: TaskCreationUserConfig
): Promise<TaskCreationUserConfig> {
  const res = await api.put<{ success?: boolean; data?: TaskCreationUserConfig }>(
    '/auth/task-creation-user-config',
    payload
  );
  const data = res.data?.data;
  if (data && typeof data.dueDaysFromStart === 'number') {
    return mergeTaskCreationUserConfig(data);
  }
  throw new Error('Invalid task creation config response');
}
