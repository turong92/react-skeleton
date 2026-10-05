import { useId, type ReactNode } from 'react'
import styles from './SwitchRow.module.css'

export type SwitchRowProps = {
  title: ReactNode
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  invalid?: boolean
  /** 저장 중 — 잠그지 않고(포커스 유지) `aria-busy` 로만 알린다 */
  busy?: boolean
  /** 오류 · 잠김 이유 같은 바깥 설명의 id — 설명 id 뒤에 붙는다 */
  describedBy?: string
  id?: string
  className?: string
}

/**
 * 「제목 · 설명 … 스위치」 한 줄 — 줄 전체가 `<label>` 이라 어디를 눌러도 바뀐다.
 * 이름은 제목만(`aria-labelledby`), 설명은 `aria-describedby`. `role="switch"` 인 네이티브 체크박스라 Space · 포커스가 그대로 동작한다.
 * 제어 컴포넌트 — 즉시 적용 옵션에 쓰고(`Switch` 는 라벨이 스위치 옆에 붙는 작은 꼴), 폼으로 모아 보내는 선택은 `Checkbox`.
 */
export function SwitchRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  invalid,
  busy,
  describedBy,
  id: idProp,
  className,
}: SwitchRowProps) {
  const generated = useId()
  const id = idProp ?? generated
  const titleId = `${id}-title`
  const descriptionId = `${id}-description`
  const described = [description ? descriptionId : null, describedBy].filter(Boolean).join(' ')
  return (
    <label
      className={[styles.row, className].filter(Boolean).join(' ')}
      data-disabled={disabled ? 'true' : undefined}
    >
      <span className={styles.text}>
        <span id={titleId} className={styles.title}>
          {title}
        </span>
        {description && (
          <span id={descriptionId} className={styles.description}>
            {description}
          </span>
        )}
      </span>
      <input
        id={id}
        className={styles.input}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-labelledby={titleId}
        aria-describedby={described || undefined}
        aria-invalid={invalid ? true : undefined}
        aria-busy={busy ? true : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}
