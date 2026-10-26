import styles from './StatusNotice.module.css'

/** 숫자를 못 보여 줄 때의 안내 상자 - 문구는 `statusMessage` */
export function StatusNotice({ message }: { message: string }) {
  return (
    <div className={styles.notice} role="status">
      <p className={styles.text}>{message}</p>
    </div>
  )
}
