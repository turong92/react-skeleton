import { ThemeToggle } from '@skeleton/theme'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { packageSections } from '../demos/packageSections'
import { ShowcaseProviders } from '../ShowcaseProviders'
import styles from './ShowcaseLayout.module.css'

const link = ({ isActive }: { isActive: boolean }) => (isActive ? styles.active : undefined)

function Main() {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const shown = useRef(pathname)
  // 화면을 옮기면 본문으로 포커스를 옮긴다(키보드 · 낭독기 사용자가 내비에 갇히지 않게). 처음 그릴 때는 건드리지 않는다
  // (StrictMode 가 effect 를 두 번 돌려도 같은 경로면 아무것도 안 한다)
  useEffect(() => {
    if (shown.current === pathname) return
    shown.current = pathname
    ref.current?.focus()
  }, [pathname])
  return (
    <main id="main" ref={ref} tabIndex={-1} className={styles.main}>
      <Outlet />
    </main>
  )
}

export function ShowcaseLayout() {
  return (
    <ShowcaseProviders>
      <a href="#main" className={styles.skip}>
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          <strong>skeleton showcase</strong>
        </Link>
        <ThemeToggle />
      </header>
      <div className={styles.body}>
        <nav aria-label="섹션" className={styles.nav}>
          <ul>
            <li>
              <NavLink to="/" end className={link}>
                개요
              </NavLink>
            </li>
            <li>
              <NavLink to="/ui" className={link}>
                UI 부품
              </NavLink>
            </li>
            <li>
              <NavLink to="/tokens" className={link}>
                디자인 토큰
              </NavLink>
            </li>
          </ul>
          <h2 className={styles.group}>패키지</h2>
          <ul>
            {packageSections.map((section) => (
              <li key={section.slug}>
                <NavLink to={`/packages/${section.slug}`} end className={link}>
                  {section.pkg.replace('@skeleton/', '')}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <Main />
      </div>
    </ShowcaseProviders>
  )
}
