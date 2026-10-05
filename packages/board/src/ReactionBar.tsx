import { Button } from '@skeleton/ui'
import type { ReactNode } from 'react'
import { reactionCount } from './reactions'
import type { ReactionType } from './types'
import styles from './ReactionBar.module.css'

export type ReactionBarProps = {
  /** 그릴 종류 — 서버 설정(`BoardConfig.reactionTypes`)이 알려 준 코드 그대로. 여기에 없는 종류는 그리지 않는다 */
  types: readonly ReactionType[]
  /** 종류별 개수(없으면 0) */
  counts: Record<ReactionType, number>
  /** 내가 누른 종류들 */
  mine: readonly ReactionType[]
  /** 눌렀을 때 — `active` 는 누른 뒤의 상태(안 눌렀으면 true, 눌렀던 것이면 false) */
  onToggle: (type: ReactionType, active: boolean) => void
  /** 코드 → 보이는 글자(`{ EMPATHY: '공감' }`). 맵에 없는 코드는 코드 자체가 글자 */
  labels?: Partial<Record<ReactionType, string>>
  /** 코드 → 아이콘(장식이라 낭독기에서는 숨긴다). 없으면 글자만 */
  icons?: Partial<Record<ReactionType, ReactNode>>
  /** 묶음의 낭독 이름(기본 `Reactions`) */
  groupLabel?: string
  disabled?: boolean
}

/**
 * 반응 줄 — 종류마다 켜고 끄는 단추(`aria-pressed`) + 개수. 어떤 종류가 있는지는 서버가 알려 주므로
 * 이 부품은 종류를 모른다: `labels` · `icons` 맵만 주면 새 종류(공감 …)가 코드 변경 없이 보인다.
 */
export function ReactionBar({
  types,
  counts,
  mine,
  onToggle,
  labels,
  icons,
  groupLabel = 'Reactions',
  disabled,
}: ReactionBarProps) {
  return (
    <div role="group" aria-label={groupLabel} className={styles.bar}>
      {types.map((type) => {
        const pressed = mine.includes(type)
        const icon = icons?.[type]
        return (
          <Button
            key={type}
            size="sm"
            variant={pressed ? 'primary' : 'secondary'}
            aria-pressed={pressed}
            data-reaction={type}
            disabled={disabled}
            onClick={() => onToggle(type, !pressed)}
          >
            {icon !== undefined && (
              <span aria-hidden="true" className={styles.icon}>
                {icon}
              </span>
            )}
            <span>{labels?.[type] ?? type}</span>
            <span className={styles.count}>{reactionCount(counts, type)}</span>
          </Button>
        )
      })}
    </div>
  )
}
