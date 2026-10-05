import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import styles from './LinkButton.module.css'

/** 버튼 모양의 **링크**(`<a>`) — 어딘가로 가는 행동은 버튼이 아니라 링크다(새 탭 · 복사 · 읽기 프로그램의 링크 목록이 그대로 된다). 모양은 `Button` 의 것을 따른다 */
export function LinkButton({
  to,
  variant = 'primary',
  children,
}: {
  to: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'inverse'
  children: ReactNode
}) {
  return (
    <Link to={to} className={styles.link} data-variant={variant}>
      {children}
    </Link>
  )
}
