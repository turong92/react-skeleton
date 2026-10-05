import type { NotificationsApi } from '../notificationsApi'
import type { NotificationItem } from '../types'

const at = (minutesAgo: number) => new Date(Date.UTC(2026, 0, 1, 12, 0) - minutesAgo * 60_000)

const item = (n: number, title: string, read: boolean): NotificationItem => ({
  id: `demo:e${n}`,
  eventId: `e${n}`,
  recipientId: 'demo',
  topic: 'demo',
  type: 'demo.created',
  severity: n % 2 === 0 ? 'SUCCESS' : 'INFO',
  title,
  message: `${title} 메시지`,
  payload: {},
  createdAt: at(n * 10).toISOString(),
  readAt: read ? at(n).toISOString() : null,
})

/** 메모리 안의 받은편지함(`empty` 면 빈 상태로 시작) — `publish()` 가 서버가 실시간으로 보낼 이벤트를 흉내 낸다 */
export function createFakeInbox({ empty = false }: { empty?: boolean } = {}) {
  let rows: NotificationItem[] = empty
    ? []
    : [
        item(3, '결제가 승인되었습니다', true),
        item(2, '새 댓글이 달렸습니다', false),
        item(1, '환영합니다', false),
      ]
  let counter = 100
  const api: NotificationsApi = {
    list: async ({ page = 0, size = 10, unreadOnly = false } = {}) => {
      const matching = rows.filter((row) => !unreadOnly || row.readAt === null)
      return {
        values: matching.slice(page * size, (page + 1) * size),
        pagination: {
          page,
          size,
          totalElements: matching.length,
          totalPages: Math.ceil(matching.length / size),
          hasNext: (page + 1) * size < matching.length,
          hasPrevious: page > 0,
        },
        meta: { timestamp: '2026-01-01T12:00:00Z' },
      }
    },
    markRead: async (eventId) => {
      const readAt = new Date().toISOString()
      rows = rows.map((row) => (row.eventId === eventId ? { ...row, readAt } : row))
      return { eventId, readAt }
    },
    markAllRead: async () => {
      const unread = rows.filter((row) => row.readAt === null).length
      const readAt = new Date().toISOString()
      rows = rows.map((row) => ({ ...row, readAt: row.readAt ?? readAt }))
      return { updated: unread }
    },
  }
  return {
    api,
    /** 받은편지함에 줄을 더하고, 실시간으로 올 이벤트 본문(`NotificationEvent` 모양)을 돌려준다 */
    publish(title: string) {
      counter += 1
      const row = { ...item(counter, title, false), createdAt: new Date().toISOString() }
      rows = [row, ...rows]
      return {
        id: row.eventId,
        topic: row.topic,
        type: row.type,
        severity: row.severity,
        title: row.title,
        message: row.message,
        payload: {},
        createdAt: row.createdAt,
      }
    },
  }
}
