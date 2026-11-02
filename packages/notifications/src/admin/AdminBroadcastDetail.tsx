import { formatInstant } from '@skeleton/time'
import { Alert, Badge, Button, PageHeader, SectionCard, Skeleton, Stat } from '@skeleton/ui'
import { useState } from 'react'
import type { BroadcastAdminApi } from './adminApi'
import { broadcastErrorMessage, isToolOff, mergeBroadcastLabels } from './adminErrors'
import { ConfirmDialog } from './ConfirmDialog'
import { percent } from './format'
import { useBroadcast, useBroadcastMutations } from './hooks'
import type { BroadcastAdminLabels } from './labels'
import { allowAll, BROADCAST_PERMISSIONS, type CanFn } from './permissions'
import type { BroadcastStatus } from './types'
import styles from './admin.module.css'

export type AdminBroadcastDetailProps = {
  api: Pick<
    BroadcastAdminApi,
    | 'get'
    | 'remove'
    | 'unschedule'
    | 'cancel'
    | 'resume'
    | 'create'
    | 'update'
    | 'sendTest'
    | 'send'
  >
  id: string
  /** 임시 저장의 「고치기」 단추 - 라우터로 편집 화면에 간다 */
  onEdit?: (id: string) => void
  /** 임시 저장을 지웠다 - 보통 목록으로 돌아간다 */
  onDeleted?: () => void
  typeLabels?: Record<string, string>
  /** 권한 질문 - 상태를 바꾸는 단추를 숨긴다(서버가 다시 판정한다). 기본 모두 허용 */
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

type Confirm = 'cancel' | 'delete' | 'unschedule'

/** 공지 상세 - 상태 · 통계(알림함 읽음 · 푸시 넣음/성공/실패/보내지 않음/클릭) · 상태별 단추(확인 창을 거친다) · 누가 · 언제. 보내는 중이면 10초마다 다시 읽는다 */
export function AdminBroadcastDetail({
  api,
  id,
  onEdit,
  onDeleted,
  typeLabels = {},
  can = allowAll,
  labels: given,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: AdminBroadcastDetailProps) {
  const labels = mergeBroadcastLabels(given)
  const t = labels.detail
  const s = t.stats
  const detail = useBroadcast(api, id)
  const mutations = useBroadcastMutations(api)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const allowed = can(BROADCAST_PERMISSIONS.send)

  if (detail.isPending) return <Skeleton label={labels.loading} />
  if (detail.isError)
    return (
      <Alert
        tone="danger"
        action={
          isToolOff(detail.error) ? undefined : (
            <Button variant="secondary" size="sm" onClick={() => void detail.refetch()}>
              {labels.retry}
            </Button>
          )
        }
      >
        {isToolOff(detail.error)
          ? labels.errors.notEnabled
          : broadcastErrorMessage(detail.error, labels)}
      </Alert>
    )

  const b = detail.data
  const { inbox, channels } = b.stats
  const push = channels.push
  const failure = mutations.cancel.error ?? mutations.unschedule.error ?? mutations.remove.error
  const time = (iso: string | null) => (iso ? formatTime(iso) : t.history.none)
  const number = (n: number | undefined) => (n === undefined ? s.unknown : String(n))
  const close = () => {
    mutations.cancel.reset()
    mutations.unschedule.reset()
    mutations.remove.reset()
    setConfirm(null)
  }
  const pending = {
    cancel: mutations.cancel.isPending,
    unschedule: mutations.unschedule.isPending,
    delete: mutations.remove.isPending,
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={b.title}
        actions={
          <>
            <Badge tone={tone[b.status]}>{labels.status[b.status]}</Badge>
            {allowed && b.status === 'DRAFT' && (
              <>
                {onEdit && (
                  <Button variant="secondary" onClick={() => onEdit(b.id)}>
                    {labels.edit}
                  </Button>
                )}
                <Button variant="danger" onClick={() => setConfirm('delete')}>
                  {labels.remove}
                </Button>
              </>
            )}
            {allowed && b.status === 'SCHEDULED' && (
              <Button variant="secondary" onClick={() => setConfirm('unschedule')}>
                {t.unschedule}
              </Button>
            )}
            {allowed && (b.status === 'SCHEDULED' || b.status === 'SENDING') && (
              <Button variant="danger" onClick={() => setConfirm('cancel')}>
                {t.cancel}
              </Button>
            )}
            {allowed && b.status === 'FAILED' && (
              <Button
                onClick={() => mutations.resume.mutate(b.id)}
                loading={mutations.resume.isPending}
                loadingLabel={labels.loading}
              >
                {t.resume}
              </Button>
            )}
          </>
        }
      />
      {b.status === 'FAILED' && <Alert tone="danger">{t.failedBanner(b.failureReason)}</Alert>}
      {mutations.resume.isError && (
        <Alert tone="danger">{broadcastErrorMessage(mutations.resume.error, labels)}</Alert>
      )}
      <SectionCard id="broadcast-stats" title={s.title}>
        <div className={styles.stats}>
          <Stat label={s.estimate} value={b.estimate === null ? s.unknown : b.estimate} />
          <Stat label={s.recipients} value={b.recipients} />
          <Stat label={s.inboxStored} value={number(inbox?.stored)} />
          <Stat
            label={s.inboxRead}
            value={number(inbox?.read)}
            hint={inbox ? s.readRate(percent(inbox.read, inbox.stored)) : undefined}
          />
          {(b.channels.includes('push') || push) && (
            <>
              <Stat label={s.pushQueued} value={number(push?.queued)} />
              <Stat label={s.pushDelivered} value={number(push?.delivered)} />
              <Stat label={s.pushFailed} value={number(push?.failed)} />
              <Stat label={s.pushDropped} value={number(push?.dropped)} />
              <Stat
                label={s.pushOpened}
                value={number(push?.opened)}
                hint={push ? s.clickRate(percent(push.opened, push.delivered)) : undefined}
              />
            </>
          )}
        </div>
      </SectionCard>
      <SectionCard id="broadcast-history" title={t.history.title}>
        <dl className={styles.facts}>
          <dt>{t.content.type}</dt>
          <dd>{typeLabels[b.type] ?? b.type}</dd>
          <dt>{t.content.audience}</dt>
          <dd>
            {[labels.audienceKinds[b.audience.kind] ?? b.audience.kind, b.audience.param]
              .filter(Boolean)
              .join(' · ')}
          </dd>
          <dt>{t.content.channels}</dt>
          <dd>
            {[
              labels.editor.inboxAlways,
              ...b.channels.map((c) => labels.channelNames[c] ?? c),
            ].join(', ')}
          </dd>
          {b.link && (
            <>
              <dt>{t.content.link}</dt>
              <dd>{b.link}</dd>
            </>
          )}
          {b.body && (
            <>
              <dt>{t.content.body}</dt>
              <dd>{b.body}</dd>
            </>
          )}
          <dt>{t.history.createdBy}</dt>
          <dd>
            {b.createdBy} · {time(b.createdAt)}
          </dd>
          {b.scheduledAt && (
            <>
              <dt>{t.history.scheduledAt}</dt>
              <dd>{time(b.scheduledAt)}</dd>
            </>
          )}
          {b.sentBy && (
            <>
              <dt>{t.history.sentBy}</dt>
              <dd>
                {b.sentBy} · {time(b.sendRequestedAt)}
              </dd>
            </>
          )}
          {b.startedAt && (
            <>
              <dt>{t.history.startedAt}</dt>
              <dd>{time(b.startedAt)}</dd>
            </>
          )}
          {b.finishedAt && (
            <>
              <dt>{t.history.finishedAt}</dt>
              <dd>{time(b.finishedAt)}</dd>
            </>
          )}
          {b.cancelledBy && (
            <>
              <dt>{t.history.cancelledBy}</dt>
              <dd>
                {b.cancelledBy} · {time(b.cancelledAt)}
              </dd>
            </>
          )}
        </dl>
      </SectionCard>
      {confirm && (
        <ConfirmDialog
          title={labels.confirm[`${confirm}Title`]}
          confirmLabel={labels.confirm[`${confirm}Confirm`]}
          cancelLabel={labels.confirm.keep}
          closeLabel={labels.close}
          loadingLabel={labels.loading}
          danger={confirm !== 'unschedule'}
          busy={pending[confirm]}
          error={failure ? broadcastErrorMessage(failure, labels) : null}
          onClose={close}
          onConfirm={() => {
            const done = { onSuccess: close }
            if (confirm === 'cancel') mutations.cancel.mutate(b.id, done)
            else if (confirm === 'unschedule') mutations.unschedule.mutate(b.id, done)
            else
              mutations.remove.mutate(b.id, {
                onSuccess: () => {
                  close()
                  onDeleted?.()
                },
              })
          }}
        >
          <p>{labels.confirm[`${confirm}Body`]}</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
