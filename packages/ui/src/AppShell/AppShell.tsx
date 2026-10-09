import { useEffect, useRef, type ReactNode } from 'react'
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
  const shell = useRef<HTMLDivElement>(null)
  const header = useRef<HTMLElement>(null)
  // 고정 머리의 실제 높이(좁은 화면에서는 줄이 감겨 커진다)를 `--header-height` 로 알린다 - 앵커로 가는 절이 `scroll-margin-top` 으로 머리 밑에서 멈춘다
  useEffect(() => {
    const el = header.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const publish = () =>
      shell.current?.style.setProperty('--header-height', `${el.offsetHeight}px`)
    publish()
    const watcher = new ResizeObserver(publish)
    watcher.observe(el)
    return () => watcher.disconnect()
  }, [])
  return (
    <div className={styles.shell} ref={shell}>
      <header className={styles.header} ref={header}>
        <div className={styles.brand}>{brand}</div>
        <nav className={styles.nav}>{nav}</nav>
        <div className={styles.actions}>{actions}</div>
      </header>
      <main className={styles.main}>{children}</main>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  )
}
