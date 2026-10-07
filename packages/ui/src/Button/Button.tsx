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
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel,
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
    >
      {loading && <Spinner label={loadingLabel} />}
      {children}
    </button>
  )
}
