import type { ReactNode } from 'react'
import styles from './RevisionPictures.module.css'

export type RevisionPictureLabels = {
  revisionPictures: string
  revisionPictureAdded: string
  revisionPictureRemoved: string
}

/** 고친 판의 첨부와 공개본의 첨부를 나란히 - 더해진 것 · 빠진 것을 표시한다. 둘 다 비어 있으면 아무것도 그리지 않는다 */
export function RevisionPictures({
  current,
  edited,
  render,
  labels,
}: {
  current: readonly string[]
  edited: readonly string[]
  render?: (key: string) => ReactNode
  labels: RevisionPictureLabels
}) {
  if (current.length === 0 && edited.length === 0) return null
  const rows = [
    ...edited.map((key) => ({ key, change: current.includes(key) ? 'kept' : 'added' }) as const),
    ...current
      .filter((key) => !edited.includes(key))
      .map((key) => ({ key, change: 'removed' }) as const),
  ]
  return (
    <>
      <dt>{labels.revisionPictures}</dt>
      <dd>
        <ul className={styles.list} data-testid="revision-pictures">
          {rows.map(({ key, change }) => (
            <li key={`${change}:${key}`} data-change={change} className={styles[change]}>
              {render ? render(key) : key}
              {change === 'added' && (
                <span className={styles.badge}>{labels.revisionPictureAdded}</span>
              )}
              {change === 'removed' && (
                <span className={styles.badge}>{labels.revisionPictureRemoved}</span>
              )}
            </li>
          ))}
        </ul>
      </dd>
    </>
  )
}
