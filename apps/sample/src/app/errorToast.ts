import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { isEmailRequiredError, isLoginIdRequiredError } from '@skeleton/auth'
import { isAuthorProfileFormError } from '@skeleton/author-profile'

/**
 * 전역 에러 토스트에서 제자리에서 말하는 오류를 뺀다 — 폼 검증 실패(400)는 칸 아래에 이미 보이고, 작성자 프로필의 `AUTHOR_PROFILE.*`(이름 겹침 · 상한 · 한도 · 없는 프로필)는 프로필 폼이 말한다.
 * (칸 아래에 말하는 다른 오류는 그 뮤테이션이 `meta.quietStatuses` 로 표시한다 — `createQueryClient`)
 * 나머지 에러(서버 · 네트워크 · 권한)는 토스트 한 곳(`showApiError`)으로 모인다.
 */
export function toastUnlessValidation(show: (error: unknown) => void) {
  return (error: unknown) => {
    if (isErrorCode(error, ErrorCodes.COMMON_VALIDATION_FAILED)) return
    if (isAuthorProfileFormError(error)) return
    // 주소 없는 계정의 403 — 앱을 덮은 「이메일을 등록해 주세요」 화면이 말한다(쿼리도 뮤테이션도 같다)
    if (isEmailRequiredError(error)) return
    // 아이디 없는 계정의 403 — 「아이디를 정해 주세요」 화면이 말한다
    if (isLoginIdRequiredError(error)) return
    show(error)
  }
}
