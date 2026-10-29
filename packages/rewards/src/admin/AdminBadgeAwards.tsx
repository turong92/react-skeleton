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
  Select,
  Skeleton,
  Table,
} from '@skeleton/ui'
import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { RewardsAdminApi } from './adminApi'
import { accountLabelOf, type AccountChoice } from './accountLabel'
import { AccountSearch } from './AccountSearch'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import { revocableEventIds } from './badgeRows'
import { useAdminBadges, useBadgeAwards, useRevokeBadgeAward } from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import type { BadgeAwardEvent } from './types'
import styles from './AdminBadgeAwards.module.css'

export type AdminBadgeAwardsProps = {
  api: Pick<RewardsAdminApi, 'listBadges' | 'listBadgeAwards' | 'revokeBadgeAward'>
  /** 계정으로 걸러 보려면 계정 찾기를 준다 - 없으면 배지 필터만 */
  searchAccounts?: (query: string) => Promise<AccountChoice[]>
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
  locale?: string
  formatTime?: (iso: string) => string
  /** 계정 칸을 그 계정 화면으로 잇는다(라우터 링크). 없으면 글자 */
  renderAccountLink?: (accountId: string, children: ReactNode) => ReactNode
}

/**
 * 배지 수여 · 회수 내역 - 최신순 표(배지 · 계정으로 걸러 보기, 「더 보기」)와 「회수」 대화상자(사유 필수).
 * 백엔드 `badge.manage`. 계정 이름은 서버가 `account.read` 권한이 있는 운영자에게만 준다(없으면 계정 id)
 */
export function AdminBadgeAwards({
  api,
  searchAccounts,
  can = allowAll,
  labels: given,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
  renderAccountLink,
}: AdminBadgeAwardsProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.badgeAwards
  const allowed = can(REWARDS_PERMISSIONS.badge)
  const [badgeId, setBadgeId] = useState('')
  const [account, setAccount] = useState<AccountChoice | null>(null)
  const [revoking, setRevoking] = useState<BadgeAwardEvent | null>(null)
  const badges = useAdminBadges(api)
  const awards = useBadgeAwards(api, { badgeId, accountId: account?.id ?? '' })
  const revoke = useRevokeBadgeAward(api)
  const rows = useMemo(() => awards.data?.pages.flatMap((page) => page.values) ?? [], [awards.data])
  const revocable = useMemo(() => revocableEventIds(rows), [rows])

  const accountCell = (row: BadgeAwardEvent) => {
    const text = row.accountLabel || row.accountId
    return renderAccountLink ? renderAccountLink(row.accountId, text) : text
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t.title} />
      <div className={styles.filters}>
        <Field label={t.badgeFilter}>
          {(control) => (
            <Select
              {...control}
              value={badgeId}
              onChange={(event) => setBadgeId(event.target.value)}
            >
              <option value="">{t.allBadges}</option>
              {badges.data?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {searchAccounts &&
          (account ? (
            <p className={styles.picked}>
              <span>
                {t.accountFilter}: <strong>{accountLabelOf(account)}</strong>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setAccount(null)}>
                {t.clearAccount}
              </Button>
            </p>
          ) : (
            <AccountSearch search={searchAccounts} onPick={setAccount} labels={labels} />
          ))}
      </div>
      {awards.isPending ? (
        <Skeleton label={labels.loading} />
      ) : awards.isError ? (
        <Alert
          tone="danger"
          action={
            isToolOff(awards.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void awards.refetch()}>
                {labels.retry}
              </Button>
            )
          }
        >
          {isToolOff(awards.error) ? labels.errors.notEnabled : labels.loadFailed}
        </Alert>
      ) : (
        <>
          <div
            className={awards.isPlaceholderData ? styles.stale : undefined}
            aria-busy={awards.isPlaceholderData}
          >
            <Table
              caption={t.caption}
              rows={rows}
              rowKey={(row) => row.id}
              empty={<EmptyState title={t.empty} headingLevel={2} />}
              columns={[
                { key: 'when', header: t.columns.when, render: (r) => formatTime(r.createdAt) },
                {
                  key: 'badge',
                  header: t.columns.badge,
                  rowHeader: true,
                  render: (r) => r.badgeName ?? t.deletedBadge,
                },
                { key: 'account', header: t.columns.account, render: accountCell },
                {
                  key: 'action',
                  header: t.columns.action,
                  render: (r) => (
                    <Badge tone={r.action === 'AWARDED' ? 'success' : 'warning'}>
                      {t.actions[r.action]}
                    </Badge>
                  ),
                },
                { key: 'source', header: t.columns.source, render: (r) => t.sources[r.source] },
                { key: 'reason', header: t.columns.reason, render: (r) => r.reason ?? '-' },
                {
                  key: 'actions',
                  header: t.columns.actions,
                  render: (r) =>
                    allowed &&
                    revocable.has(r.id) && (
                      <Button
                        variant="danger"
                        size="sm"
                        aria-label={t.revokeFor(
                          r.badgeName ?? t.deletedBadge,
                          r.accountLabel || r.accountId,
                        )}
                        onClick={() => setRevoking(r)}
                      >
                        {t.revoke}
                      </Button>
                    ),
                },
              ]}
            />
          </div>
          {awards.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={awards.isFetchingNextPage}
                loadingLabel={labels.loading}
                onClick={() => void awards.fetchNextPage()}
              >
                {t.more}
              </Button>
            </div>
          )}
        </>
      )}
      {revoking && (
        <RevokeDialog
          event={revoking}
          labels={labels}
          busy={revoke.isPending}
          error={revoke.isError ? adminErrorMessage(revoke.error, labels) : null}
          onClose={() => {
            revoke.reset()
            setRevoking(null)
          }}
          onSubmit={(reason) =>
            revoke.mutate(
              { awardId: revoking.awardId, reason },
              { onSuccess: () => setRevoking(null) },
            )
          }
        />
      )}
    </div>
  )
}

function RevokeDialog({
  event,
  labels,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  event: BadgeAwardEvent
  labels: RewardsAdminLabels
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const t = labels.badgeAwards
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
      title={t.revokeTitle}
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
            {t.revoke}
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit}>
        <p>{`${event.badgeName ?? t.deletedBadge} · ${event.accountLabel || event.accountId}`}</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label={t.revokeReason} hint={t.revokeReasonHint} required>
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
