import { Fragment } from 'react'
import type { ReviewsLabels } from './labels'
import { RatingStars } from './RatingStars'
import { formatAverage } from './ratingMath'
import { RATINGS, type Rating, type TargetSummary } from './types'
import styles from './ReviewSummary.module.css'

export type ReviewSummaryProps = {
  summary: Pick<TargetSummary, 'count' | 'average' | 'distribution'>
  /** 지금 목록을 이 별점으로 거르고 있다 */
  rating?: Rating
  /** 있으면 분포 막대가 눌러서 거르는 단추가 된다 - 같은 막대를 다시 누르면 풀린다. 없으면 읽기만 */
  onToggleRating?: (rating: Rating) => void
  labels: Pick<ReviewsLabels, 'rating' | 'summary'>
  locale?: string
}

/** 평균 · 별 · 리뷰 수와 1~5점 분포 막대 */
export function ReviewSummary({
  summary,
  rating,
  onToggleRating,
  labels,
  locale,
}: ReviewSummaryProps) {
  const t = labels.summary
  const peak = Math.max(1, ...RATINGS.map((point) => summary.distribution[point] ?? 0))
  return (
    <section className={styles.root}>
      <div className={styles.headline}>
        {summary.average === null ? (
          <p className={styles.empty}>{t.empty}</p>
        ) : (
          <>
            <p className={styles.average}>{formatAverage(summary.average, locale)}</p>
            <RatingStars value={summary.average} size="lg" labels={labels} locale={locale} />
            <p className={styles.count}>{t.count(summary.count)}</p>
          </>
        )}
      </div>
      {summary.count > 0 && (
        <ul className={styles.bars}>
          {[...RATINGS].reverse().map((point) => {
            const count = summary.distribution[point] ?? 0
            const active = rating === point
            const bar = (
              <Fragment>
                <span className={styles.point} aria-hidden="true">
                  {point}
                </span>
                <span className={styles.track} aria-hidden="true">
                  <span
                    className={styles.fill}
                    style={{ inlineSize: `${(count / peak) * 100}%` }}
                  />
                </span>
                <span className={styles.number} aria-hidden="true">
                  {count}
                </span>
              </Fragment>
            )
            return (
              <li key={point}>
                {onToggleRating ? (
                  <button
                    type="button"
                    className={styles.bar}
                    aria-pressed={active}
                    aria-label={active ? t.barActive(point, count) : t.bar(point, count)}
                    disabled={count === 0 && !active}
                    onClick={() => onToggleRating(point)}
                  >
                    {bar}
                  </button>
                ) : (
                  <div className={styles.bar} role="group" aria-label={t.row(point, count)}>
                    {bar}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
