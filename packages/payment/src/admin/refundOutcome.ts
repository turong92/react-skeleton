import { ErrorCodes, isErrorCode } from '@skeleton/api-client'
import {
  isPaymentLedgerError,
  PaymentLedgerErrorCodes,
  type PaymentLedgerErrorCode,
} from '../errors'
import type { Refund, RefundStatus } from '../ledgerTypes'

/** 환불 호출이 돌려준 줄이 「환불하지 않고 닫힌」 상태다 — 같은 `Idempotency-Key` 재전송은 줄을 지금 상태 그대로 돌려주므로(200) 이런 줄도 온다 */
const NOT_DONE: ReadonlySet<RefundStatus> = new Set(['FAILED', 'REJECTED', 'WITHDRAWN'])

/**
 * 환불 호출은 성공(200/202)으로 답했지만 줄이 환불 없이 닫혀 있다(`FAILED` · `REJECTED` · `WITHDRAWN`).
 * 화면은 이것을 성공처럼 창을 닫지 않고 실패로 말한다. `refund` 는 서버가 돌려준 줄.
 */
export class RefundNotDoneError extends Error {
  readonly refund: Refund
  constructor(refund: Refund) {
    super(`refund ${refund.id} is ${refund.status}`)
    this.name = 'RefundNotDoneError'
    this.refund = refund
  }
}

/** 환불 호출의 답 줄이 `SUCCEEDED`(됐다) · `PENDING`(환불 중)이면 그대로, 환불 없이 닫힌 줄이면 {@link RefundNotDoneError} */
export function assertRefundDone<R extends Refund>(refund: R): R {
  if (NOT_DONE.has(refund.status)) throw new RefundNotDoneError(refund)
  return refund
}

/**
 * 환불 호출이 오류로 끝났을 때 돈에 대해 알 수 있는 것 — 확정(서버가 요청을 보고 답했다)과 모름을 가른다.
 * - `declined`: 402 `REFUND_DECLINED` — 결제사가 거절했다(확정)
 * - `inProgress` · `notAllowed` · `amountExceeded`: 409/400 — 서버가 이 요청을 받지 않았다(확정)
 * - `unavailable`: 503 `PAYMENT.UNAVAILABLE` — 보내기 전 확인 조회가 실패해 **보내지 않았다**(확정, 아무것도 안 나갔다)
 * - `invalid`: 400 `COMMON.VALIDATION_FAILED` · `COMMON.PARAMETER_VALIDATION_FAILED` · `COMMON.MALFORMED_REQUEST` — 서버가 **선점 전에** 요청의 모양을 거절했다(금액 0 · 음수, 타입이 틀린 값, 깨진 본문). 아무것도 나가지 않았다(확정)
 * - `notDone`: 답은 왔는데 줄이 환불 없이 닫혀 있다(확정)
 * - `otherConfirmed`: 그 밖의 장부 코드(404 …)(확정)
 * - `unknown`: 그 밖 전부(네트워크 오류 · 시간 초과 · 5xx · 401/403/408/429 · 오류가 아닌 값) — 서버가 환불 줄을 `PENDING`/`SUCCEEDED` 로
 *   만든 뒤일 수 있다. 같은 키로 다시 보내는 것이 안전하다(서버가 그 줄을 돌려준다).
 */
export type RefundProblem =
  | 'declined'
  | 'inProgress'
  | 'notAllowed'
  | 'amountExceeded'
  | 'unavailable'
  | 'invalid'
  | 'notDone'
  | 'otherConfirmed'
  | 'unknown'

const REJECTED_BEFORE_CLAIM = [
  ErrorCodes.COMMON_VALIDATION_FAILED,
  ErrorCodes.COMMON_PARAMETER_VALIDATION_FAILED,
  ErrorCodes.COMMON_MALFORMED_REQUEST,
] as const

export function refundProblemOf(error: unknown): RefundProblem {
  if (error instanceof RefundNotDoneError) return 'notDone'
  const is = (code: PaymentLedgerErrorCode) => isPaymentLedgerError(error, code)
  if (is(PaymentLedgerErrorCodes.REFUND_DECLINED)) return 'declined'
  if (is(PaymentLedgerErrorCodes.REFUND_IN_PROGRESS)) return 'inProgress'
  if (is(PaymentLedgerErrorCodes.REFUND_NOT_ALLOWED)) return 'notAllowed'
  if (is(PaymentLedgerErrorCodes.REFUND_AMOUNT_EXCEEDED)) return 'amountExceeded'
  if (is(PaymentLedgerErrorCodes.UNAVAILABLE)) return 'unavailable'
  // 선점 전의 확정 거절 - 이 셋만이다. 그 밖의 `COMMON.*`(429 · 401 · 403 · 5xx …)와 코드 없는 4xx 는 서버가 요청을 보고 답했다는 증거가 아니다(모름)
  if (isErrorCode(error, REJECTED_BEFORE_CLAIM)) return 'invalid'
  return isPaymentLedgerError(error) ? 'otherConfirmed' : 'unknown'
}

/** 모름이 아니면 확정이다 — 확정 뒤에는 키를 놓는다(다음 누름은 새 환불 줄 · 새 키) */
export const refundVerdictIsKnown = (error: unknown): boolean =>
  refundProblemOf(error) !== 'unknown'
