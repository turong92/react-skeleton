import { isErrorCode, ErrorCodes } from '@skeleton/api-client'

/**
 * 전역 에러 토스트에서 폼 검증 실패(400)와 겹친 닉네임(409 — 닉네임 칸 아래에 보인다)만 뺀다 — 칸 아래에 이미 보인다.
 * 나머지 에러(서버 · 네트워크 · 권한)는 토스트 한 곳(`showApiError`)으로 모인다.
 */
export function toastUnlessValidation(show: (error: unknown) => void) {
  return (error: unknown) => {
    if (isErrorCode(error, ErrorCodes.COMMON_VALIDATION_FAILED)) return
    if (isErrorCode(error, ErrorCodes.ACCOUNT_DISPLAY_NAME_TAKEN)) return
    if (isErrorCode(error, ErrorCodes.ACCOUNT_RATE_LIMITED)) return // 닉네임 변경 한도 — 칸 아래에 시간과 함께 보인다
    show(error)
  }
}
