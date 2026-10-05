import styles from './Spinner.module.css'

export type SpinnerProps = {
  /** 화면 낭독기용 이름(기본 `Loading`) */
  label?: string
  className?: string
}

export function Spinner({ label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" className={[styles.spinner, className].filter(Boolean).join(' ')}>
      <span className={styles.ring} aria-hidden="true" />
      <span className={styles.label}>{label}</span>
    </span>
  )
}
