import type { ReviewsLabels } from './labels'
import { formatAverage, starFills } from './ratingMath'
import styles from './RatingStars.module.css'

export type RatingStarsProps = {
  /** 평점. 아직 리뷰가 없으면 `null` */
  value: number | null
  max?: number
  /** 별 옆에 숫자(`4.3`)도 쓴다 */
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  labels: Pick<ReviewsLabels, 'rating'>
  locale?: string
}

/** 별점 표시 — 별은 모두 장식이고, 읽는 이름은 「5점 만점에 4.3점」 하나 */
export function RatingStars({
  value,
  max = 5,
  showValue = false,
  size = 'md',
  labels,
  locale,
}: RatingStarsProps) {
  const fills = starFills(value ?? 0, max)
  const spoken =
    value === null
      ? labels.rating.none
      : labels.rating.outOf(Number.isInteger(value) ? String(value) : value.toFixed(1), max)
  return (
    <span className={styles.root} data-size={size}>
      <span role="img" aria-label={spoken} className={styles.stars}>
        {fills.map((fill, index) => (
          <span key={index} aria-hidden="true" className={styles.star}>
            <span className={styles.fill} style={{ inlineSize: `${fill * 100}%` }}>
              ★
            </span>
            ★
          </span>
        ))}
      </span>
      {showValue && value !== null && (
        <span className={styles.value}>{formatAverage(value, locale)}</span>
      )}
    </span>
  )
}
