import { isPaymentLedgerError, PaymentLedgerErrorCodes } from '@skeleton/payment'

/**
 * 「요청 거두기」가 안 됐을 때 말할 문장의 키. 서버가 확정해 답한 경우(이미 처리됨 `REFUND_NOT_ALLOWED` 409 · 없음 `REFUND_NOT_FOUND` 404)는
 * 다시 눌러도 같은 답이니 다시 누르라 하지 않는다 — 다시 읽어 온 상태가 이미 화면에 있다. 결과를 모르는 오류(네트워크 · 5xx)만 「다시 눌러 주세요」.
 */
export function withdrawFailureKeyOf(error: unknown) {
  return isPaymentLedgerError(error, [
    PaymentLedgerErrorCodes.REFUND_NOT_ALLOWED,
    PaymentLedgerErrorCodes.REFUND_NOT_FOUND,
  ])
    ? ('cheer.detail.withdrawDecided' as const)
    : ('cheer.detail.withdrawFailed' as const)
}
