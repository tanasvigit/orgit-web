import { normalizeConvId } from './notificationConvId';

export function sumUnreadMap(map: Record<string, number>): number {
  return Object.values(map || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

export function mergeTaskUnreadMaps(
  prev: Record<string, number>,
  api: Record<string, number>,
  clearedSet: Set<string>,
  optimisticDelta: Record<string, number>,
  lastApiUnread: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = {};
  const allKeys = new Set([
    ...Object.keys(api || {}).map((id) => normalizeConvId(id)),
    ...Object.keys(prev || {}),
    ...Object.keys(optimisticDelta || {}).filter((k) => (optimisticDelta[k] || 0) > 0),
  ]);

  for (const key of allKeys) {
    if (!key) continue;

    const apiCount = Number(api?.[key] ?? 0);
    const lastApi = Number(lastApiUnread[key] || 0);

    if (apiCount > lastApi) {
      const absorbed = apiCount - lastApi;
      optimisticDelta[key] = Math.max(0, (optimisticDelta[key] || 0) - absorbed);
    }
    lastApiUnread[key] = apiCount;

    const pendingDelta = optimisticDelta[key] || 0;
    if (clearedSet.has(key) && pendingDelta <= 0) {
      merged[key] = 0;
      optimisticDelta[key] = 0;
      if (apiCount === 0) {
        clearedSet.delete(key);
      }
    } else {
      if (pendingDelta > 0) {
        clearedSet.delete(key);
      }
      merged[key] = apiCount + pendingDelta;
    }
  }

  return merged;
}

export function mergeChatCount(
  apiCount: number,
  optimisticDelta: number,
  lastApiCount: number
): { display: number; delta: number; lastApi: number } {
  const api = Number(apiCount) || 0;
  const lastApi = Number(lastApiCount) || 0;
  let delta = Number(optimisticDelta) || 0;

  if (api > lastApi) {
    delta = Math.max(0, delta - (api - lastApi));
  }

  return { display: api + delta, delta, lastApi: api };
}
