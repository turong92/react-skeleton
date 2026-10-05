import type { ReactNode } from 'react'
import styles from './Stepper.module.css'
import { stepStatus, type StepStatus } from './stepStatus'

export type StepperStep = {
  id: string
  label: string
  description?: string
}

export type StepperProps = {
  /** 목록의 이름(필수) — 무엇의 단계인가 */
  label: string
  steps: StepperStep[]
  /** 지금 단계의 0 기반 순번 */
  current: number
  /** 색에만 기대지 않게 낭독되는 상태 말(기본 영어) */
  statusLabels?: Record<StepStatus, string>
  /** 있으면 끝낸 단계가 버튼이 되어 거기로 돌아갈 수 있다 */
  onStepSelect?: (index: number, step: StepperStep) => void
}

const DEFAULT_STATUS: Record<StepStatus, string> = {
  complete: 'Completed',
  current: 'Current step',
  upcoming: 'Not started',
}

/** 여러 단계 폼의 머리 — 순서 목록, 지금 단계는 `aria-current="step"`, 상태는 글자로도 낭독된다 */
export function Stepper({
  label,
  steps,
  current,
  statusLabels = DEFAULT_STATUS,
  onStepSelect,
}: StepperProps) {
  return (
    <ol className={styles.list} aria-label={label}>
      {steps.map((step, index) => {
        const status = stepStatus(index, current)
        const marker: ReactNode = status === 'complete' ? '✓' : index + 1
        const content = (
          <>
            <span className={styles.marker} aria-hidden="true">
              {marker}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{step.label}</span>
              {step.description && <span className={styles.description}>{step.description}</span>}
              <span className={styles.srOnly}>{statusLabels[status]}</span>
            </span>
          </>
        )
        return (
          <li
            key={step.id}
            className={styles.step}
            data-status={status}
            aria-current={status === 'current' ? 'step' : undefined}
          >
            {onStepSelect && status === 'complete' ? (
              <button
                type="button"
                className={styles.button}
                onClick={() => onStepSelect(index, step)}
              >
                {content}
              </button>
            ) : (
              <div className={styles.static}>{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
