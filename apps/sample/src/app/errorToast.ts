import { isErrorCode, ErrorCodes } from '@skeleton/api-client'

/**
 * 전역 에러 토스트에서 폼 검증 실패(400)만 뺀다 — 그것은 칸 아래에 이미 보인다. (칸 아래에 말하는 다른 오류는 그 뮤테이션이 `meta.quietStatuses` 로 표시한다 — `createQueryClient`)
 * 나머지 에러(서버 · 네트워크 · 권한)는 토스트 한 곳(`showApiError`)으로 모인다.
 */
export function toastUnlessValidation(show: (error: unknown) => void) {
  return (error: unknown) => {
    if (isErrorCode(error, ErrorCodes.COMMON_VALIDATION_FAILED)) return
    show(error)
  }
}
