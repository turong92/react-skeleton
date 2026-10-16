import { PaymentRedirectError } from './tossRedirect'

export type CheckoutReturn =
  | { ok: true; orderId: string; providerPaymentId: string; amount: number }
  /** `orderId` 는 결제창이 알려 주지 않았으면 `null`. 결제사가 준 `message` 는 일부러 돌려주지 않는다 — 화면은 `code` 로 우리 문구를 고른다 */
  | { ok: false; orderId: string | null; code: string }

/** 카카오페이가 우리 서버 설정의 돌아올 주소로 돌려보낸 결과 - 성공이면 서버가 승인을 부를 때 쓰는 `pg_token`, 아니면 구매자가 그만둔 것(`CANCELED`)인지 실패(`FAILED`)인지 */
export type KakaoPayReturn =
  | { ok: true; orderId: string; approvalToken: string }
  | { ok: false; orderId: string | null; code: 'CANCELED' | 'FAILED' }

/**
 * 카카오페이가 돌려보낸 주소(`?kind=KAKAOPAY_REDIRECT&provider=<결제사 id>&order=<주문 id>&result=success&pg_token=…` / `result=cancel` / `result=fail`)를 읽는다. 주문 id 는 서버가 `ready` 때 주소에 실은 것이다.
 * **금액은 주소에 없다** - 서버가 주문의 금액으로 승인한다. 성공 주소에 주문 id 나 토큰이 없거나 `result` 를 모르면 `PaymentRedirectError`.
 */
export function readKakaoPayReturn(search: string | URLSearchParams): KakaoPayReturn {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const orderId = params.get('order') || null
  switch (params.get('result')) {
    case 'success': {
      const token = params.get('pg_token')
      if (!orderId) throw new PaymentRedirectError('The payment redirect has no order')
      if (!token) throw new PaymentRedirectError('The payment redirect has no pg_token')
      return { ok: true, orderId, approvalToken: token }
    }
    case 'cancel':
      return { ok: false, orderId, code: 'CANCELED' }
    case 'fail':
      return { ok: false, orderId, code: 'FAILED' }
    default:
      throw new PaymentRedirectError('The payment redirect has no known result')
  }
}

/**
 * 결제창이 `successUrl` / `failUrl` 로 돌려보낸 주소(`?paymentKey&orderId&amount` / `?code&message&orderId`)를 읽는다.
 * `paymentKey` 가 있으면 성공 쪽이다. **금액은 주소에서 왔다 — 사용자가 고칠 수 있다.** 서버가 주문의 금액과 대조한다.
 * 어느 쪽도 아니거나 성공 주소의 값이 모자라면 `PaymentRedirectError`.
 */
export function readCheckoutReturn(search: string | URLSearchParams): CheckoutReturn {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const paymentKey = params.get('paymentKey')
  if (paymentKey) {
    const orderId = params.get('orderId')
    const amount = params.get('amount')
    if (!orderId) throw new PaymentRedirectError('The payment redirect has no orderId')
    if (!amount || !/^\d+$/.test(amount))
      throw new PaymentRedirectError('The payment redirect amount is not a whole number')
    return { ok: true, orderId, providerPaymentId: paymentKey, amount: Number(amount) }
  }
  const code = params.get('code')
  if (code) return { ok: false, orderId: params.get('orderId') || null, code }
  throw new PaymentRedirectError('The payment redirect has neither paymentKey nor code')
}
