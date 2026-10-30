import { useId } from 'react'
import type { ReviewsLabels } from './labels'
import { RATINGS, type Rating } from './types'
import styles from './RatingInput.module.css'

export type RatingInputProps = {
  value: Rating | null
  onChange: (rating: Rating) => void
  labels: Pick<ReviewsLabels, 'rating'>
  disabled?: boolean
  invalid?: boolean
  /** 묶음 이름(보이는 글자). 기본 「별점」 */
  legend?: string
  /** 오류 문장 칸의 id */
  describedBy?: string
}

/**
 * 별점 고르기 — 진짜 라디오 다섯 개의 묶음(`fieldset`). Tab 은 묶음에 한 번 멈추고 화살표가 고른 점수를 옮긴다(브라우저가 한다).
 * 칸마다 테두리가 있어 눌리는 것으로 보이고, 고른 점수까지 별이 차며 이름(「3점」)은 읽는 프로그램에도 간다.
 */
export function RatingInput({
  value,
  onChange,
  labels,
  disabled = false,
  invalid = false,
  legend = labels.rating.group,
  describedBy,
}: RatingInputProps) {
  const name = useId()
  return (
    <fieldset
      className={styles.group}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    >
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.row}>
        {RATINGS.map((point) => {
          const filled = value !== null && point <= value
          return (
            <label key={point} className={styles.choice} data-filled={filled}>
              <input
                type="radio"
                name={name}
                value={point}
                checked={value === point}
                disabled={disabled}
                className={styles.input}
                onChange={() => onChange(point)}
              />
              <span aria-hidden="true" className={styles.star}>
                ★
              </span>
              <span className={styles.name}>{labels.rating.point(point)}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
