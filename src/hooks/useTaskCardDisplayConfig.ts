import { useQuery } from 'react-query';
import { getTaskCreationUserConfig, taskCreationUserConfigQueryKey } from '../services/userTaskCreationConfigService';
import {
  DEFAULT_TASK_CARD_DISPLAY,
  mergeTaskCardDisplayConfig,
  type TaskCardDisplayConfig,
} from '../utils/taskCardDisplayConfig';

export function useTaskCardDisplayConfig(): TaskCardDisplayConfig {
  const { data } = useQuery(taskCreationUserConfigQueryKey, getTaskCreationUserConfig, {
    staleTime: 60_000,
    retry: 1,
  });
  return mergeTaskCardDisplayConfig(data?.taskCardDisplay ?? DEFAULT_TASK_CARD_DISPLAY);
}
