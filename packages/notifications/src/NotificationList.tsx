import { formatInstant } from '@skeleton/time'
import { Badge, Button, EmptyState } from '@skeleton/ui'
import type { MouseEvent, ReactNode } from 'react'
import { isAppLink } from './link'
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
  /** 줄의 제목 · 내용을 앱이 다시 정한다(서버가 보낸 글 대신 번역 · 종류별 문구). 안 준 칸은 서버 글 그대로 */
  describe?: (item: NotificationItem) => { title?: ReactNode; message?: ReactNode }
  /**
   * 있고 `item.link` 가 앱 안 경로(`/` 로 시작, `//` 아님)이면 제목이 `<a href>` 가 된다. 눌렀을 때 기본 이동을 막고 이 함수를 부른다
   * (앱이 라우터로 이동). 새 탭 · 키 조합 클릭은 브라우저에 맡긴다
   */
  onOpen?: (item: NotificationItem) => void
  /** 묶인 줄(`collapsedCount > 1`)의 수 배지를 낭독하는 말(기본 `N notifications`) */
  collapsedLabel?: (count: number) => string
}

const defaultCollapsedLabel = (count: number) => `${count} notifications`

function plainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
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
  describe,
  onOpen,
  collapsedLabel = defaultCollapsedLabel,
}: NotificationListProps) {
  if (items.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const unread = item.readAt === null
        const described = describe?.(item)
        const heading: ReactNode = described?.title ?? item.title ?? item.type
        const message = described?.message ?? item.message
        const readName = typeof heading === 'string' ? heading : (item.title ?? item.type)
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
                {onOpen && isAppLink(item.link) ? (
                  <a
                    className={styles.link}
                    href={item.link}
                    onClick={(event) => {
                      if (!plainClick(event)) return
                      event.preventDefault()
                      onOpen(item)
                    }}
                  >
                    {heading}
                  </a>
                ) : (
                  heading
                )}
                {item.collapsedCount > 1 && (
                  <Badge tone="info" className={styles.count}>
                    <span aria-hidden="true">{item.collapsedCount}</span>
                    <span className={styles.srOnly}>{collapsedLabel(item.collapsedCount)}</span>
                  </Badge>
                )}
              </strong>
              {message && <p className={styles.message}>{message}</p>}
              <time className={styles.time} dateTime={item.createdAt}>
                {formatTime(item.createdAt)}
              </time>
            </div>
            {unread && onRead && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${markReadLabel}: ${readName}`}
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
