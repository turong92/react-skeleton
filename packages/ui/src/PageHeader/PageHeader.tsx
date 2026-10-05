import type { ReactNode } from 'react'
import styles from './PageHeader.module.css'

export type PageHeaderProps = {
  /** 화면의 `h1` — 화면마다 하나 */
  title: string
  description?: string
  /** 오른쪽 액션(보통 `<Button>` 들). 좁은 화면에서는 제목 아래로 내려온다 */
  actions?: ReactNode
  /** 제목 위 자리 — 돌아가기 링크 */
  back?: ReactNode
}

/** 화면의 첫 줄: 돌아가기 · 제목 · 설명 · 액션 */
export function PageHeader({ title, description, actions, back }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {back && <div className={styles.back}>{back}</div>}
      <div className={styles.row}>
        <div className={styles.text}>
          <h1>{title}</h1>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  )
}
