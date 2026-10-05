import { ErrorCodes, isErrorCode } from '@skeleton/api-client'

/** 백엔드 `PaymentErrorCode`(modules/payment) 의 코드 셋 */
export const PAYMENT_ERROR_CODES = [
  ErrorCodes.PAYMENT_PROVIDER_NOT_FOUND,
  ErrorCodes.PAYMENT_ROUTING_FAILED,
  ErrorCodes.PAYMENT_PROVIDER_ERROR,
] as const

/** 결제 모듈이 낸 에러인가(`ApiRequestError` 의 `apiError.code`). 제공자 쪽 실패는 `PAYMENT.PROVIDER_ERROR`(502) */
export function isPaymentError(error: unknown): boolean {
  return isErrorCode(error, PAYMENT_ERROR_CODES)
}
