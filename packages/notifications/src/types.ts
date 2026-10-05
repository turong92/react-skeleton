/** 백엔드 `NotificationSeverity`(modules/notification) */
export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'

export const NOTIFICATION_SEVERITIES: readonly NotificationSeverity[] = [
  'INFO',
  'SUCCESS',
  'WARNING',
  'ERROR',
]

/**
 * 받은편지함 한 줄 — 백엔드 `NotificationInboxItemResponse`(apps/workbench `NotificationInboxController`).
 * `Instant` 는 ISO 문자열, `readAt` 이 null 이면 안 읽음.
 */
export type NotificationItem = {
  /** `{recipientId}:{eventId}` */
  id: string
  eventId: string
  recipientId: string
  topic: string
  type: string
  severity: NotificationSeverity
  title: string | null
  message: string | null
  payload: Record<string, unknown>
  createdAt: string
  readAt: string | null
}

/** `PATCH …/{eventId}/read` 응답 — 백엔드 `NotificationReadResponse` */
export type NotificationReadResponse = { eventId: string; readAt: string }

/** `PATCH …/read-all` 응답 — 백엔드 `NotificationReadAllResponse` */
export type NotificationReadAllResponse = { updated: number }

/** 목록 쿼리 — 백엔드 `PageQuery`(page 0 부터, size 1..100) + `unreadOnly` · `topic` */
export type NotificationListParams = {
  page?: number
  size?: number
  unreadOnly?: boolean
  topic?: string
}

/**
 * 실시간으로 오는 이벤트 — 백엔드 `NotificationEvent`(modules/notification). SSE 의 `event.data`,
 * STOMP 의 `message.value` 가 이 모양이다(받은편지함 줄이 아니라 이벤트 자체).
 */
export type NotificationEvent = {
  id: string
  topic: string
  type: string
  severity: NotificationSeverity
  title: string | null
  message: string | null
  payload: Record<string, unknown>
  createdAt: string | null
}
