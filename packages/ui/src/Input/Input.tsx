import type { InputHTMLAttributes } from 'react'
import styles from './Input.module.css'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** true 면 `aria-invalid` 와 오류 테두리 */
  invalid?: boolean
}

export function Input({ invalid, className, type = 'text', ...rest }: InputProps) {
  return (
    <input
      {...rest}
      type={type}
      className={[styles.input, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
    />
  )
}
