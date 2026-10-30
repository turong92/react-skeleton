import { formatInstant } from '@skeleton/time'
import { Alert, Badge, Button, Card, InfiniteList, Skeleton } from '@skeleton/ui'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { Invitee, InviteeStatus } from '../types'
import type { CampaignApi } from './campaignApi'
import { useInvitees } from './queries'
import styles from './InviteList.module.css'

export type InviteListProps = {
  api: Pick<CampaignApi, 'myInvitees'>
  labels?: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
}

const tones: Record<InviteeStatus, 'neutral' | 'info' | 'success'> = {
  WAITING: 'neutral',
  PENDING: 'info',
  REWARDED: 'success',
  NOT_REWARDED: 'neutral',
}

/** 초대 현황 — 내가 초대한 사람들을 새것부터: 가린 이름(없으면 「친구 n」) · 상태 배지 · 가입일(확인 중이면 보상 예정일). 「더 보기」 로 이어 받는다 */
export function InviteList({
  api,
  labels = defaultRewardsLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: InviteListProps) {
  const t = labels.invite.list
  const query = useInvitees(api)
  if (query.isPending)
    return (
      <Card title={t.title}>
        <Skeleton lines={3} label={labels.loading} />
      </Card>
    )
  if (query.isError && !query.data)
    return (
      <Card title={t.title}>
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              {labels.retry}
            </Button>
          }
        >
          {labels.loadFailed}
        </Alert>
      </Card>
    )
  const items = query.data?.pages.flatMap((page) => page.values) ?? []
  return (
    <Card title={t.title}>
      <InfiniteList<Invitee>
        label={t.title}
        items={items}
        getKey={(invitee) => `${invitee.claimedAt}:${invitee.label ?? ''}:${invitee.status}`}
        hasMore={query.hasNextPage}
        loading={query.isFetchingNextPage}
        error={query.isError}
        auto={false}
        onLoadMore={() => void query.fetchNextPage()}
        loadMoreLabel={t.loadMore}
        loadingLabel={labels.loading}
        errorLabel={labels.loadFailed}
        retryLabel={labels.retry}
        empty={<p className={styles.empty}>{t.empty}</p>}
        renderItem={(invitee, index) => (
          <div className={styles.row}>
            <div className={styles.main}>
              <strong className={styles.name}>{invitee.label ?? t.friend(index + 1)}</strong>
              <span className={styles.meta}>
                <time dateTime={invitee.claimedAt}>
                  {t.joinedAt(formatTime(invitee.claimedAt))}
                </time>
                {invitee.rewardAt && ` · ${t.rewardAt(formatTime(invitee.rewardAt))}`}
              </span>
            </div>
            <Badge tone={tones[invitee.status]}>{t.status[invitee.status]}</Badge>
          </div>
        )}
      />
    </Card>
  )
}
