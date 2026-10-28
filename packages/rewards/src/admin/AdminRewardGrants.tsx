import { formatInstant } from '@skeleton/time'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeader,
  Select,
  Skeleton,
  Table,
} from '@skeleton/ui'
import { useState } from 'react'
import { adminErrorMessage, isToolOff, mergeAdminLabels } from './adminErrors'
import type { RewardsAdminApi } from './adminApi'
import { useRewardGrantMutations, useRewardGrants } from './hooks'
import type { RewardsAdminLabels } from './labels'
import { allowAll, REWARDS_PERMISSIONS, type CanFn } from './permissions'
import type { RewardGrantStatus } from './types'
import styles from './AdminRewardGrants.module.css'

export type AdminRewardGrantsProps = {
  api: Pick<RewardsAdminApi, 'listRewardGrants' | 'retryRewardGrant' | 'cancelRewardGrant'>
  can?: CanFn
  labels?: Partial<RewardsAdminLabels>
  locale?: string
  formatTime?: (iso: string) => string
}

const STATUSES: readonly RewardGrantStatus[] = ['PENDING', 'ISSUED', 'FAILED', 'CANCELED']
const TONE = {
  PENDING: 'info',
  ISSUED: 'success',
  FAILED: 'danger',
  CANCELED: 'neutral',
} as const

/** 지급 건 운영 - 상태로 거르고, 못 준 건은 「다시 지급」, 아직 안 준 건은 「멈추기」. 백엔드 `skeleton.reward.admin.enabled=true` + `reward.operate` */
export function AdminRewardGrants({
  api,
  can = allowAll,
  labels: given,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: AdminRewardGrantsProps) {
  const labels = mergeAdminLabels(given)
  const t = labels.grants
  const allowed = can(REWARDS_PERMISSIONS.reward)
  const [status, setStatus] = useState<RewardGrantStatus | ''>('FAILED')
  const query = useRewardGrants(api, status)
  const mutations = useRewardGrantMutations(api)
  const failure = mutations.retry.error ?? mutations.cancel.error
  return (
    <div className={styles.page}>
      <PageHeader title={t.title} />
      <Field label={t.statusFilter}>
        {(control) => (
          <Select
            {...control}
            value={status}
            onChange={(event) => setStatus(event.target.value as RewardGrantStatus | '')}
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
      {failure && <Alert tone="danger">{adminErrorMessage(failure, labels)}</Alert>}
      {query.isPending ? (
        <Skeleton label={labels.loading} />
      ) : query.isError ? (
        <Alert
          tone="danger"
          action={
            isToolOff(query.error) ? undefined : (
              <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
                {labels.retry}
              </Button>
            )
          }
        >
          {isToolOff(query.error) ? labels.errors.notEnabled : labels.loadFailed}
        </Alert>
      ) : (
        <Table
          caption={t.caption}
          rows={query.data}
          rowKey={(grant) => grant.id}
          empty={<EmptyState title={t.empty} headingLevel={2} />}
          columns={[
            {
              key: 'reward',
              header: t.columns.reward,
              rowHeader: true,
              render: (grant) => grant.label,
            },
            { key: 'account', header: t.columns.account, render: (grant) => grant.accountId },
            {
              key: 'status',
              header: t.columns.status,
              render: (grant) => (
                <span className={styles.status}>
                  <Badge tone={TONE[grant.status]}>{t.status[grant.status]}</Badge>
                  {grant.lastError && <span className={styles.muted}>{grant.lastError}</span>}
                </span>
              ),
            },
            { key: 'source', header: t.columns.source, render: (grant) => grant.sourceType },
            {
              key: 'created',
              header: t.columns.created,
              render: (grant) => formatTime(grant.createdAt),
            },
            {
              key: 'actions',
              header: t.columns.actions,
              render: (grant) =>
                allowed && (
                  <span className={styles.actions}>
                    {grant.status === 'FAILED' && (
                      <Button
                        size="sm"
                        aria-label={t.retryFor(grant.label)}
                        loading={
                          mutations.retry.isPending && mutations.retry.variables === grant.id
                        }
                        loadingLabel={labels.loading}
                        onClick={() => mutations.retry.mutate(grant.id)}
                      >
                        {t.retry}
                      </Button>
                    )}
                    {grant.status === 'PENDING' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={t.cancelFor(grant.label)}
                        loading={
                          mutations.cancel.isPending && mutations.cancel.variables === grant.id
                        }
                        loadingLabel={labels.loading}
                        onClick={() => mutations.cancel.mutate(grant.id)}
                      >
                        {t.cancel}
                      </Button>
                    )}
                  </span>
                ),
            },
          ]}
        />
      )}
    </div>
  )
}
