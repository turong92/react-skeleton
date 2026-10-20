import type { Order, Subscription } from '@skeleton/payment'

/**
 * 구독의 첫 결제를 결제 결과 부품(`PaymentResult`)이 읽는 모양으로 옮긴다 - 구독 `ACTIVE`(해지 예약 포함)는 「결제됨」,
 * `PENDING`(결제사가 아직 답하지 않았다)은 「결제 확인 중」, `ENDED` 는 「결제 안 됨」. 이름은 앱이 번역한 플랜 이름(`orderName`).
 */
export function subscriptionAsOrder(subscription: Subscription, orderName: string): Order {
  const status: Order['status'] =
    subscription.status === 'PENDING'
      ? 'CONFIRMING'
      : subscription.status === 'ENDED'
        ? 'FAILED'
        : 'PAID'
  return {
    id: subscription.id,
    status,
    kind: 'SUBSCRIPTION_INITIAL',
    itemType: 'subscription',
    itemRef: subscription.planCode,
    quantity: 1,
    orderName,
    amount: subscription.amount,
    refundedAmount: 0,
    refundableAmount: 0,
    refundPending: false,
    openRefundStatus: null,
    // 결제사가 직접 받은 간편결제(카카오페이 · 네이버페이)면 앱 이름으로 보인다
    method: subscription.easyPayBrand ? 'EASY_PAY' : subscription.card ? 'CARD' : null,
    ...(subscription.easyPayBrand ? { easyPayBrand: subscription.easyPayBrand } : {}),
    card: subscription.card,
    testMode: subscription.testMode,
    failureCode: null,
    createdAt: subscription.createdAt,
    paidAt: status === 'PAID' ? subscription.currentPeriodStart : null,
    fulfilled: status === 'PAID',
  }
}

/**
 * 결과 화면이 읽을 구독(`shownOrderOf` 와 같은 규칙). 서버가 다시 읽어 준 것(`read`)이 이긴다 - 단 아직 `PENDING` 이면 `activate` 자신의 답(`reply`)이 더 새롭다.
 * 이 `id` 의 구독만 본다: `me` 는 옛날에 끝난 다른 구독을 줄 수 있다.
 */
export function shownSubscriptionOf(
  id: string,
  { read, reply }: { read?: Subscription | null; reply?: Subscription },
): Subscription | undefined {
  const mine = read?.id === id ? read : undefined
  const answer = reply?.id === id ? reply : undefined
  return mine && mine.status !== 'PENDING' ? mine : (answer ?? mine)
}
