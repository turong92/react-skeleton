import { ApiRequestError } from '@skeleton/api-client'
import { PaymentLedgerErrorCodes } from '../errors'

/**
 * 운영자 경로를 못 쓰는 이유.
 * - `forbidden`: 403 — 권한(`payment.read` · `payment.refund` · `payment.operate`)이 없거나 서버의 `PaymentOperatorPolicy` 가 막았다. 세션 문제가 아니라 권한 문제이므로 로그아웃하지 않는다.
 * - `disabled`: 404 — 이 서버가 운영자 경로를 열지 않았다(`skeleton.payment.admin.enabled` 가 꺼짐). 결제 한 건 · 환불 한 줄 · 수신함 한 줄이 없다는 404
 *   (`PAYMENT.ORDER_NOT_FOUND` · `PAYMENT.REFUND_NOT_FOUND` · `PAYMENT.WEBHOOK_EVENT_NOT_FOUND`), 「결제사와 맞추기」에서 결제사가 그 결제를 모른다는 404(`PAYMENT.PROVIDER_PAYMENT_NOT_FOUND`)와는 코드로 가른다.
 */
export type AdminAccessProblem = 'forbidden' | 'disabled'

const ONE_THING_NOT_FOUND: readonly string[] = [
  PaymentLedgerErrorCodes.ORDER_NOT_FOUND,
  PaymentLedgerErrorCodes.REFUND_NOT_FOUND,
  PaymentLedgerErrorCodes.WEBHOOK_EVENT_NOT_FOUND,
  // 「결제사와 맞추기」 - 결제사가 그 결제를 모른다(경로는 켜져 있다)
  PaymentLedgerErrorCodes.PROVIDER_PAYMENT_NOT_FOUND,
]

export function adminAccessProblem(error: unknown): AdminAccessProblem | null {
  if (!(error instanceof ApiRequestError)) return null
  const { status, code } = error.apiError
  if (status === 403) return 'forbidden'
  if (status === 404 && !ONE_THING_NOT_FOUND.includes(code)) return 'disabled'
  return null
}
