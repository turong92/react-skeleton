import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { isAuthorProfileFormError } from '@skeleton/author-profile'

/**
 * 전역 에러 토스트에서 폼이 제자리에서 말하는 오류를 뺀다 — 폼 검증 실패(400)는 칸 아래에 이미 보이고, 작성자 프로필의 `AUTHOR_PROFILE.*`(이름 겹침 · 상한 · 한도 · 없는 프로필)는 프로필 폼이 말한다.
 * (칸 아래에 말하는 다른 오류는 그 뮤테이션이 `meta.quietStatuses` 로 표시한다 — `createQueryClient`)
 * 나머지 에러(서버 · 네트워크 · 권한)는 토스트 한 곳(`showApiError`)으로 모인다.
 */
export function toastUnlessValidation(show: (error: unknown) => void) {
  return (error: unknown) => {
    if (isErrorCode(error, ErrorCodes.COMMON_VALIDATION_FAILED)) return
    if (isAuthorProfileFormError(error)) return
    show(error)
  }
}
