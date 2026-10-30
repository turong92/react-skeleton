import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Field,
  Input,
  PageHeader,
  RowMenu,
  Select,
  Skeleton,
  Table,
} from '@skeleton/ui'
import { useId, useMemo, useState, type FormEvent } from 'react'
import type { RewardsAdminApi } from './adminApi'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import { useAdminReferrals, useReferralMutations } from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import type { AdminReferral, ReferralFlag, ReferralStatus } from './types'
import styles from './AdminReferrals.module.css'

export type AdminReferralsProps = {
  api: Pick<RewardsAdminApi, 'listReferrals' | 'approveReferral' | 'cancelReferral'>
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
  locale?: string
  formatTime?: (iso: string) => string
}

const STATUSES: ReferralStatus[] = ['CLAIMED', 'REVIEW', 'HELD', 'QUALIFIED', 'CAPPED', 'CANCELED']
const tones: Record<ReferralStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  CLAIMED: 'neutral',
  REVIEW: 'warning',
  HELD: 'info',
  QUALIFIED: 'success',
  CAPPED: 'neutral',
  CANCELED: 'danger',
}

/**
 * 친구 초대 내역 운영 - 상태 · 표시로 걸러 보는 표(「더 보기」), 「같은 네트워크」 배지, 줄 메뉴의 「승인」(확인 필요 · 보류 중만)과 「초대 취소」(사유 필수).
 * 백엔드 `campaign.manage`. 이름은 서버가 `account.read` 가 있는 운영자에게만 준다 - 없으면 계정 id
 */
export function AdminReferrals({
  api,
  can = allowAll,
  labels: given,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: AdminReferralsProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.referrals
  const allowed = can(REWARDS_PERMISSIONS.campaign)
  const [status, setStatus] = useState<ReferralStatus | ''>('')
  const [flag, setFlag] = useState<ReferralFlag | ''>('')
  const [canceling, setCanceling] = useState<AdminReferral | null>(null)
  const list = useAdminReferrals(api, { status, flag })
  const mutations = useReferralMutations(api)
  const rows = useMemo(() => list.data?.pages.flatMap((page) => page.values) ?? [], [list.data])
  const name = (row: AdminReferral) => row.inviteeLabel || row.inviteeId

  const menu = (row: AdminReferral) => {
    const items = [
      ...(row.status === 'REVIEW' || row.status === 'HELD'
        ? [
            {
              key: 'approve',
              label: t.approve,
              onSelect: () => mutations.approve.mutate(row.inviteeId),
            },
          ]
        : []),
      ...(row.status === 'CLAIMED' || row.status === 'REVIEW' || row.status === 'HELD'
        ? [
            {
              key: 'cancel',
              label: t.cancel,
              danger: true,
              onSelect: () => setCanceling(row),
            },
          ]
        : []),
    ]
    return items.length > 0 && <RowMenu label={t.rowMenu(name(row))} items={items} />
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} />
      <div className={styles.filters}>
        <Field label={t.statusFilter}>
          {(control) => (
            <Select
              {...control}
              value={status}
              onChange={(event) => setStatus(event.target.value as ReferralStatus | '')}
            >
              <option value="">{t.all}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.flagFilter}>
          {(control) => (
            <Select
              {...control}
              value={flag}
              onChange={(event) => setFlag(event.target.value as ReferralFlag | '')}
            >
              <option value="">{t.all}</option>
              <option value="SAME_NETWORK">{t.sameNetwork}</option>
            </Select>
          )}
        </Field>
      </div>
      {mutations.approve.isError && (
        <Alert tone="danger">{adminErrorMessage(mutations.approve.error, labels)}</Alert>
      )}
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
          {isToolOff(list.error) ? labels.errors.notEnabled : labels.loadFailed}
        </Alert>
      ) : (
        <>
          <div
            className={list.isPlaceholderData ? styles.stale : undefined}
            aria-busy={list.isPlaceholderData}
          >
            <Table
              caption={t.caption}
              rows={rows}
              rowKey={(row) => row.inviteeId}
              empty={<EmptyState title={t.empty} headingLevel={2} />}
              columns={[
                {
                  key: 'invitee',
                  header: t.columns.invitee,
                  rowHeader: true,
                  render: name,
                },
                {
                  key: 'inviter',
                  header: t.columns.inviter,
                  render: (r) => r.inviterLabel || r.inviterId,
                },
                {
                  key: 'status',
                  header: t.columns.status,
                  render: (r) => <Badge tone={tones[r.status]}>{t.status[r.status]}</Badge>,
                },
                {
                  key: 'claimedAt',
                  header: t.columns.claimedAt,
                  render: (r) => formatTime(r.claimedAt),
                },
                {
                  key: 'detail',
                  header: t.columns.detail,
                  render: (r) => (
                    <span className={styles.detail}>
                      {r.flags.includes('SAME_NETWORK') && (
                        <Badge tone="warning">{t.sameNetwork}</Badge>
                      )}
                      {r.status === 'HELD' && r.releaseAt && (
                        <span>{t.releaseAt(formatTime(r.releaseAt))}</span>
                      )}
                      {r.cancelReason && <span>{r.cancelReason}</span>}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: t.columns.actions,
                  render: (r) => allowed && menu(r),
                },
              ]}
            />
          </div>
          {list.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={list.isFetchingNextPage}
                loadingLabel={labels.loading}
                onClick={() => void list.fetchNextPage()}
              >
                {t.more}
              </Button>
            </div>
          )}
        </>
      )}
      {canceling && (
        <CancelDialog
          referral={canceling}
          labels={labels}
          busy={mutations.cancel.isPending}
          error={
            mutations.cancel.isError ? adminErrorMessage(mutations.cancel.error, labels) : null
          }
          onClose={() => {
            mutations.cancel.reset()
            setCanceling(null)
          }}
          onSubmit={(reason) =>
            mutations.cancel.mutate(
              { inviteeId: canceling.inviteeId, reason },
              { onSuccess: () => setCanceling(null) },
            )
          }
        />
      )}
    </div>
  )
}

function CancelDialog({
  referral,
  labels,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  referral: AdminReferral
  labels: RewardsAdminLabels
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const t = labels.referrals
  const formId = useId()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (trimmed) onSubmit(trimmed)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.cancelTitle}
      closeLabel={labels.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            disabled={trimmed === ''}
            loading={busy}
            loadingLabel={labels.loading}
          >
            {t.cancelSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        <p>{referral.inviteeLabel || referral.inviteeId}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t.cancelReasonLabel} hint={t.cancelReasonHint} required>
          {(control) => (
            <Input
              {...control}
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  )
}
