import { createElement, useId, type ReactNode } from 'react'
import styles from './sections.module.css'

export type FaqItem = { id: string; question: string; answer: ReactNode }

export type FaqAccordionProps = {
  title?: string
  items: FaqItem[]
  /** true 면 하나를 열면 나머지가 닫힌다(같은 `name` 의 `<details>`) */
  exclusive?: boolean
  /** 처음에 열어 둘 항목 */
  defaultOpenId?: string
  headingLevel?: 2 | 3
}

/** 자주 묻는 질문 — 네이티브 `<details>` · `<summary>`(스크립트 없이 열리고 닫히며 Enter · Space · 읽기 프로그램이 알아서 된다) */
export function FaqAccordion({
  title,
  items,
  exclusive,
  defaultOpenId,
  headingLevel = 2,
}: FaqAccordionProps) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={title ? id : undefined}>
      {title && (
        <header className={styles.sectionHead}>
          {createElement(`h${headingLevel}`, { id, className: styles.sectionTitle }, title)}
        </header>
      )}
      <div className={styles.faq}>
        {items.map((item) => (
          <details
            key={item.id}
            className={styles.faqItem}
            name={exclusive ? id : undefined}
            open={item.id === defaultOpenId ? true : undefined}
          >
            <summary className={styles.question}>{item.question}</summary>
            <div className={styles.answer}>{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
