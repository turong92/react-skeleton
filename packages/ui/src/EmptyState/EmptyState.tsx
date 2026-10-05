import { createElement, type ReactNode } from 'react'
import styles from './EmptyState.module.css'

export type EmptyStateProps = {
  title: string
  description?: string
  /** 장식 아이콘(낭독기에서 숨긴다) */
  icon?: ReactNode
  /** 다음에 할 일 — 보통 `<Button>` */
  action?: ReactNode
  /** 제목 단계(기본 3) — 페이지 개요에 맞춘다 */
  headingLevel?: 2 | 3 | 4
}

/** 비어 있는 목록 · 표 · 검색 결과 자리 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  headingLevel = 3,
}: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      {createElement(`h${headingLevel}`, { className: styles.title }, title)}
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
