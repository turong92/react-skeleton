import { loadTossPaymentsSdk, type TossPaymentsFactory } from './checkout'
import type { BillingAuth } from './subscriptionTypes'

export type OpenBillingAuthOptions = {
  /** 카드 등록 뒤 돌아올 주소 — 프론트가 정한다(서버는 받지도 저장하지도 않는다). `readBillingReturn` 이 읽는다 */
  successUrl: string
  failUrl: string
  /** SDK 를 불러오는 함수 — 시험 · 스토리에서 가짜로 바꾼다 */
  loadSdk?: () => Promise<TossPaymentsFactory>
}

/**
 * `billingAuth.kind` 로 갈라 카드 등록 창을 연다(`openCheckout` 과 같은 방식 · 같은 SDK 로더). 서버가 준 `customerKey` 로 연다 —
 * 구매자 이름 · 이메일은 넘기지 않는다. 사용자가 창을 닫으면 SDK 가 던진 에러(`code: 'USER_CANCEL'` 등)가 그대로 나온다.
 */
export async function openBillingAuth(
  billingAuth: BillingAuth,
  { successUrl, failUrl, loadSdk = loadTossPaymentsSdk }: OpenBillingAuthOptions,
): Promise<void> {
  switch (billingAuth.kind) {
    case 'TOSS_BILLING_AUTH': {
      if (!billingAuth.clientKey) throw new Error('The billing auth has no client key')
      const TossPayments = await loadSdk()
      await TossPayments(billingAuth.clientKey)
        .payment({ customerKey: billingAuth.customerKey })
        .requestBillingAuth({ method: 'CARD', successUrl, failUrl })
      return
    }
    default:
      throw new Error(
        `Unknown billing auth kind: ${String((billingAuth as { kind: unknown }).kind)}`,
      )
  }
}
