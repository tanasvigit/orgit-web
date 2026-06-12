import { timestampToMs } from './chatTime';
import {
  getTaskDashboardBumpMs,
  type TaskActivityBumpMap,
} from './taskDashboardActivity';

export function getConversationRecentActivityMs(
  conv: any,
  task?: any,
  activityBumpMap?: TaskActivityBumpMap
): number {
  const fromConv =
    conv?.lastMessageTime ??
    conv?.last_message_time ??
    conv?.lastMessage?.created_at ??
    conv?.lastMessage?.createdAt ??
    conv?.last_message?.created_at ??
    conv?.updatedAt;
  const fromTask =
    task?.last_message_time ??
    task?.lastMessageTime ??
    task?.updated_at ??
    task?.updatedAt;
  const convId = conv?.id ?? conv?.conversationId;
  const taskId = task?.id;
  const bumpMs = getTaskDashboardBumpMs(activityBumpMap, {
    taskId,
    conversationId: convId,
  });
  return Math.max(
    timestampToMs(fromConv, 0),
    timestampToMs(fromTask, 0),
    timestampToMs(task?.created_at ?? task?.createdAt, 0),
    bumpMs
  );
}

export function getTaskRecentActivityMs(
  task: any,
  activityBumpMap?: TaskActivityBumpMap
): number {
  const fromMsg =
    task?.last_message_time ??
    task?.lastMessageTime ??
    task?.lastMessage?.created_at ??
    task?.lastMessage?.createdAt;
  const fromUpdate = task?.updated_at ?? task?.updatedAt;
  const bumpMs = getTaskDashboardBumpMs(activityBumpMap, {
    taskId: task?.id,
    conversationId: task?.conversation_id ?? task?.conversationId,
  });
  return Math.max(
    timestampToMs(fromMsg, 0),
    timestampToMs(fromUpdate, 0),
    timestampToMs(task?.created_at ?? task?.createdAt, 0),
    bumpMs
  );
}

export function isConversationPinned(conv: any): boolean {
  return !!(conv?.isPinned || conv?.is_pinned);
}

export function compareByPinnedThenRecentActivity(
  a: { pinned?: boolean; activityMs: number },
  b: { pinned?: boolean; activityMs: number }
): number {
  const aPinned = !!a.pinned;
  const bPinned = !!b.pinned;
  if (aPinned && !bPinned) return -1;
  if (!aPinned && bPinned) return 1;
  return b.activityMs - a.activityMs;
}

export function sortConversationsByRecentActivity(
  conversations: any[],
  taskByConvId?: Record<string, any>,
  activityBumpMap?: TaskActivityBumpMap
): any[] {
  return [...conversations].sort((a, b) => {
    const aKey = String(a?.id ?? a?.conversationId ?? '');
    const bKey = String(b?.id ?? b?.conversationId ?? '');
    return compareByPinnedThenRecentActivity(
      {
        pinned: isConversationPinned(a),
        activityMs: getConversationRecentActivityMs(a, taskByConvId?.[aKey], activityBumpMap),
      },
      {
        pinned: isConversationPinned(b),
        activityMs: getConversationRecentActivityMs(b, taskByConvId?.[bKey], activityBumpMap),
      }
    );
  });
}

export type TaskDashboardCardEntry =
  | { kind: 'group'; conv: any; task?: any }
  | { kind: 'direct'; task: any };

export function getTaskDashboardCardActivityMs(
  entry: TaskDashboardCardEntry,
  activityBumpMap?: TaskActivityBumpMap
): number {
  if (entry.kind === 'group') {
    return getConversationRecentActivityMs(entry.conv, entry.task, activityBumpMap);
  }
  return getTaskRecentActivityMs(entry.task, activityBumpMap);
}

export function isTaskDashboardCardPinned(entry: TaskDashboardCardEntry): boolean {
  return entry.kind === 'group' && isConversationPinned(entry.conv);
}

export function sortTaskDashboardCards(
  entries: TaskDashboardCardEntry[],
  activityBumpMap?: TaskActivityBumpMap
): TaskDashboardCardEntry[] {
  return [...entries].sort((a, b) =>
    compareByPinnedThenRecentActivity(
      {
        pinned: isTaskDashboardCardPinned(a),
        activityMs: getTaskDashboardCardActivityMs(a, activityBumpMap),
      },
      {
        pinned: isTaskDashboardCardPinned(b),
        activityMs: getTaskDashboardCardActivityMs(b, activityBumpMap),
      }
    )
  );
}
