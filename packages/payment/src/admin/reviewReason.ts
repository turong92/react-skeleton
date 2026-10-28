/*
 * 확인 필요 사유를 종류로 가른다 - 화면이 사유마다 다른 말(다음 걸음)을 하고, 돈이 나가는 단추를 막을지 정한다.
 * 모르는 사유는 어느 쪽도 아니다(중립 글자, 단추는 그대로).
 */

/** 「결제사와 맞추기」가 **끝나지 않은 일을 다시 건다**(결제사에 묻는 것이 아니다): 지급 · 회수 */
const RETRY_JOB: ReadonlySet<string> = new Set(['FULFILMENT_UNRESOLVED', 'REFUND_APPLY_UNRESOLVED'])

/** 돈이 결제사와 어긋났다 - 먼저 결제사와 맞추기를 권한다(서버가 환불을 `REFUND_NOT_ALLOWED` 409 로 막는 것은 `REFUND_MISMATCH` 이고, `MODE_MISMATCH` 는 모드가 실제로 다르면 `PAYMENT.MODE_MISMATCH` 409 로 막는다) */
const MONEY_OFF: ReadonlySet<string> = new Set([
  'REFUND_MISMATCH',
  'AMOUNT_MISMATCH',
  'ORDER_MISMATCH',
  'MODE_MISMATCH',
])

export const isRetryJobReason = (reason: string | null | undefined): boolean =>
  reason != null && RETRY_JOB.has(reason)

export const isMoneyOffReason = (reason: string | null | undefined): boolean =>
  reason != null && MONEY_OFF.has(reason)

/** 같은 쿠폰이 두 주문에 쓰였다 - 결제사에 물어도 풀리지 않고, 운영자가 금액을 보고 정한다 */
export const isCouponConflictReason = (reason: string | null | undefined): boolean =>
  reason === 'DISCOUNT_CONFLICT'
