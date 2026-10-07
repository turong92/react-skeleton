import { useState } from 'react'
import type { AuthLabels } from './labels'

export type ConfirmProblem = 'missing' | 'mismatch' | null

/** 두 칸이 같은 글자인가 — 그대로 비교한다(공백 · 대소문자를 다듬지 않는다). 둘 다 비면 문제 없음(비밀번호 칸이 따로 말한다) */
export function confirmProblem(password: string, confirm: string): ConfirmProblem {
  if (password === confirm) return null
  return confirm === '' ? 'missing' : 'mismatch'
}

/** 오류를 보일 때 — 확인 칸을 건드렸거나 제출을 시도한 뒤에만(타이핑 중에 처음부터 빨갛게 하지 않는다) */
export function confirmVisible(state: {
  touched: boolean
  attempted: boolean
  problem: ConfirmProblem
}): boolean {
  return state.problem !== null && (state.touched || state.attempted)
}

export type PasswordConfirm = {
  /** 앱이 `confirmPassword={false}` 로 껐으면 false — 그러면 칸을 그리지 않고 제출도 막지 않는다 */
  enabled: boolean
  value: string
  setValue: (value: string) => void
  touch: () => void
  /** 칸 옆에 보일 오류(보일 때가 아니면 없음) */
  error?: string
  /** 틀렸을 때의 문구(오류 요약이 늘 쓴다) */
  message?: string
  /** 건드린 뒤 같다 — 「일치해요」 표시 */
  matches: boolean
  /** 제출을 막는가 */
  blocking: boolean
  /** 성공한 뒤 · 처음부터 다시 */
  reset: () => void
}

/** 비밀번호 확인 칸의 상태 — 화면 넷(가입 · 재설정 · 변경 · 첫 설정)이 같은 규칙을 쓴다. 확인 값은 API 로 보내지 않는다 */
export function usePasswordConfirm(options: {
  enabled: boolean
  password: string
  attempted: boolean
  labels: AuthLabels
}): PasswordConfirm {
  const { enabled, password, attempted, labels } = options
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const problem = enabled ? confirmProblem(password, value) : null
  const message =
    problem === 'missing'
      ? labels.passwordConfirmMissing
      : problem === 'mismatch'
        ? labels.passwordMismatch
        : undefined
  return {
    enabled,
    value,
    setValue,
    touch: () => setTouched(true),
    error: confirmVisible({ touched, attempted, problem }) ? message : undefined,
    message,
    matches: enabled && touched && value !== '' && problem === null,
    blocking: problem !== null,
    reset: () => {
      setValue('')
      setTouched(false)
    },
  }
}
