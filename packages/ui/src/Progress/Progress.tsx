import styles from './Progress.module.css'

export type ProgressProps = {
  /** 낭독 이름(필수) — 무엇의 진행률인가 */
  label: string
  /** 0~1. 없으면 끝을 모르는 진행(움직이는 막대) */
  value?: number
  /** 막대 옆에 보이는 글자(예: `42%`) */
  valueText?: string
}

/** 진행률 막대 — 네이티브 `<progress>` */
export function Progress({ label, value, valueText }: ProgressProps) {
  const clamped = value === undefined ? undefined : Math.min(1, Math.max(0, value))
  return (
    <div className={styles.root}>
      <progress className={styles.bar} aria-label={label} value={clamped} max={1} />
      {valueText && <span className={styles.text}>{valueText}</span>}
    </div>
  )
}
