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
  /** 앱 안 상대 경로(`/` 로 시작, `//` 아님) 또는 null — 서버가 정하고 클라이언트도 다시 확인한다 */
  link: string | null
  /** 같은 열쇠로 묶인 알림 수(1 = 묶이지 않음) */
  collapsedCount: number
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
  /** 앱 안 상대 경로 또는 null(받는 쪽이 한 번 더 확인해 아니면 null 로 만든다) */
  link: string | null
  /** 있으면 서버가 안 읽은 같은 열쇠의 줄에 접을 수 있다 — 안 읽은 수가 +1 이 아닐 수 있다 */
  collapseKey: string | null
}

/** 종류별 수신 설정 한 줄 — `muted` 면 그 종류의 알림이 받은편지함에 쌓이지 않는다 */
export type NotificationPreference = { type: string; muted: boolean }
