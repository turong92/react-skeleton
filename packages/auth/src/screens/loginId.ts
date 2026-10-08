import type { LoginIdProblem, LoginIdRules } from '../account/loginIdRules'
import type { AuthLabels } from './labels'

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
