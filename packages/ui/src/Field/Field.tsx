import { useId, type ReactNode } from 'react'
import styles from './Field.module.css'

export type FieldControlProps = {
  id: string
  'aria-describedby'?: string
  invalid: boolean
}

export type FieldProps = {
  label: string
  hint?: string
  error?: string
  required?: boolean
  /** 칸의 `id` 를 정한다(기본은 자동) — 오류 요약이 이 칸으로 데려갈 수 있게 */
  id?: string
  /** 필수 표시 글자(기본 `*`) */
  requiredMark?: string
  /** 입력 부품에 펼쳐 준다: `{(control) => <Input {...control} />}` */
  children: (control: FieldControlProps) => ReactNode
}

/** 라벨 · 도움말 · 오류를 입력 부품에 `id` / `aria-describedby` / `invalid` 로 이어 준다 */
export function Field({
  label,
  hint,
  error,
  required,
  id: given,
  requiredMark = '*',
  children,
}: FieldProps) {
  const generated = useId()
  const id = given ?? generated
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required}>{requiredMark}</span>}
      </label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        invalid: Boolean(error),
      })}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
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
