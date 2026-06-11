import { timestampToMs } from './chatTime';

export function getConversationRecentActivityMs(conv: any, task?: any): number {
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
  return Math.max(
    timestampToMs(fromConv, 0),
    timestampToMs(fromTask, 0),
    timestampToMs(task?.created_at ?? task?.createdAt, 0)
  );
}

export function getTaskRecentActivityMs(task: any): number {
  const fromMsg =
    task?.last_message_time ??
    task?.lastMessageTime ??
    task?.lastMessage?.created_at ??
    task?.lastMessage?.createdAt;
  const fromUpdate = task?.updated_at ?? task?.updatedAt;
  return Math.max(
    timestampToMs(fromMsg, 0),
    timestampToMs(fromUpdate, 0),
    timestampToMs(task?.created_at ?? task?.createdAt, 0)
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
  taskByConvId?: Record<string, any>
): any[] {
  return [...conversations].sort((a, b) => {
    const aKey = String(a?.id ?? a?.conversationId ?? '');
    const bKey = String(b?.id ?? b?.conversationId ?? '');
    return compareByPinnedThenRecentActivity(
      {
        pinned: isConversationPinned(a),
        activityMs: getConversationRecentActivityMs(a, taskByConvId?.[aKey]),
      },
      {
        pinned: isConversationPinned(b),
        activityMs: getConversationRecentActivityMs(b, taskByConvId?.[bKey]),
      }
    );
  });
}

export type TaskDashboardCardEntry =
  | { kind: 'group'; conv: any; task?: any }
  | { kind: 'direct'; task: any };

export function getTaskDashboardCardActivityMs(entry: TaskDashboardCardEntry): number {
  if (entry.kind === 'group') {
    return getConversationRecentActivityMs(entry.conv, entry.task);
  }
  return getTaskRecentActivityMs(entry.task);
}

export function isTaskDashboardCardPinned(entry: TaskDashboardCardEntry): boolean {
  return entry.kind === 'group' && isConversationPinned(entry.conv);
}

export function sortTaskDashboardCards(entries: TaskDashboardCardEntry[]): TaskDashboardCardEntry[] {
  return [...entries].sort((a, b) =>
    compareByPinnedThenRecentActivity(
      {
        pinned: isTaskDashboardCardPinned(a),
        activityMs: getTaskDashboardCardActivityMs(a),
      },
      {
        pinned: isTaskDashboardCardPinned(b),
        activityMs: getTaskDashboardCardActivityMs(b),
      }
    )
  );
}
