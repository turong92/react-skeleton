import { Button, Dialog, Pagination, Spinner } from '@skeleton/ui'
import { useState } from 'react'
import { badgeText } from './badge'
import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from './hooks'
import { NotificationList, type NotificationListProps } from './NotificationList'
import type { NotificationsApi } from './notificationsApi'
import styles from './NotificationBell.module.css'

export type NotificationBellProps = {
  api: NotificationsApi
  /** 한 쪽에 보일 개수(기본 10) */
  pageSize?: number
  /** 종 버튼의 낭독 이름(안 읽은 수를 받는다). 기본 `Notifications` / `Notifications, N unread` */
  bellLabel?: (unread: number) => string
  /** 대화상자 제목(기본 `Notifications`) */
  title?: string
  closeLabel?: string
  markAllReadLabel?: string
  loadingLabel?: string
  /** 목록 문구 · 시각 글자 · 심각도 낭독 — `NotificationList` 의 props(`items` · `onRead` 제외) */
  listProps?: Omit<NotificationListProps, 'items' | 'onRead'>
  /** 쪽 이동 문구 — `Pagination` 의 label props */
  paginationLabels?: { label?: string; previousLabel?: string; nextLabel?: string }
}

const defaultBellLabel = (unread: number) =>
  unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'

/**
 * 종 버튼 + 안 읽은 수 배지 + 누르면 받은편지함 대화상자(네이티브 `<dialog>` — 포커스 가두기 · Esc).
 * 실시간 갱신은 별도: 앱이 `useNotificationIngest()` 를 `@skeleton/realtime` 훅에 건다(같은 캐시를 갱신한다).
 */
export function NotificationBell({
  api,
  pageSize = 10,
  bellLabel = defaultBellLabel,
  title = 'Notifications',
  closeLabel,
  markAllReadLabel = 'Mark all as read',
  loadingLabel,
  listProps,
  paginationLabels,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const unread = useUnreadCount(api).data ?? 0
  const list = useNotifications(api, { page, size: pageSize }, { enabled: open })
  const markRead = useMarkRead(api)
  const markAllRead = useMarkAllRead(api)
  const badge = badgeText(unread)

  return (
    <>
      <button
        type="button"
        className={styles.bell}
        aria-label={bellLabel(unread)}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {badge && (
          <span data-badge className={styles.badge} aria-hidden="true">
            {badge}
          </span>
        )}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        closeLabel={closeLabel}
        footer={
          <Button
            variant="secondary"
            size="sm"
            disabled={unread === 0}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {markAllReadLabel}
          </Button>
        }
      >
        {open && (
          <div className={styles.content}>
            {list.isPending ? (
              <Spinner label={loadingLabel} />
            ) : (
              <NotificationList
                {...listProps}
                items={list.data?.values ?? []}
                onRead={(item) => markRead.mutate(item.eventId)}
              />
            )}
            <Pagination
              {...paginationLabels}
              page={page}
              totalPages={list.data?.pagination.totalPages ?? 0}
              onPageChange={setPage}
            />
          </div>
        )}
      </Dialog>
    </>
  )
}
