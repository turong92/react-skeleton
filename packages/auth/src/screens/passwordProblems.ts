import type { FormProblem } from '@skeleton/ui'
import { passwordRequirements } from '../account/passwordRules'
import type { PasswordPolicy } from '../account/types'
import type { AuthLabels } from './labels'
import type { PasswordConfirm } from './passwordConfirm'

/**
 * 새 비밀번호 칸 둘이 제출을 막는 이유 — 비었다 · 정책을 못 지켰다(어느 규칙인지는 체크리스트가 말한다) · 확인이 다르다.
 * `problems` 는 오류 요약의 줄(칸의 순서), `passwordError` 는 비밀번호 칸 옆에 보일 오류. 정책을 아직 못 받았으면 규칙은 따지지 않는다.
 */
export function passwordProblems(options: {
  labels: AuthLabels
  password: string
  email?: string
  policy?: PasswordPolicy
  confirm: Pick<PasswordConfirm, 'enabled' | 'blocking' | 'message'>
  ids: { password: string; confirm: string }
}): { passwordError?: string; problems: FormProblem[] } {
  const { labels, password, email, policy, confirm, ids } = options
  const rulesUnmet = !!policy && passwordRequirements(policy, password, email).some((r) => !r.met)
  const passwordError = !password
    ? labels.problemPasswordMissing
    : rulesUnmet
      ? labels.problemPasswordRules
      : undefined
  return {
    passwordError,
    problems: [
      ...(passwordError ? [{ key: 'password', message: passwordError, target: ids.password }] : []),
      ...(confirm.enabled && confirm.blocking && confirm.message
        ? [{ key: 'confirm', message: confirm.message, target: ids.confirm }]
        : []),
    ],
  }
}
