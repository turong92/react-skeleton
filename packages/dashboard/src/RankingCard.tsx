import { Button, Tabs } from '@skeleton/ui'
import type { ReactNode } from 'react'
import type { DashboardLabels } from './labels'
import { Provenance } from './Provenance'
import { RankingTable } from './RankingTable'
import { statusMessage } from './statusMessage'
import { StatusNotice } from './StatusNotice'
import type { DashboardRanking } from './types'
import styles from './RankingCard.module.css'

export type RankingCardProps = {
  /** 묶음 키(`traffic` · `pages` · `geo` · `app`) - 카드 제목 */
  group: string
  /** 이 묶음의 순위들 - 둘 이상이면 카드 안 탭 */
  rankings: DashboardRanking[]
  zone: string
  includesToday: boolean
  locale?: string
  labels: DashboardLabels
  /** 「전체 보기」 - 없으면 단추를 그리지 않는다 */
  onViewAll?: (ranking: DashboardRanking) => void
  /** 제목 옆 배지(예: 「앱이 붙임」) */
  badge?: ReactNode
}

function RankingBody({
  ranking,
  zone,
  includesToday,
  locale,
  labels,
  onViewAll,
}: Omit<RankingCardProps, 'group' | 'rankings' | 'badge'> & { ranking: DashboardRanking }) {
  const message =
    statusMessage(ranking.status, ranking.source, labels) ??
    (ranking.rows.length === 0 ? labels.status.noRows : null)
  return (
    <div className={styles.body}>
      <div className={styles.content}>
        {message ? (
          <StatusNotice message={message} />
        ) : (
          <RankingTable ranking={ranking} locale={locale} labels={labels} />
        )}
      </div>
      <Provenance
        source={ranking.source}
        status={ranking.status}
        freshness={ranking.freshness}
        includesToday={includesToday}
        zone={zone}
        locale={locale}
        labels={labels}
        action={
          onViewAll && !message ? (
            <Button variant="ghost" size="sm" onClick={() => onViewAll(ranking)}>
              {labels.viewAll}
              <span aria-hidden="true">→</span>
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

/**
 * 순위 카드 - 카드 하나에 같은 묶음의 순위를 탭으로 담고, 탭마다 표 · 출처 배지 · 신선도 · 「전체 보기」.
 * 출처가 없으면 그 탭만 안내 상자(「Cloudflare 토큰을 넣으면 보입니다」), 다른 탭은 그대로 보인다.
 */
export function RankingCard({ group, rankings, badge, ...body }: RankingCardProps) {
  const { labels } = body
  const title = labels.groups[group] ?? group
  return (
    <article className={styles.card} aria-label={title}>
      <header className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {badge}
      </header>
      {rankings.length === 1 ? (
        <RankingBody ranking={rankings[0]} {...body} />
      ) : (
        <Tabs
          aria-label={labels.rankingTabsLabel(title)}
          items={rankings.map((ranking) => ({
            id: ranking.key,
            label: labels.rankings[ranking.key] ?? ranking.label,
            content: <RankingBody ranking={ranking} {...body} />,
          }))}
        />
      )}
    </article>
  )
}
