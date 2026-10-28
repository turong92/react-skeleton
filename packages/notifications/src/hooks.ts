import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { applyRead, applyReadAll, createInboxSync, type InboxSyncOptions } from './inboxCache'
import type { NotificationsApi } from './notificationsApi'
import {
  notificationKeys,
  notificationListQuery,
  preferencesQuery,
  unreadCountQuery,
} from './queries'
import type { NotificationListParams, NotificationPreference } from './types'

/** 받은편지함 한 쪽. 쪽을 넘길 때 이전 쪽을 보여 주며(깜빡임 없이) 새로 가져온다. `enabled: false` 면 가져오지 않는다 */
export function useNotifications(
  api: NotificationsApi,
  params: NotificationListParams = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    ...notificationListQuery(api, params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** 안 읽은 수(`data` 는 숫자). 실시간으로 갱신하려면 `useNotificationIngest` 를 SSE/STOMP 에 건다 */
export function useUnreadCount(api: NotificationsApi) {
  return useQuery(unreadCountQuery(api))
}

/** 한 건 읽음 — 성공하면 캐시를 바로 고친다. 에러 표시는 QueryClient 의 전역 핸들러가 한다 */
export function useMarkRead(api: NotificationsApi) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (eventId: string) => api.markRead(eventId),
    onSuccess: ({ eventId, readAt }) => applyRead(client, eventId, readAt),
  })
}

/** 모두 읽음 */
export function useMarkAllRead(api: NotificationsApi) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => api.markAllRead(),
    onSuccess: () => applyReadAll(client, new Date().toISOString()),
  })
}

/** 종류별 수신 설정 목록(`data.items`) */
export function usePreferences(api: NotificationsApi) {
  return useQuery(preferencesQuery(api))
}

/** 한 종류를 끄거나 켠다 — 성공하면 서버가 돌려준 값으로 캐시를 고친다 */
export function useSetPreference(api: NotificationsApi) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: notificationKeys.setPreference(),
    mutationFn: ({ type, muted }: NotificationPreference) => api.setPreference(type, muted),
    onSuccess: (saved) =>
      client.setQueryData<{ items: NotificationPreference[] }>(
        notificationKeys.preferences(),
        (data) =>
          data && {
            ...data,
            items: data.items.map((item) => (item.type === saved.type ? saved : item)),
          },
      ),
  })
}

/**
 * 실시간 이벤트를 받은편지함 캐시에 넣는 함수 — `@skeleton/realtime` 에 건다:
 * `useSseClient({ onEvent: (e) => ingest(e.data) })` · `useNotificationSocket({ onMessage: (m) => ingest(m.value) })`.
 * 옵션은 처음 값으로 고정된다.
 */
export function useNotificationIngest(options?: InboxSyncOptions): (payload: unknown) => boolean {
  const client = useQueryClient()
  const [sync] = useState(() => createInboxSync(client, options))
  return sync.ingest
}
