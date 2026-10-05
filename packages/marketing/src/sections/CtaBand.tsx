import { createElement, useId, type ReactNode } from 'react'
import styles from './sections.module.css'

export type CtaBandProps = {
  title: string
  description?: string
  /** 하나의 행동 — 보통 가입 버튼 */
  action: ReactNode
  headingLevel?: 2 | 3
}

/** 페이지 끝의 마지막 권유 — 한 문장 + 버튼 하나 */
export function CtaBand({ title, description, action, headingLevel = 2 }: CtaBandProps) {
  const id = useId()
  return (
    <section className={styles.cta} aria-labelledby={id}>
      <div className={styles.ctaText}>
        {createElement(`h${headingLevel}`, { id, className: styles.sectionTitle }, title)}
        {description && <p className={styles.lead}>{description}</p>}
      </div>
      <div className={styles.actions}>{action}</div>
    </section>
  )
}
