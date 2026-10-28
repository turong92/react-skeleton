import { Alert, Button, EmptyState, Spinner, SwitchRow } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { usePreferences, useSetPreference } from './hooks'
import type { NotificationsApi } from './notificationsApi'
import styles from './NotificationPreferences.module.css'

export type NotificationPreferencesProps = {
  api: NotificationsApi
  /** 종류(`type`) → 화면에 보일 이름. 없는 종류는 `type` 그대로 */
  labels?: Readonly<Record<string, ReactNode>>
  /** 종류 아래 보조 설명(선택) */
  descriptions?: Readonly<Record<string, ReactNode>>
  /** 목록 위 제목(없으면 안 그린다 — 카드 안에 넣을 때는 카드가 제목을 맡는다) */
  title?: ReactNode
  loadingLabel?: string
  /** 서버가 끌 수 있는 종류를 하나도 알려 주지 않을 때 */
  emptyTitle?: string
  /** 불러오기에 실패했을 때의 문장(기본 영어) */
  errorMessage?: string
  /** 다시 시도 단추 이름(기본 `Try again`) */
  retryLabel?: string
}

/**
 * 알림 종류별 수신 설정 — 서버가 알려 준 종류마다 `SwitchRow` 한 줄(켜짐 = 받는다). 누르면 바로 저장한다.
 * 백엔드 `skeleton.notification.preferences.types` 에 적은 종류만 나온다.
 */
export function NotificationPreferences({
  api,
  labels,
  descriptions,
  title,
  loadingLabel,
  emptyTitle = 'No notification types to configure',
  errorMessage = 'Could not load the notification settings.',
  retryLabel = 'Try again',
}: NotificationPreferencesProps) {
  const preferences = usePreferences(api)
  const save = useSetPreference(api)
  if (preferences.isPending) return <Spinner label={loadingLabel} />
  if (preferences.isError && !preferences.data)
    return (
      <Alert
        tone="danger"
        action={
          <Button
            variant="secondary"
            size="sm"
            loading={preferences.isFetching}
            onClick={() => void preferences.refetch()}
          >
            {retryLabel}
          </Button>
        }
      >
        {errorMessage}
      </Alert>
    )
  const items = preferences.data?.items ?? []
  return (
    <div className={styles.root}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div className={styles.list}>
          {items.map((item) => (
            <SwitchRow
              key={item.type}
              title={labels?.[item.type] ?? item.type}
              description={descriptions?.[item.type]}
              checked={!item.muted}
              busy={save.isPending && save.variables?.type === item.type}
              onChange={(enabled) => save.mutate({ type: item.type, muted: !enabled })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
