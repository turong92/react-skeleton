import type { ReactNode } from 'react'
import styles from './Stat.module.css'

export type StatProps = {
  label: string
  value: ReactNode
  /** 숫자 아래 보조 설명 */
  hint?: string
  tone?: 'neutral' | 'accent' | 'warning'
}

/** 대시보드의 숫자 한 칸 — 낭독기에는 「라벨, 값, 설명」 순으로 읽힌다 */
export function Stat({ label, value, hint, tone = 'neutral' }: StatProps) {
  return (
    <dl className={styles.stat} data-tone={tone}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
      {hint && <dd className={styles.hint}>{hint}</dd>}
    </dl>
  )
}
