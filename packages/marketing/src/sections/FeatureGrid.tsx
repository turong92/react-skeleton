import { createElement, useId, type ReactNode } from 'react'
import styles from './sections.module.css'

export type Feature = { id: string; title: string; description: string; icon?: ReactNode }

export type FeatureGridProps = {
  title?: string
  subtitle?: string
  features: Feature[]
  /** 구역 제목 단계(기본 2) — 각 기능 제목은 그 다음 단계 */
  headingLevel?: 2 | 3
}

/** 기능 소개 격자 — 목록, 기능마다 제목 + 설명(+ 장식 아이콘). 칸 수는 화면 너비가 정한다 */
export function FeatureGrid({ title, subtitle, features, headingLevel = 2 }: FeatureGridProps) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={title ? id : undefined}>
      {(title || subtitle) && (
        <header className={styles.sectionHead}>
          {title &&
            createElement(`h${headingLevel}`, { id, className: styles.sectionTitle }, title)}
          {subtitle && <p className={styles.lead}>{subtitle}</p>}
        </header>
      )}
      <ul className={styles.grid}>
        {features.map((feature) => (
          <li key={feature.id} className={styles.feature}>
            {feature.icon && (
              <span className={styles.icon} aria-hidden="true">
                {feature.icon}
              </span>
            )}
            {createElement(
              `h${headingLevel + 1}`,
              { className: styles.featureTitle },
              feature.title,
            )}
            <p className={styles.featureText}>{feature.description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
