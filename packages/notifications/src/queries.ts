import type { NotificationsApi } from './notificationsApi'
import type { NotificationListParams } from './types'

/** 키는 층층이: `all` ⊃ `lists()` ⊃ `list(params)`, 안 읽은 수는 따로 — 무효화 · 캐시 패치가 이 접두어로 한다 */
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationListParams = {}) => [...notificationKeys.lists(), params] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
}

export function notificationListQuery(api: NotificationsApi, params: NotificationListParams = {}) {
  return {
    queryKey: notificationKeys.list(params),
    queryFn: () => api.list(params),
  }
}

/** 안 읽은 수 = 안 읽은 것만 1건 달라고 해서 `pagination.totalElements` — 백엔드에 전용 엔드포인트가 없다 */
export function unreadCountQuery(api: NotificationsApi) {
  return {
    queryKey: notificationKeys.unread(),
    queryFn: async () => (await api.list({ unreadOnly: true, size: 1 })).pagination.totalElements,
  }
}
