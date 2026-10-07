import { Card } from '@skeleton/ui'
import { useEffect, useRef, type ReactNode } from 'react'
import styles from './auth.module.css'

export type AuthLayoutProps = {
  title: string
  subtitle?: string
  children: ReactNode
  /** 카드 아래 한 줄(「계정이 없나요?」 …) */
  footer?: ReactNode
  /** 설정처럼 넓은 화면 */
  wide?: boolean
  /** 마운트될 때 제목으로 포커스 — 같은 자리에서 화면이 통째로 바뀔 때(로그인 → 「탈퇴를 취소할까요?」) 포커스가 사라지지 않게 */
  focusTitle?: boolean
}

/** 인증 화면의 공통 틀 — 가운데 한 열, `h1`, 카드. 화면마다 한 번 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  wide,
  focusTitle,
}: AuthLayoutProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusTitle) heading.current?.focus()
  }, [focusTitle])
  return (
    <div className={[styles.page, wide && styles.wide].filter(Boolean).join(' ')}>
      <div className={styles.intro}>
        <h1 ref={heading} tabIndex={focusTitle ? -1 : undefined}>
          {title}
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <Card>{children}</Card>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
