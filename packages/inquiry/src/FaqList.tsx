import type { ReactNode } from 'react'
import styles from './FaqList.module.css'

export type FaqItem = {
  id: string
  question: string
  answer: ReactNode
}

export type FaqSection = {
  id: string
  title: string
  items: FaqItem[]
}

export type FaqListProps = {
  sections: FaqSection[]
}

/**
 * 자주 묻는 질문 접기 목록 — 갈래 제목(h2) 아래 질문마다 네이티브 `<details>` 한 줄(눌러서 답을 편다, 처음엔 모두 접힘, 키보드 · 낭독이 기본으로 된다).
 * 질문 · 답은 앱이 정한다 — 이 부품은 문구도 앱 개념도 모른다
 */
export function FaqList({ sections }: FaqListProps) {
  return (
    <div className={styles.list}>
      {sections.map((section) => (
        <section key={section.id} className={styles.section} aria-labelledby={`faq-${section.id}`}>
          <h2 id={`faq-${section.id}`} className={styles.heading}>
            {section.title}
          </h2>
          <div className={styles.items}>
            {section.items.map((item) => (
              <details key={item.id} className={styles.item}>
                <summary className={styles.question}>{item.question}</summary>
                <div className={styles.answer}>{item.answer}</div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
