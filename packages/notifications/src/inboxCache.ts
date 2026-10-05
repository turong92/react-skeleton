import type { ApiPageResponse } from '@skeleton/api-client'
import type { QueryClient } from '@tanstack/react-query'
import { notificationKeys } from './queries'
import {
  NOTIFICATION_SEVERITIES,
  type NotificationEvent,
  type NotificationItem,
  type NotificationSeverity,
} from './types'

type ItemsPage = ApiPageResponse<NotificationItem>

function patchLists(client: QueryClient, patch: (item: NotificationItem) => NotificationItem) {
  for (const [key, data] of client.getQueriesData<ItemsPage>({
    queryKey: notificationKeys.lists(),
  })) {
    if (!data) continue
    const values = data.values.map(patch)
    if (values.some((value, index) => value !== data.values[index]))
      client.setQueryData<ItemsPage>(key, { ...data, values })
  }
}

/**
 * 한 건을 읽음 처리한 뒤의 캐시 — 캐시된 모든 목록에서 그 줄에 `readAt` 을 찍고, 안 읽은 수는 (그 줄이 안 읽음이었으면) 1 줄인다.
 * 어느 목록에도 그 줄이 없으면 수를 알 수 없어 다시 가져오게 한다. 서버 쪽 보기(unreadOnly · 페이지)는 무효화해 다시 가져온다.
 */
export function applyRead(client: QueryClient, eventId: string, readAt: string) {
  let found = false
  let wasUnread = false
  patchLists(client, (item) => {
    if (item.eventId !== eventId) return item
    found = true
    if (item.readAt !== null) return item
    wasUnread = true
    return { ...item, readAt }
  })
  if (wasUnread) {
    client.setQueryData<number>(notificationKeys.unread(), (count) =>
      count === undefined ? count : Math.max(0, count - 1),
    )
  } else if (!found) {
    void client.invalidateQueries({ queryKey: notificationKeys.unread() })
  }
  void client.invalidateQueries({ queryKey: notificationKeys.lists() })
}

/** 모두 읽음 뒤의 캐시 — 안 읽은 줄은 전부 읽음, 수는 0 */
export function applyReadAll(client: QueryClient, readAt: string) {
  patchLists(client, (item) => (item.readAt === null ? { ...item, readAt } : item))
  client.setQueryData<number>(notificationKeys.unread(), (count) =>
    count === undefined ? count : 0,
  )
  void client.invalidateQueries({ queryKey: notificationKeys.lists() })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown) => (typeof value === 'string' ? value : null)

/**
 * `@skeleton/realtime` 이 넘겨주는 값(SSE `event.data` · STOMP `message.value`, 객체 또는 JSON 글자)을 알림 이벤트로.
 * 알림이 아닌 것(SSE 의 `connected` 이벤트 등 `id` · `topic` · `type` 이 없는 것)은 `null`.
 */
export function parseNotificationEvent(raw: unknown): NotificationEvent | null {
  let value = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!isRecord(value)) return null
  const { id, topic, type } = value
  if (typeof id !== 'string' || typeof topic !== 'string' || typeof type !== 'string') return null
  const severity = NOTIFICATION_SEVERITIES.includes(value.severity as NotificationSeverity)
    ? (value.severity as NotificationSeverity)
    : 'INFO'
  return {
    id,
    topic,
    type,
    severity,
    title: text(value.title),
    message: text(value.message),
    payload: isRecord(value.payload) ? value.payload : {},
    createdAt: text(value.createdAt),
  }
}

export type InboxSyncOptions = {
  /** 새 알림(처음 보는 id)이 들어올 때 — 토스트 · 소리 등 */
  onNotification?: (event: NotificationEvent) => void
  /** 중복을 막으려 기억하는 id 수(기본 500) */
  rememberIds?: number
}

export type InboxSync = {
  /** 실시간 페이로드를 받는다. 새 알림이면 true — 안 읽은 수(캐시가 있으면) +1, 목록 무효화 */
  ingest(payload: unknown): boolean
}

/** 실시간 이벤트 → 받은편지함 캐시. 재연결이 같은 이벤트를 다시 보내도 한 번만 센다 */
export function createInboxSync(
  client: QueryClient,
  { onNotification, rememberIds = 500 }: InboxSyncOptions = {},
): InboxSync {
  const seen = new Set<string>()
  return {
    ingest(payload) {
      const event = parseNotificationEvent(payload)
      if (!event || seen.has(event.id)) return false
      seen.add(event.id)
      if (seen.size > rememberIds) seen.delete(seen.values().next().value as string)
      client.setQueryData<number>(notificationKeys.unread(), (count) =>
        count === undefined ? count : count + 1,
      )
      void client.invalidateQueries({ queryKey: notificationKeys.lists() })
      onNotification?.(event)
      return true
    },
  }
}
