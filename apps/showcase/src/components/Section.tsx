import type { ReactNode } from 'react'
import styles from './Section.module.css'

/** 데모 한 덩어리 — 짧은 제목 · 복사해 쓰는 import 줄 · 본문 */
export function Section({
  id,
  title,
  importLine,
  children,
  level = 2,
}: {
  id?: string
  title: string
  importLine?: string
  children: ReactNode
  level?: 2 | 3
}) {
  const Heading = `h${level}` as const
  return (
    <section id={id} className={styles.section} aria-labelledby={id ? `${id}-title` : undefined}>
      <Heading id={id ? `${id}-title` : undefined} className={styles.title}>
        {title}
      </Heading>
      {importLine && (
        <pre className={styles.code} aria-label={`${title} import`}>
          <code>{importLine}</code>
        </pre>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  )
}

/** 한 상태의 이름표 + 그 상태의 모습 */
export function Case({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.case}>
      <span className={styles.caseLabel}>{label}</span>
      <div className={styles.caseBody}>{children}</div>
    </div>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>
}
