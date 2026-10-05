import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './Switch.module.css'

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  label: ReactNode
  /** 라벨 아래 설명. `aria-describedby` 로 이어진다 */
  description?: string
}

/** 켜짐/꺼짐 스위치 — `role="switch"` 를 단 네이티브 체크박스라 Space · 폼 제출 · 포커스가 그대로 동작한다 */
export function Switch({ label, description, className, ...rest }: SwitchProps) {
  const id = useId()
  const descriptionId = `${id}-description`
  const describedBy =
    [rest['aria-describedby'], description ? descriptionId : null].filter(Boolean).join(' ') ||
    undefined
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <label className={styles.row}>
        <input
          {...rest}
          type="checkbox"
          role="switch"
          className={styles.input}
          aria-describedby={describedBy}
        />
        <span>{label}</span>
      </label>
      {description && (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      )}
    </div>
  )
}
