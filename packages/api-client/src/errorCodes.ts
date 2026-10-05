import { ApiRequestError } from './types'

/**
 * 백엔드(kotlin-skeleton)가 `ApiError.code` 로 내보내는 코드. 출처별로 묶었다.
 * 코드를 추가·바꾸면 해당 Kotlin enum 과 함께 갱신한다 (임의로 만들지 않는다).
 */
export const ErrorCodes = {
  // modules/platform common/ErrorCode.kt — PlatformErrorCode
  COMMON_VALIDATION_FAILED: 'COMMON.VALIDATION_FAILED',
  COMMON_PARAMETER_VALIDATION_FAILED: 'COMMON.PARAMETER_VALIDATION_FAILED',
  COMMON_MALFORMED_REQUEST: 'COMMON.MALFORMED_REQUEST',
  COMMON_NOT_FOUND: 'COMMON.NOT_FOUND',
  COMMON_UNAUTHORIZED: 'COMMON.UNAUTHORIZED',
  COMMON_FORBIDDEN: 'COMMON.FORBIDDEN',
  COMMON_TOO_MANY_REQUESTS: 'COMMON.TOO_MANY_REQUESTS',
  COMMON_IDEMPOTENCY_ERROR: 'COMMON.IDEMPOTENCY_ERROR',
  COMMON_DATA_INTEGRITY_VIOLATION: 'COMMON.DATA_INTEGRITY_VIOLATION',
  COMMON_EXTERNAL_SERVICE_ERROR: 'COMMON.EXTERNAL_SERVICE_ERROR',
  COMMON_EXTERNAL_SERVICE_TIMEOUT: 'COMMON.EXTERNAL_SERVICE_TIMEOUT',
  COMMON_INTERNAL_SERVER_ERROR: 'COMMON.INTERNAL_SERVER_ERROR',

  // modules/auth auth/api/AuthErrorCode.kt
  AUTH_INVALID_CREDENTIALS: 'AUTH.INVALID_CREDENTIALS',

  // modules/auth-social auth/social/oauth/AuthSocialErrorCode.kt
  AUTH_SOCIAL_PROVIDER_NOT_FOUND: 'AUTH_SOCIAL.PROVIDER_NOT_FOUND',
  AUTH_SOCIAL_INVALID_AUTHORIZATION_CODE: 'AUTH_SOCIAL.INVALID_AUTHORIZATION_CODE',
  AUTH_SOCIAL_PROVIDER_GATEWAY_ERROR: 'AUTH_SOCIAL.PROVIDER_GATEWAY_ERROR',
  AUTH_SOCIAL_ACCOUNT_LINK_NOT_FOUND: 'AUTH_SOCIAL.ACCOUNT_LINK_NOT_FOUND',
  AUTH_SOCIAL_LINKED_ACCOUNT_NOT_FOUND: 'AUTH_SOCIAL.LINKED_ACCOUNT_NOT_FOUND',

  // modules/storage storage/web/StorageController.kt — StorageErrorCode. FILE_REJECTED 의 data.errors 가 [{ code, message }]
  STORAGE_FILE_REJECTED: 'STORAGE.FILE_REJECTED',
  STORAGE_OBJECT_NOT_FOUND: 'STORAGE.OBJECT_NOT_FOUND',
  STORAGE_UNAUTHENTICATED: 'STORAGE.UNAUTHENTICATED',

  // modules/payment payment/PaymentErrorCode.kt
  PAYMENT_PROVIDER_NOT_FOUND: 'PAYMENT.PROVIDER_NOT_FOUND',
  PAYMENT_ROUTING_FAILED: 'PAYMENT.ROUTING_FAILED',
  PAYMENT_PROVIDER_ERROR: 'PAYMENT.PROVIDER_ERROR',
} as const

export type ErrorCodeValue = (typeof ErrorCodes)[keyof typeof ErrorCodes]

/**
 * 프론트가 응답을 못 해석했을 때 클라이언트가 직접 채우는 코드. 백엔드가 보낸 값이 아니다.
 * (백엔드의 `HTTP.<STATUS>` 는 ApplicationException 보조 생성자가 만드는 동적 코드라 상수로 두지 않는다.)
 */
export const ClientErrorCodes = {
  /** 4xx/5xx 인데 body 가 ApiError 계약(code · title · status)을 만족하지 않음 */
  HTTP_ERROR: 'CLIENT.HTTP_ERROR',
  /** 응답 자체를 못 받음(네트워크 · 타임아웃 · 취소). status 는 0 */
  NETWORK_ERROR: 'CLIENT.NETWORK_ERROR',
} as const

/** `error` 가 [ApiRequestError] 이고 `apiError.code` 가 `codes` 중 하나면 true */
export function isErrorCode(error: unknown, codes: string | readonly string[]): boolean {
  if (!(error instanceof ApiRequestError)) return false
  return (Array.isArray(codes) ? codes : [codes]).includes(error.apiError.code)
}
