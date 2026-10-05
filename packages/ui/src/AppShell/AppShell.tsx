import type { ReactNode } from 'react'
import styles from './AppShell.module.css'

export type AppShellProps = {
  brand?: ReactNode
  nav?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/** 헤더(브랜드 · 내비 · 액션) + 본문 + 선택 푸터. 라우터를 모른다 — 링크는 `brand` · `nav` 로 넘긴다 */
export function AppShell({ brand, nav, actions, footer, children }: AppShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>{brand}</div>
        <nav className={styles.nav}>{nav}</nav>
        <div className={styles.actions}>{actions}</div>
      </header>
      <main className={styles.main}>{children}</main>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  )
}
