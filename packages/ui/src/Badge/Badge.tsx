import type { HTMLAttributes } from 'react'
import styles from './Badge.module.css'

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
}

/** 상태 알약 — 뜻은 글자로 전하고 색은 거든다 */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={[styles.badge, className].filter(Boolean).join(' ')}
      data-tone={tone}
    />
  )
}
