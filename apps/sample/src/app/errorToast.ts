import { isErrorCode, ErrorCodes } from '@skeleton/api-client'
import { isEmailRequiredError, isLoginIdRequiredError } from '@skeleton/auth'
import { isAuthorProfileFormError } from '@skeleton/author-profile'
import { isPaymentError, isPaymentLedgerError } from '@skeleton/payment'

/**
 * 전역 에러 토스트에서 제자리에서 말하는 오류를 뺀다 — 폼 검증 실패(400)는 칸 아래에 이미 보이고, 작성자 프로필의 `AUTHOR_PROFILE.*`(이름 겹침 · 상한 · 한도 · 없는 프로필)는 프로필 폼이 말한다.
 * 결제의 `PAYMENT.*`(장부 코드 + 결제사 쪽 실패)는 결제 화면이 우리 낱말로 제자리에서 말한다 — 서버의 `title`/`detail` 이 토스트로 한 번 더 뜨지 않게(영어가 한국어 화면에 남지 않는다).
 * 운영자 환불의 `RefundNotDoneError`와 환불 요청의 `RefundRequestNotOpenError`(답 줄이 환불 없이 닫힘)도 같다 — 영어 내부 문장이 토스트로 나가지 않는다.
 * (칸 아래에 말하는 다른 오류는 그 뮤테이션이 `meta.quietStatuses` 로 표시한다 — `createQueryClient`)
 * 나머지 에러(서버 · 네트워크 · 권한)는 토스트 한 곳(`showApiError`)으로 모인다.
 */
/** 보상 화면이 제자리에서 우리 낱말로 말하는 코드 - 쿠폰 코드 등록 · 출석 · 초대 · 포인트 조정 · 결제의 쿠폰(`discountErrorMessage`) */
const REWARDS_SPOKEN = [
  ErrorCodes.PAYMENT_DISCOUNT_NOT_APPLICABLE,
  ErrorCodes.PAYMENT_DISCOUNT_UNAVAILABLE,
  ErrorCodes.PAYMENT_DISCOUNT_NOT_SUPPORTED,
  ErrorCodes.PAYMENT_DISCOUNT_BELOW_MINIMUM,
  ErrorCodes.PAYMENT_NOTHING_TO_REFUND,
  ErrorCodes.COUPON_CODE_INVALID,
  ErrorCodes.COUPON_CODE_USED,
  ErrorCodes.COUPON_CODE_EXHAUSTED,
  ErrorCodes.COUPON_ISSUE_CLOSED,
  ErrorCodes.CAMPAIGN_NOT_ACTIVE,
  ErrorCodes.CAMPAIGN_REFERRAL_INVALID,
  ErrorCodes.POINT_INSUFFICIENT,
]

export function toastUnlessValidation(show: (error: unknown) => void) {
  return (error: unknown) => {
    if (isErrorCode(error, ErrorCodes.COMMON_VALIDATION_FAILED)) return
    if (isAuthorProfileFormError(error)) return
    // 주소 없는 계정의 403 — 앱을 덮은 「이메일을 등록해 주세요」 화면이 말한다(쿼리도 뮤테이션도 같다)
    if (isEmailRequiredError(error)) return
    if (isErrorCode(error, REWARDS_SPOKEN)) return
    if (isPaymentLedgerError(error) || isPaymentError(error)) return
    // 운영자 환불이 200 인데 줄이 환불 없이 닫혀 있다 - 로그용 영어 문장(`refund rfd_… is FAILED`)이다. 환불 창이 제자리에서 우리 낱말로 말한다
    // (이름으로 가른다 - 앱 전체에 걸린 이 파일이 운영자 진입점(`@skeleton/payment/admin`)을 끌어오지 않게)
    if (error instanceof Error && error.name === 'RefundNotDoneError') return
    // 환불 요청이 2xx 인데 줄이 이미 닫혀 있다 - 같은 영어 내부 문장이다. 요청 창이 제자리에서 말한다
    if (error instanceof Error && error.name === 'RefundRequestNotOpenError') return
    // 아이디 없는 계정의 403 — 「아이디를 정해 주세요」 화면이 말한다
    if (isLoginIdRequiredError(error)) return
    show(error)
  }
}
