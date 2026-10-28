import { formatInstant } from '@skeleton/time'
import { Alert, Badge, Button, InfiniteList, Skeleton } from '@skeleton/ui'
import { defaultRewardsLabels, type RewardsLabels } from '../labels'
import type { PointEntry } from '../types'
import type { PointApi } from './pointApi'
import { usePointHistory } from './queries'
import styles from './PointHistory.module.css'

export type PointHistoryProps = {
  api: Pick<PointApi, 'pointHistory'>
  labels?: RewardsLabels
  locale?: string
  formatTime?: (iso: string) => string
}

/** 포인트 내역 — 적립 · 사용 · 소멸 · 조정 줄을 최신순으로, 「더 보기」 단추로 이어 받는다 */
export function PointHistory({
  api,
  labels = defaultRewardsLabels,
  locale,
  formatTime = (iso) => formatInstant(iso, { locale }),
}: PointHistoryProps) {
  const t = labels.point
  const query = usePointHistory(api)
  const number = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' })
  if (query.isPending) return <Skeleton lines={4} label={labels.loading} />
  if (query.isError && !query.data)
    return (
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
    )
  const items = query.data?.pages.flatMap((page) => page.values) ?? []
  return (
    <InfiniteList<PointEntry>
      label={t.history}
      items={items}
      getKey={(entry) => entry.id}
      hasMore={query.hasNextPage}
      loading={query.isFetchingNextPage}
      error={query.isError}
      auto={false}
      onLoadMore={() => void query.fetchNextPage()}
      loadMoreLabel={t.loadMore}
      loadingLabel={labels.loading}
      errorLabel={labels.loadFailed}
      retryLabel={labels.retry}
      empty={<p className={styles.empty}>{t.emptyHistory}</p>}
      renderItem={(entry) => (
        <div className={styles.row} data-kind={entry.kind}>
          <div className={styles.main}>
            <strong className={styles.reason}>{entry.reason ?? t.kinds[entry.kind]}</strong>
            <span className={styles.meta}>
              <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
              {entry.expiresAt && ` · ${t.expiresAt(formatTime(entry.expiresAt))}`}
            </span>
          </div>
          <Badge tone={entry.delta > 0 ? 'success' : 'neutral'}>{t.kinds[entry.kind]}</Badge>
          <span className={styles.delta}>
            {number.format(entry.delta)} {t.unit}
          </span>
        </div>
      )}
    />
  )
}
