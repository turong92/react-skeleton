import { Card } from '@skeleton/ui'
import type { ReactNode } from 'react'
import styles from './auth.module.css'

export type AuthLayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
  /** 카드 아래 한 줄(「계정이 없나요?」 …) */
  footer?: ReactNode
  /** 설정처럼 넓은 화면 */
  wide?: boolean
}

/** 인증 화면의 공통 틀 — 가운데 한 열, `h1`, 카드. 화면마다 한 번 */
export function AuthLayout({ title, subtitle, children, footer, wide }: AuthLayoutProps) {
  return (
    <div className={[styles.page, wide && styles.wide].filter(Boolean).join(' ')}>
      <div className={styles.intro}>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <Card>{children}</Card>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
