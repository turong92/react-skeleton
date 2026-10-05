import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'
import { strings } from '../strings'

export type FieldErrors = Record<string, string>

export function isValidationFailure(error: unknown): boolean {
  return isErrorCode(error, ErrorCodes.COMMON_VALIDATION_FAILED)
}

/**
 * 백엔드의 400(`ApiError.errors[]`)을 폼 칸별 한국어 문구로 — 서버 메시지는 영어라 보이지 않고 `code` 로 고른다.
 * 칸 이름은 요청 JSON 의 속성 이름(`title` · `body`). 한 칸에 오류가 여럿이면 처음 것만.
 */
export function fieldErrorsOf(error: unknown): FieldErrors {
  if (!(error instanceof ApiRequestError) || !isValidationFailure(error)) return {}
  const result: FieldErrors = {}
  for (const item of error.apiError.errors ?? []) {
    if (item.field in result) continue
    result[item.field] = strings.validation[item.code] ?? strings.validation.fallback
  }
  return result
}
