import type { DiscountLine, Order, Subscription } from '@skeleton/payment'

/**
 * 구독의 첫 결제를 결제 결과 부품(`PaymentResult`)이 읽는 모양으로 옮긴다 - 구독 `ACTIVE`(해지 예약 포함)는 「결제됨」,
 * `PENDING`(결제사가 아직 답하지 않았다)은 「결제 확인 중」, `ENDED` 는 「결제 안 됨」. 이름은 앱이 번역한 플랜 이름(`orderName`).
 */
/**
 * 쿠폰이 붙은 구독의 **첫 결제액** - 첫 단계를 플랜 가격에 적용한 값(정률은 상한까지, 정액은 0 아래로 내려가지 않게).
 * 서버는 구독 응답에 첫 결제액을 따로 주지 않는다 - 최근 결제 목록에 첫 주문이 있으면 그것이 이기고(`subscriptionAsOrder` 의 셋째 인자), 없을 때의 계산이다
 */
export function firstChargeOf(
  subscription: Subscription,
): { original: number; paid: number } | null {
  const stage = subscription.discount?.stages[0]
  if (!stage) return null
  const original = subscription.amount.amount
  const cut =
    stage.type === 'FREE'
      ? original
      : stage.type === 'FIXED'
        ? Math.min(original, stage.value)
        : Math.min(
            Math.floor((original * stage.value) / 100),
            stage.maxDiscount ?? Number.POSITIVE_INFINITY,
          )
  return { original, paid: original - cut }
}

export function subscriptionAsOrder(
  subscription: Subscription,
  orderName: string,
  /** 서버가 준 첫 결제 주문(`GET /subscriptions/me` 의 `orders` 중 `SUBSCRIPTION_INITIAL`) - 있으면 금액 · 할인은 이것이 말한다 */
  initial?: Order,
): Order {
  const first = initial ? null : firstChargeOf(subscription)
  const label = subscription.discount?.label ?? ''
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
    amount: initial
      ? initial.amount
      : first
        ? { amount: first.paid, currency: subscription.amount.currency }
        : subscription.amount,
    ...(initial
      ? {
          ...(initial.originalAmount != null ? { originalAmount: initial.originalAmount } : {}),
          ...(initial.discountAmount != null ? { discountAmount: initial.discountAmount } : {}),
          ...(initial.discounts ? { discounts: initial.discounts } : {}),
          ...(initial.settlement ? { settlement: initial.settlement } : {}),
        }
      : first
        ? {
            originalAmount: first.original,
            discountAmount: first.original - first.paid,
            discounts: [
              {
                type: 'coupon',
                ref: subscription.id,
                label,
                amount: first.original - first.paid,
              } satisfies DiscountLine,
            ],
            ...(first.paid === 0 ? { settlement: 'FREE' as const } : {}),
          }
        : {}),
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
