import type { SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean
}

/** 네이티브 `<select>` 에 입력칸과 같은 모양. 옵션은 `<option>` 자식으로 넘긴다 */
export function Select({ invalid, className, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className={[styles.select, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
    />
  )
}
