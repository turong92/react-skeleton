import type { LoginIdProblem, LoginIdRules } from '../account/loginIdRules'
import type { AuthLabels } from './labels'
import type { LoginIdCheck } from './useLoginIdAvailability'

/** 규칙 함수가 돌려준 문제의 종류를 우리 문구로 — 길이 문구에는 서버가 알려 준 범위가 들어간다 */
export function loginIdProblemText(
  problem: LoginIdProblem,
  rules: LoginIdRules,
  labels: AuthLabels,
): string {
  switch (problem) {
    case 'missing':
      return labels.problemLoginIdMissing
    case 'size':
      return labels.problemLoginIdSize(rules.minLength, rules.maxLength)
    case 'chars':
      return labels.problemLoginIdChars
    case 'symbols':
      return labels.problemLoginIdSymbols
    case 'digitsOnly':
      return labels.problemLoginIdDigitsOnly
  }
}

/** 칸에 보일 오류 글자 — 서버 오류 → 「쓸 수 없다」 → (칸을 벗어난 뒤) 형식 오류. 부모의 오류 요약(`FormProblems`)도 이걸 쓴다 */
export function loginIdFieldError(
  check: LoginIdCheck,
  rules: LoginIdRules,
  labels: AuthLabels,
  serverError?: string,
): string | undefined {
  if (serverError) return serverError
  if (!check.showError) return undefined
  if (check.status === 'taken') return labels.errorLoginIdTaken
  return check.problem ? loginIdProblemText(check.problem, rules, labels) : undefined
}
