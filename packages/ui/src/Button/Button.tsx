import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '../Spinner/Spinner'
import styles from './Button.module.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` 채움(구역의 주된 행동 하나) · `secondary` · `ghost` 테두리 · `danger` 위험색 테두리 · `link` 글 사이의 링크처럼(밑줄) */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg'
  /** true 면 눌리지 않고 스피너를 보인다 */
  loading?: boolean
  /** 스피너의 낭독 이름(기본 `Loading`) */
  loadingLabel?: string
  /** 눌리지 않을 때(`disabled`) 왜 그런지 — 마우스 올리면 보이고 스크린 리더에도 읽힌다. 이유 없는 비활성은 피한다 */
  disabledReason?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
  disabledReason,
  type = 'button',
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={[styles.button, className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      title={disabled && disabledReason ? disabledReason : rest.title}
      aria-description={disabled ? disabledReason : undefined}
    >
      {loading && <Spinner label={loadingLabel} />}
      {children}
    </button>
  )
}
