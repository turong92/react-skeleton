import type { PaymentConfirmRequest } from './types'

/** 결제창에서 돌아온 주소를 결제 요청으로 옮기지 못했다(파라미터 없음 · 금액이 숫자가 아님) */
export class PaymentRedirectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentRedirectError'
  }
}

/**
 * 토스페이먼츠 결제 성공 리다이렉트(`successUrl?paymentKey=…&orderId=…&amount=…`)를 서버 confirm 요청으로.
 * 매핑은 백엔드 `TossPaymentProvider.confirmBody` 가 읽는 것과 같다: `paymentKey` → `providerPaymentId`, `orderId` → `merchantReferenceId`, `amount` → `amount`.
 *
 * **금액은 주소에서 왔다 — 사용자가 고칠 수 있다.** 서버는 이 값을 주문의 실제 금액과 반드시 대조한 뒤 confirm 해야 한다
 * (이 패키지가 대신해 주지 않는다).
 */
export function confirmRequestFromTossRedirect(
  search: string | URLSearchParams,
  { currency, provider = 'toss' }: { currency: string; provider?: string },
): PaymentConfirmRequest {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const read = (name: string) => {
    const value = params.get(name)
    if (!value) throw new PaymentRedirectError(`The payment redirect has no ${name}`)
    return value
  }
  const paymentKey = read('paymentKey')
  const orderId = read('orderId')
  const rawAmount = read('amount')
  if (!/^\d+$/.test(rawAmount))
    throw new PaymentRedirectError(
      `The payment redirect amount is not a whole number: ${rawAmount}`,
    )
  return {
    providerPaymentId: paymentKey,
    merchantReferenceId: orderId,
    amount: { amount: Number(rawAmount), currency },
    provider,
  }
}
