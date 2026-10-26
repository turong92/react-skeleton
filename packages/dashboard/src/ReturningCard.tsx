import { formatCount, formatPercent } from './format'
import type { DashboardLabels } from './labels'
import { Provenance } from './Provenance'
import { statusMessage } from './statusMessage'
import { StatusNotice } from './StatusNotice'
import type { DashboardRanking } from './types'
import styles from './ReturningCard.module.css'

export type ReturningCardProps = {
  /** `ga.returning` - 행은 「New」 · 「Returning」 둘, 값은 사용자 수(비율은 여기서 계산한다) */
  ranking: DashboardRanking
  zone: string
  includesToday: boolean
  now?: number
  locale?: string
  labels: DashboardLabels
}

const countOf = (ranking: DashboardRanking, name: string) =>
  ranking.rows.find((row) => row.label.toLowerCase() === name)?.values[0] ?? 0

/** 재방문율 카드 - 기간 안에 다시 찾아온 사람의 비율을 큰 숫자 + 막대 + 두 줄(재방문 · 처음 방문)로. 두 행에서 비율을 계산한다 */
export function ReturningCard({
  ranking,
  zone,
  includesToday,
  now,
  locale,
  labels,
}: ReturningCardProps) {
  const returning = countOf(ranking, 'returning')
  const first = countOf(ranking, 'new')
  const total = returning + first
  const message =
    statusMessage(ranking.status, ranking.source, labels) ??
    (total === 0 ? labels.status.noRows : null)
  const rate = total > 0 ? (returning / total) * 100 : 0
  return (
    <article className={styles.card} aria-label={labels.returning.title}>
      <h3 className={styles.title}>{labels.returning.title}</h3>
      {message ? (
        <StatusNotice message={message} />
      ) : (
        <div className={styles.body}>
          <p className={styles.caption}>{labels.returning.caption}</p>
          <p className={styles.big}>{formatPercent(rate, locale)}</p>
          <div
            className={styles.split}
            role="img"
            aria-label={`${labels.returning.returning} ${formatPercent(rate, locale)}, ${labels.returning.first} ${formatPercent(100 - rate, locale)}`}
          >
            <i style={{ width: `${rate}%` }} />
          </div>
          <dl className={styles.rows}>
            <div>
              <dt>{labels.returning.returning}</dt>
              <dd>{labels.funnel.people(formatCount(returning, locale))}</dd>
            </div>
            <div>
              <dt>{labels.returning.first}</dt>
              <dd>{labels.funnel.people(formatCount(first, locale))}</dd>
            </div>
          </dl>
        </div>
      )}
      <Provenance
        source={ranking.source}
        status={ranking.status}
        freshness={ranking.freshness}
        includesToday={includesToday}
        now={now}
        zone={zone}
        locale={locale}
        labels={labels}
      />
    </article>
  )
}
