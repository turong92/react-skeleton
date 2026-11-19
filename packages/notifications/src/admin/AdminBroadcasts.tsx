import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Progress,
  Select,
  Skeleton,
  Table,
} from '@skeleton/ui'
import { useState } from 'react'
import { broadcastErrorMessage, isToolOff, mergeBroadcastLabels } from './adminErrors'
import type { BroadcastAdminApi } from './adminApi'
import { useBroadcasts } from './hooks'
import type { BroadcastAdminLabels } from './labels'
import { allowAll, BROADCAST_PERMISSIONS, type CanFn } from './permissions'
import { BROADCAST_STATUSES, type Broadcast, type BroadcastStatus } from './types'
import styles from './admin.module.css'

export type AdminBroadcastsProps = {
  api: Pick<BroadcastAdminApi, 'list'>
  /** 「새 공지」 단추 - 라우터로 편집 화면에 간다(패키지는 라우터를 모른다) */
  onCreate: () => void
  /** 줄의 「열기」 단추 - 라우터로 상세 화면에 간다 */
  onOpen: (id: string) => void
  /** 종류 코드 → 보이는 이름(앱이 정한 종류 목록). 없으면 코드 그대로 */
  typeLabels?: Record<string, string>
  /** 권한 질문 - 「새 공지」 를 숨긴다(서버가 다시 판정한다). 기본 모두 허용 */
  can?: CanFn
  labels?: Partial<BroadcastAdminLabels>
  locale?: string
  formatTime?: (iso: string) => string
}

const tone = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  SENDING: 'info',
  SENT: 'success',
  CANCELLED: 'neutral',
  FAILED: 'danger',
} as const satisfies Record<BroadcastStatus, 'neutral' | 'info' | 'success' | 'danger'>

/** 공지 목록 - 상태 칩 · 종류 · 대상 · 보낸/예약 시각 · 진행 막대. 백엔드 `skeleton.notification.broadcast.admin.enabled=true` + `notification-broadcast.read` */
export function AdminBroadcasts({
  api,
  onCreate,
  onOpen,
  typeLabels = {},
  can = allowAll,
  labels: given,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: AdminBroadcastsProps) {
  const labels = mergeBroadcastLabels(given)
  const t = labels.list
  const [status, setStatus] = useState<BroadcastStatus | ''>('')
  const list = useBroadcasts(api, status)
  const rows = list.data?.pages.flat() ?? []

  const timeOf = (b: Broadcast) => {
    const at = b.scheduledAt ?? b.startedAt ?? b.sendRequestedAt
    return at ? formatTime(at) : b.status === 'DRAFT' ? '-' : t.immediate
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.title}
        actions={can(BROADCAST_PERMISSIONS.send) && <Button onClick={onCreate}>{t.create}</Button>}
      />
      <div className={styles.toolbar}>
        <Field label={t.filter}>
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(event) => setStatus(event.target.value as BroadcastStatus | '')}
            >
              <option value="">{t.allStatuses}</option>
              {BROADCAST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labels.status[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {list.isPending ? (
        <Skeleton label={labels.loading} />
      ) : list.isError ? (
        <Alert
          tone="danger"
          action={
            isToolOff(list.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void list.refetch()}>
                {labels.retry}
              </Button>
            )
          }
        >
          {isToolOff(list.error)
            ? labels.errors.notEnabled
            : list.error
              ? broadcastErrorMessage(list.error, labels)
              : labels.loadFailed}
        </Alert>
      ) : (
        <>
          <Table
            caption={t.caption}
            rows={rows}
            rowKey={(b) => b.id}
            empty={<EmptyState title={t.empty} headingLevel={2} />}
            columns={[
              { key: 'title', header: t.columns.title, rowHeader: true, render: (b) => b.title },
              { key: 'type', header: t.columns.type, render: (b) => typeLabels[b.type] ?? b.type },
              {
                key: 'audience',
                header: t.columns.audience,
                render: (b) =>
                  [labels.audienceKinds[b.audience.kind] ?? b.audience.kind, b.audience.param]
                    .filter(Boolean)
                    .join(' · '),
              },
              {
                key: 'status',
                header: t.columns.status,
                render: (b) => <Badge tone={tone[b.status]}>{labels.status[b.status]}</Badge>,
              },
              { key: 'when', header: t.columns.when, render: timeOf },
              {
                key: 'progress',
                header: t.columns.progress,
                render: (b) =>
                  b.status === 'DRAFT' || b.status === 'SCHEDULED' ? (
                    '-'
                  ) : (
                    <Progress
                      label={t.progress}
                      value={b.estimate ? b.recipients / b.estimate : b.status === 'SENT' ? 1 : 0}
                      valueText={t.progressText(b.recipients, b.estimate)}
                    />
                  ),
              },
              {
                key: 'actions',
                header: t.columns.actions,
                render: (b) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={t.openTitle(b.title)}
                    onClick={() => onOpen(b.id)}
                  >
                    {t.open}
                  </Button>
                ),
              },
            ]}
          />
          {list.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                onClick={() => void list.fetchNextPage()}
                loading={list.isFetchingNextPage}
                loadingLabel={labels.loading}
              >
                {t.loadMore}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
