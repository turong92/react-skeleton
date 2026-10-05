import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './Checkbox.module.css'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  /** 상자 옆 글자 — 글자를 눌러도 토글된다(`<label>` 안에 있다) */
  label: ReactNode
  /** 라벨 아래 설명. `aria-describedby` 로 이어진다 */
  description?: string
  /** 오류 문구. `role="alert"` + `aria-invalid` */
  error?: string
  /** 일부만 선택된 상태(전체 선택 상자). 낭독기에는 `aria-checked="mixed"` */
  indeterminate?: boolean
}

/** 네이티브 체크박스 — 키보드(Space) · 폼 제출 · 포커스를 브라우저가 한다. 색은 `accent-color`(의미 토큰) */
export function Checkbox({
  label,
  description,
  error,
  indeterminate,
  className,
  ...rest
}: CheckboxProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const describedBy =
    [rest['aria-describedby'], error ? errorId : null, description ? descriptionId : null]
      .filter(Boolean)
      .join(' ') || undefined
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <label className={styles.row}>
        <input
          {...rest}
          type="checkbox"
          className={styles.input}
          aria-describedby={describedBy}
          aria-invalid={error ? true : rest['aria-invalid']}
          aria-checked={indeterminate ? 'mixed' : undefined}
          ref={(element) => {
            // `indeterminate` 는 속성이 아니라 DOM 프로퍼티다
            if (element) element.indeterminate = Boolean(indeterminate)
          }}
        />
        <span>{label}</span>
      </label>
      {description && (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}
