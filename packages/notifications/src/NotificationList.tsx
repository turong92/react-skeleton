import { formatInstant } from '@skeleton/time'
import { Button, EmptyState } from '@skeleton/ui'
import type { NotificationItem, NotificationSeverity } from './types'
import styles from './NotificationList.module.css'

export type NotificationListProps = {
  items: readonly NotificationItem[]
  /** 있으면 안 읽은 줄에 읽음 버튼이 생긴다 */
  onRead?: (item: NotificationItem) => void
  /** 시각 글자(기본 `@skeleton/time` 의 `formatInstant`) */
  formatTime?: (iso: string) => string
  /** 읽음 버튼 이름(기본 `Mark as read`) */
  markReadLabel?: string
  emptyTitle?: string
  emptyDescription?: string
  /** 심각도를 낭독기에 말로 알린다(없으면 색 · data 속성뿐) */
  severityLabels?: Partial<Record<NotificationSeverity, string>>
}

/** 받은편지함 목록 — 보이기만 한다(데이터 · 호출은 모른다). 안 읽은 줄은 `data-unread="true"` */
export function NotificationList({
  items,
  onRead,
  formatTime = (iso) => formatInstant(iso),
  markReadLabel = 'Mark as read',
  emptyTitle = 'No notifications',
  emptyDescription,
  severityLabels,
}: NotificationListProps) {
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const unread = item.readAt === null
        const heading = item.title ?? item.type
        const severityLabel = severityLabels?.[item.severity]
        return (
          <li
            key={item.id}
            className={styles.item}
            data-unread={unread ? 'true' : undefined}
            data-severity={item.severity}
          >
            <div className={styles.body}>
              <strong className={styles.title}>
                {severityLabel && <span className={styles.srOnly}>{severityLabel}: </span>}
                {heading}
              </strong>
              {item.message && <p className={styles.message}>{item.message}</p>}
              <time className={styles.time} dateTime={item.createdAt}>
                {formatTime(item.createdAt)}
              </time>
            </div>
            {unread && onRead && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${markReadLabel}: ${heading}`}
                onClick={() => onRead(item)}
              >
                {markReadLabel}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
