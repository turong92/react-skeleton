import { ApiRequestError, ErrorCodes, retryAfterSeconds } from '@skeleton/api-client'
import { PkceUnavailableError } from '../pkce'
import type { AuthLabels } from './labels'

export type AuthErrorInfo = {
  message: string
  /** 백엔드 코드(분기용) — 없으면 `ApiRequestError` 가 아니다 */
  code?: string
  /** 429 가 알려 준 기다릴 시간 — 화면이 카운트다운에 쓴다 */
  retryAfterSeconds?: number
  /** 예상 밖 실패에만 — 지원에 말해 줄 참조 번호(traceId) */
  reference?: string
}

/** 코드 → 문구. 화면이 한 곳에서 같은 말을 하도록 모은다 */
const byCode = (labels: AuthLabels): Record<string, string> => ({
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: labels.errorInvalidCredentials,
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: labels.errorEmailNotVerified,
  [ErrorCodes.AUTH_ACCOUNT_SUSPENDED]: labels.errorSuspended,
  [ErrorCodes.ACCOUNT_TOKEN_INVALID]: labels.errorTokenInvalid,
  [ErrorCodes.ACCOUNT_EMAIL_TAKEN]: labels.errorEmailTaken,
  [ErrorCodes.ACCOUNT_SIGN_UP_CLOSED]: labels.errorSignUpClosed,
  [ErrorCodes.ACCOUNT_CAPTCHA_FAILED]: labels.errorCaptcha,
  [ErrorCodes.ACCOUNT_CURRENT_PASSWORD_INVALID]: labels.errorCurrentPassword,
  [ErrorCodes.ACCOUNT_REAUTH_FAILED]: labels.errorReauth,
  [ErrorCodes.ACCOUNT_REAUTH_REQUIRED]: labels.errorReauthRequired,
  [ErrorCodes.ACCOUNT_LAST_SIGN_IN_METHOD]: labels.errorLastMethod,
  [ErrorCodes.ACCOUNT_LAST_ADMIN]: labels.errorLastAdmin,
  [ErrorCodes.ACCOUNT_SELF_ACTION_FORBIDDEN]: labels.errorSelfAction,
  [ErrorCodes.ACCOUNT_IDENTITY_TAKEN]: labels.errorIdentityTaken,
  [ErrorCodes.ACCOUNT_IDENTITY_EXISTS]: labels.errorIdentityExists,
  [ErrorCodes.ACCOUNT_SOCIAL_EMAIL_CONFLICT]: labels.errorSocialConflict,
  [ErrorCodes.AUTH_SOCIAL_PKCE_FAILED]: labels.errorSocialRequest,
  [ErrorCodes.AUTH_SOCIAL_NONCE_FAILED]: labels.errorSocialRequest,
  [ErrorCodes.AUTH_SOCIAL_ID_TOKEN_INVALID]: labels.errorSocialCode,
  [ErrorCodes.AUTH_SOCIAL_INVALID_AUTHORIZATION_CODE]: labels.errorSocialCode,
  [ErrorCodes.AUTH_SOCIAL_PROVIDER_GATEWAY_ERROR]: labels.errorSocialGateway,
  [ErrorCodes.COMMON_VALIDATION_FAILED]: labels.errorValidation,
})

/** 어떤 실패든 화면에 보일 한 문장으로. 429 는 기다릴 시간을 덧붙이고, 예상 밖 실패는 참조 번호를 함께 돌려준다 */
export function authErrorMessage(error: unknown, labels: AuthLabels): AuthErrorInfo {
  if (error instanceof PkceUnavailableError) return { message: labels.errorPkceUnavailable }
  if (!(error instanceof ApiRequestError)) return { message: labels.errorGeneric }
  const { code, status } = error.apiError
  if (status === 429) {
    const wait = retryAfterSeconds(error)
    const base =
      code === ErrorCodes.AUTH_TOO_MANY_ATTEMPTS
        ? labels.errorTooManyAttempts
        : code === ErrorCodes.AUTH_TOO_MANY_REFRESHES
          ? labels.errorTooManyRefreshes
          : labels.errorRateLimited
    return {
      code,
      retryAfterSeconds: wait,
      message: wait === undefined ? base : `${base} ${labels.errorRetryIn(wait)}`,
    }
  }
  if (status === 0) return { code, message: labels.errorNetwork }
  const known = byCode(labels)[code]
  if (known) return { code, message: known }
  return { code, message: labels.errorGeneric, reference: error.traceId }
}

/** `until`(밀리초 시각)까지 남은 초 — 올림, 0 아래로 내려가지 않는다 */
export function secondsLeft(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000))
}
