import { useEffect, useRef, type RefObject } from 'react'

export type Step = 'idle' | 'entering' | 'code'

/** 단계가 바뀌면 포커스가 사라지지 않게: 입력 단계는 주소 칸, 인증번호 단계는 첫 칸, 끝나면 이 구역의 첫 단추. 처음 그릴 때는 건드리지 않는다(같은 단계에서 효과가 다시 돌아도 마찬가지) */
export function useStepFocus(
  step: Step,
  fieldId: string,
  actions: RefObject<HTMLDivElement | null>,
  codeBox: RefObject<HTMLDivElement | null>,
) {
  const seenStep = useRef<Step>('idle')
  useEffect(() => {
    if (seenStep.current === step) return
    seenStep.current = step
    if (step === 'entering') document.getElementById(fieldId)?.focus()
    if (step === 'idle') actions.current?.querySelector<HTMLButtonElement>('button')?.focus()
    if (step === 'code')
      codeBox.current
        ?.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')
        ?.focus()
  }, [step, fieldId, actions, codeBox])
}
