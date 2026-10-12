import { ApiRequestError, ErrorCodes, isErrorCode } from '@skeleton/api-client'

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

/**
 * 장부(`payment-jdbc`)가 더한 오류 코드 — 백엔드 `PaymentErrorCode` 와 같은 이름(HTTP 계약의 「오류 코드」).
 * 위의 셋(`PAYMENT_ERROR_CODES` · `isPaymentError`)은 그대로다 — 장부 없이 쓰는 앱의 뜻이 바뀌지 않게 따로 둔다.
 * 상태 코드: ORDER_NOT_FOUND · REFUND_NOT_FOUND · SUBSCRIPTION_NOT_FOUND · WEBHOOK_EVENT_NOT_FOUND · PROVIDER_PAYMENT_NOT_FOUND 404 / ITEM_NOT_PURCHASABLE 422 / IDEMPOTENCY_CONFLICT · ORDER_NOT_PAYABLE · MODE_MISMATCH ·
 * REFUND_NOT_ALLOWED · REFUND_IN_PROGRESS · ALREADY_SUBSCRIBED · SUBSCRIPTION_NOT_ACTIVATABLE · SUBSCRIPTION_NOT_CANCELABLE · SUBSCRIPTION_CANCEL_NOT_ALLOWED · SUBSCRIPTION_CHARGE_IN_PROGRESS 409 / AMOUNT_MISMATCH · REFUND_AMOUNT_EXCEEDED · CAPABILITY_UNSUPPORTED 400 / DECLINED · REFUND_DECLINED 402 / UNAVAILABLE 503
 */
export const PaymentLedgerErrorCodes = {
  ORDER_NOT_FOUND: 'PAYMENT.ORDER_NOT_FOUND',
  REFUND_NOT_FOUND: 'PAYMENT.REFUND_NOT_FOUND',
  ITEM_NOT_PURCHASABLE: 'PAYMENT.ITEM_NOT_PURCHASABLE',
  IDEMPOTENCY_CONFLICT: 'PAYMENT.IDEMPOTENCY_CONFLICT',
  AMOUNT_MISMATCH: 'PAYMENT.AMOUNT_MISMATCH',
  ORDER_NOT_PAYABLE: 'PAYMENT.ORDER_NOT_PAYABLE',
  MODE_MISMATCH: 'PAYMENT.MODE_MISMATCH',
  DECLINED: 'PAYMENT.DECLINED',
  REFUND_NOT_ALLOWED: 'PAYMENT.REFUND_NOT_ALLOWED',
  REFUND_IN_PROGRESS: 'PAYMENT.REFUND_IN_PROGRESS',
  REFUND_AMOUNT_EXCEEDED: 'PAYMENT.REFUND_AMOUNT_EXCEEDED',
  REFUND_DECLINED: 'PAYMENT.REFUND_DECLINED',
  CAPABILITY_UNSUPPORTED: 'PAYMENT.CAPABILITY_UNSUPPORTED',
  UNAVAILABLE: 'PAYMENT.UNAVAILABLE',
  /** 운영자 경로: 없는 수신함 줄 id 의 다시 처리 → 404 */
  WEBHOOK_EVENT_NOT_FOUND: 'PAYMENT.WEBHOOK_EVENT_NOT_FOUND',
  /** 운영자 경로: 「결제사와 맞추기」가 결제사에 물었는데 결제사가 그 결제를 모른다 → 404. **백엔드가 이 이름으로 맞추기로 한 코드** - 다시 건 일이 없다(README 「백엔드가 맞출 것」) */
  PROVIDER_PAYMENT_NOT_FOUND: 'PAYMENT.PROVIDER_PAYMENT_NOT_FOUND',
  /** 구독(`skeleton.payment.subscription.enabled`): 남의 구독 · 없는 구독 → 404 */
  SUBSCRIPTION_NOT_FOUND: 'PAYMENT.SUBSCRIPTION_NOT_FOUND',
  /** 이미 구독 중이다(시작할 때 · 첫 결제를 할 때) → 409 */
  ALREADY_SUBSCRIBED: 'PAYMENT.ALREADY_SUBSCRIBED',
  /** 이미 끝난 구독의 첫 결제 → 409 */
  SUBSCRIPTION_NOT_ACTIVATABLE: 'PAYMENT.SUBSCRIPTION_NOT_ACTIVATABLE',
  /** 첫 결제 전(`PENDING`)의 구독을 해지하려 했다 → 409 */
  SUBSCRIPTION_NOT_CANCELABLE: 'PAYMENT.SUBSCRIPTION_NOT_CANCELABLE',
  /** 플랜을 바꿀 수 없다(위 등급이 아니다 · 이용 중이 아니다 · 결제가 오가는 중이다 · 꺼져 있다) → 409 */
  PLAN_CHANGE_NOT_ALLOWED: 'PAYMENT.PLAN_CHANGE_NOT_ALLOWED',
  /** 서버가 다시 계산한 변경 금액이 본 금액보다 크다 → 409. 미리보기를 다시 한다 */
  PLAN_CHANGE_CHARGE_CHANGED: 'PAYMENT.PLAN_CHANGE_CHARGE_CHANGED',
  /** 중도 해지를 할 수 없다(이 나라의 정책이 닫음 · 이용 중이 아니다) → 409 */
  SUBSCRIPTION_CANCEL_NOT_ALLOWED: 'PAYMENT.SUBSCRIPTION_CANCEL_NOT_ALLOWED',
  /** 갱신 · 변경 결제가 오가는 중이라 지금은 해지할 수 없다 → 409. 끝난 뒤 다시 */
  SUBSCRIPTION_CHARGE_IN_PROGRESS: 'PAYMENT.SUBSCRIPTION_CHARGE_IN_PROGRESS',
  /** 운영자 경로: 닫을 수 없는 구독 결제(구독 결제가 아니다 · 확인 중이 아니다 · 결제사가 아직 처리 중이다) → 409 */
  ORDER_NOT_CLOSABLE: 'PAYMENT.ORDER_NOT_CLOSABLE',
} as const

