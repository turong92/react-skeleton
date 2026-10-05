import {
  NotificationBell,
  NotificationList,
  useNotificationIngest,
  useNotifications,
  useUnreadCount,
} from '@skeleton/notifications'
import { Button } from '@skeleton/ui'
import { useState } from 'react'
import { Case, Row } from '../components/Section'
import { useRuntime } from '../runtime'

/** 가짜 받은편지함 + 가짜 실시간 이벤트 — 실제로는 `@skeleton/realtime` 훅의 `onEvent` 에 `ingest` 를 건다 */
export function NotificationsDemo() {
  const { inbox } = useRuntime()
  const unread = useUnreadCount(inbox.api).data ?? 0
  const list = useNotifications(inbox.api, { page: 0, size: 5 })
  const ingest = useNotificationIngest()
  const [count, setCount] = useState(0)
  return (
    <>
      <Case label="bell (opens an inbox dialog)">
        <Row>
          <NotificationBell api={inbox.api} />
          <span>
            안 읽은 수: <strong>{unread}</strong>
          </span>
        </Row>
      </Case>
      <Case label="fake realtime event → ingest()">
        <Button
          variant="secondary"
          onClick={() => {
            setCount((n) => n + 1)
            ingest(inbox.publish(`실시간 알림 #${count + 1}`))
          }}
        >
          실시간 이벤트 보내기
        </Button>
      </Case>
      <Case label="NotificationList">
        <NotificationList items={list.data?.values ?? []} />
      </Case>
    </>
  )
}
