import type { NotificationsApi } from './notificationsApi'
import type { NotificationListParams } from './types'

/** 키는 층층이: `all` ⊃ `lists()` ⊃ `list(params)`, 안 읽은 수는 따로 — 무효화 · 캐시 패치가 이 접두어로 한다 */
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationListParams = {}) => [...notificationKeys.lists(), params] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
  /** 수신 설정 저장 mutation 의 키 — 진행 중인 저장을 `useMutationState` 로 본다 */
  setPreference: () => [...notificationKeys.all, 'preferences', 'set'] as const,
}

export function notificationListQuery(api: NotificationsApi, params: NotificationListParams = {}) {
  return {
    queryKey: notificationKeys.list(params),
    queryFn: () => api.list(params),
  }
}

/** 안 읽은 수 = 백엔드의 전용 엔드포인트(`GET …/unread-count`)의 `count` */
export function unreadCountQuery(api: NotificationsApi) {
  return {
    queryKey: notificationKeys.unread(),
    queryFn: async () => (await api.unreadCount()).count,
  }
}

/** 종류별 수신 설정(서버가 정한 순서 그대로) */
export function preferencesQuery(api: NotificationsApi) {
  return {
    queryKey: notificationKeys.preferences(),
    queryFn: () => api.preferences(),
  }
}
