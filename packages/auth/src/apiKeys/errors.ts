import { ApiRequestError, isErrorCode } from '@skeleton/api-client'
import { authErrorMessage } from '../screens/errors'
import type { AuthLabels } from '../screens/labels'
import type { ApiKeysLabels } from './labels'

/** 백엔드 `api-key` 모듈의 오류 코드 */
export const API_KEY_CODES = {
  LIMIT_REACHED: 'API_KEY.LIMIT_REACHED',
  SCOPE_UNKNOWN: 'API_KEY.SCOPE_UNKNOWN',
} as const

/** 이 도구가 꺼진 서버(경로 404) - 키 모듈의 `http.enabled` / `admin.enabled` 가 꺼져 있다 */
export const isApiKeysOff = (error: unknown) =>
  error instanceof ApiRequestError && error.apiError.status === 404

/** 키 호출의 실패를 한 문장으로 - 모르는 오류는 계정 화면과 같은 문구(`authErrorMessage`) */
export function apiKeyErrorMessage(
  error: unknown,
  labels: ApiKeysLabels,
  authLabels: AuthLabels,
): string {
  if (isErrorCode(error, API_KEY_CODES.LIMIT_REACHED)) return labels.errors.limitReached
  if (isErrorCode(error, API_KEY_CODES.SCOPE_UNKNOWN)) return labels.errors.scopeUnknown
  if (error instanceof ApiRequestError && error.apiError.status === 404)
    return labels.errors.notFound
  return authErrorMessage(error, authLabels).message
}
