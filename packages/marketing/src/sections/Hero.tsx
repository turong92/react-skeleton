import { createElement, useId, type ReactNode } from 'react'
import styles from './sections.module.css'

export type HeroProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  /** 오른쪽(좁으면 아래)의 그림 · 화면 캡처 */
  media?: ReactNode
  /** 제목 단계(기본 1 — 페이지에 이미 `h1` 이 있으면 2) */
  headingLevel?: 1 | 2
}

/** 랜딩의 첫 구역 — 한 줄 약속 + 한두 개의 행동. 제목이 이 페이지의 `h1` */
export function Hero({
  eyebrow,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  media,
  headingLevel = 1,
}: HeroProps) {
  const id = useId()
  return (
    <section className={styles.hero} aria-labelledby={id} data-media={media ? 'true' : undefined}>
      <div className={styles.heroText}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        {createElement(`h${headingLevel}`, { id, className: styles.heroTitle }, title)}
        {subtitle && <p className={styles.lead}>{subtitle}</p>}
        {(primaryAction || secondaryAction) && (
          <div className={styles.actions}>
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </div>
      {media && <div className={styles.media}>{media}</div>}
    </section>
  )
}
