import type { TextareaHTMLAttributes } from 'react'
import styles from './Textarea.module.css'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** true 면 `aria-invalid` 와 오류 테두리 */
  invalid?: boolean
}

/** 네이티브 `<textarea>` 에 입력칸과 같은 모양. `Field` 의 `control` 을 그대로 펼친다 */
export function Textarea({ invalid, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      rows={rows}
      className={[styles.textarea, className].filter(Boolean).join(' ')}
      aria-invalid={invalid || rest['aria-invalid'] || undefined}
    />
  )
}
