import { useRef, type ReactNode } from 'react'
import { Button } from '../Button/Button'
import { nextChoiceIndex } from './choiceKeys'
import styles from './ChoiceGroup.module.css'

export type ChoiceOption = { value: string; label: ReactNode }

export type ChoiceGroupProps = {
  options: readonly ChoiceOption[]
  /** 고른 칸의 `value`. 아무것도 안 골랐으면 `null` */
  value: string | null
  onChange: (value: string) => void
  /** 잠그면(예: 결제창을 여는 중) 고를 수 없다 — 읽기 프로그램에는 그대로 남는다(`aria-disabled`) */
  disabled?: boolean
  /** 묶음의 이름 — 둘 중 하나는 있어야 한다. 화면에 보이는 제목이 있으면 `aria-labelledby` 로 이어 같은 글이 두 번 읽히지 않게 */
  'aria-label'?: string
  'aria-labelledby'?: string
}

/**
 * **하나만 고르는** 선택지 묶음(금액 · 크기 · 주기 …) — WAI-ARIA radio group. 칸마다 보조 `Button` 이라 쉬는 상태에서도 테두리가 있어 눌리는 것으로 보이고,
 * 고른 칸은 테두리 · 바탕 · 안쪽 선 · 체크(✓)로 분명하다(색만으로 말하지 않는다). Tab 은 묶음에 한 번 멈추고(고른 칸, 없으면 첫 칸),
 * 화살표 · Home · End 가 고른 칸을 옮기며 포커스가 따라간다.
 */
export function ChoiceGroup({
  options,
  value,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: ChoiceGroupProps) {
  const group = useRef<HTMLDivElement>(null)
  // 아무것도 고르지 않았으면 첫 칸이 Tab 이 닿는 자리
  const stop = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  )

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      className={styles.group}
    >
      {options.map((option, index) => {
        const checked = option.value === value
        return (
          <Button
            key={option.value}
            variant="secondary"
            role="radio"
            aria-checked={checked}
            aria-disabled={disabled || undefined}
            tabIndex={index === stop ? 0 : -1}
            className={styles.choice}
            onClick={disabled ? undefined : () => onChange(option.value)}
            onKeyDown={(event) => {
              const next = disabled ? null : nextChoiceIndex(event.key, index, options.length)
              if (next === null) return
              event.preventDefault()
              const target = options[next]
              if (target) onChange(target.value)
              group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
            }}
          >
            {checked && (
              <span className={styles.check} aria-hidden="true">
                ✓
              </span>
            )}
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