export type PaymentLedgerErrorCode =
  (typeof PaymentLedgerErrorCodes)[keyof typeof PaymentLedgerErrorCodes]

export const PAYMENT_LEDGER_ERROR_CODES: readonly PaymentLedgerErrorCode[] =
  Object.values(PaymentLedgerErrorCodes)

/** 장부가 낸 에러인가. `code` 를 주면 그 코드(들)만 */
export function isPaymentLedgerError(
  error: unknown,
  code?: PaymentLedgerErrorCode | readonly PaymentLedgerErrorCode[],
): boolean {
  return isErrorCode(error, code ?? PAYMENT_LEDGER_ERROR_CODES)
}

/**
 * 거절(`DECLINED` · `REFUND_DECLINED`)이 싣고 온 `data.providerCode` · `data.category`. 거절 에러가 아니면 `null`.
 * 결제사 코드는 사람이 읽는 문구가 아니다 — 화면은 `category` 로 문구를 고르고 `providerCode` 는 참조 번호 안에만 둔다.
 */
export function declineDetail(error: unknown): { providerCode?: string; category?: string } | null {
  if (
    !(
      isPaymentLedgerError(error, PaymentLedgerErrorCodes.DECLINED) ||
      isPaymentLedgerError(error, PaymentLedgerErrorCodes.REFUND_DECLINED)
    )
  )
    return null
  const data = (error as ApiRequestError).apiError.data
  const read = (key: string) => {
    const value = data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : null
    return typeof value === 'string' ? value : undefined
  }
  const providerCode = read('providerCode')
  const category = read('category')
  return {
    ...(providerCode !== undefined ? { providerCode } : {}),
    ...(category !== undefined ? { category } : {}),
  }
}

/**
 * 승인(confirm) 호출이 오류로 끝났을 때 결제에 대해 알 수 있는 것.
 * - `declined`: 402 `DECLINED` — 결제사가 거절했다고 서버가 답했다(확정).
 * - `rejected`: 그 밖의 확정 4xx(400 `AMOUNT_MISMATCH` · 409 `MODE_MISMATCH` · 409 `ORDER_NOT_PAYABLE` · 404 …) — 서버가 이 승인 요청을 받지 않았다.
 *   카드 거절은 아니다: 돈이 나갔는지는 서버가 다시 읽어 준 주문 상태가 말한다.
 * - `unknown`: 그 밖 전부(네트워크 오류 · 시간 초과 · 5xx · 401 갱신 실패 · 403 · 408 · 429 · 오류가 아닌 값) — 요청이 닿았는지, 닿았다면 어떻게 끝났는지 모른다.
 *   같은 주문의 승인을 다시 보내는 것이 안전하다(서버: `CONFIRMING` 이면 202, `PAID` 면 200, 결제사 멱등 키 = 주문 id).
 */
export type ConfirmOutcome = 'declined' | 'rejected' | 'unknown'

// 이 상태 코드는 「이 요청을 받지 않았다」가 아니다 — 로그인 · 게이트 · 시간 · 속도 제한이라 다시 보내면 달라질 수 있다
const NOT_A_VERDICT = new Set([401, 402, 403, 408, 425, 429])

export function confirmOutcomeOf(error: unknown): ConfirmOutcome {
  if (isPaymentLedgerError(error, PaymentLedgerErrorCodes.DECLINED)) return 'declined'
  if (error instanceof ApiRequestError) {
    const { status } = error.apiError
    if (status >= 400 && status < 500 && !NOT_A_VERDICT.has(status)) return 'rejected'
  }
  return 'unknown'
}
