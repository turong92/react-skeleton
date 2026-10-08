import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { loginIdProblem, type LoginIdRules } from '../account/loginIdRules'
import type { AuthLabels } from './labels'
import { loginIdProblemText } from './loginId'

/**
 * 서버가 아이디에 대해 돌려준 오류(`409 ACCOUNT.LOGIN_ID_TAKEN` · `400` 의 `errors[].field = "loginId"`)를 우리 문구로 - 칸 옆 오류(`LoginIdField` 의 `serverError`)에 꽂는다.
 * 서버의 영어 message 는 보이지 않는다. 아이디 오류가 아니면 undefined.
 * `Pattern` 은 서버가 맨 앞뒤 기호 · 숫자만 · 쓸 수 없는 글자를 구분하지 않으므로, 보낸 값을 클라이언트 규칙으로 다시 보고 문구를 고른다.
 */
export function loginIdServerError(
  error: unknown,
  { value, rules, labels }: { value: string; rules: LoginIdRules; labels: AuthLabels },
): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined
  if (error.apiError.code === ErrorCodes.ACCOUNT_LOGIN_ID_TAKEN) return labels.errorLoginIdTaken
  const field = error.apiError.errors?.find((e) => e.field === 'loginId')
  if (!field) return undefined
  switch (field.code) {
    case 'Required':
      return labels.problemLoginIdMissing
    case 'Size':
      return labels.problemLoginIdSize(rules.minLength, rules.maxLength)
    default: {
      const problem = loginIdProblem(value, rules)
      return problem && problem !== 'missing' && problem !== 'size'
        ? loginIdProblemText(problem, rules, labels)
        : labels.problemLoginIdChars
    }
  }
}
