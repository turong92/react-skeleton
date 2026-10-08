import type { LoginIdRules } from '../account/loginIdRules'
import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import type { AuthLabels } from './labels'
import { loginIdServerError } from './loginIdServerError'

/** 「정하기」가 서버에서 어떻게 끝났는가 — 칸 옆 오류 · 다른 탭에서 이미 정했다 · 그 밖(화면의 오류 줄이 말한다) */
export type LoginIdSubmitOutcome =
  | { kind: 'field'; message: string }
  | { kind: 'already-set' }
  | { kind: 'other' }

export function loginIdSubmitOutcome(
  error: unknown,
  context: { value: string; rules: LoginIdRules; labels: AuthLabels },
): LoginIdSubmitOutcome {
  if (isErrorCode(error, ErrorCodes.ACCOUNT_LOGIN_ID_ALREADY_SET)) return { kind: 'already-set' }
  const message = loginIdServerError(error, context)
  return message ? { kind: 'field', message } : { kind: 'other' }
}
