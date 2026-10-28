import type { PaymentAmount } from './types'
import type { SubscriptionPlan } from './subscriptionTypes'

/** 한 상품의 플랜들 - 주기가 짧은 것부터 */
export type PlanGroup = { key: string; plans: SubscriptionPlan[] }

const PERIOD = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/
/** 주기 길이(분) 어림 - 정렬에만 쓴다. 읽을 수 없으면 맨 뒤 */
const MINUTES = [525_600, 43_200, 10_080, 1_440, 60, 1]

/** 주기 길이(분) 어림 - 읽을 수 없으면 무한대. 정렬 · 짧은/긴 주기 판정에만 쓴다 */
export function periodMinutes(period: string): number {
  const match = PERIOD.exec(period)
  if (!match) return Number.POSITIVE_INFINITY
  return match.slice(1).reduce((sum, part, at) => sum + Number(part ?? 0) * MINUTES[at]!, 0)
}

/**
 * 같은 `productCode` 의 플랜을 한 묶음으로(카드 한 장). `productCode` 가 없는 플랜(옛 서버 · 코드로 만든 플랜)은 플랜 하나가 묶음 하나.
 * 묶음 순서는 서버가 준 순서(처음 나온 자리), 묶음 안은 짧은 주기부터
 */
export function groupPlans(plans: readonly SubscriptionPlan[]): PlanGroup[] {
  const groups = new Map<string, SubscriptionPlan[]>()
  for (const plan of plans) {
    const key = plan.productCode ? `product:${plan.productCode}` : `plan:${plan.code}`
    const list = groups.get(key)
    if (list) list.push(plan)
    else groups.set(key, [plan])
  }
  return [...groups].map(([key, list]) => ({
    key,
    plans: [...list].sort((a, b) => periodMinutes(a.period) - periodMinutes(b.period)),
  }))
}

/** 취소선으로 보일 정가 - 지금 금액보다 클 때만, 아니면 `null` */
export function regularAmountOf(plan: SubscriptionPlan): PaymentAmount | null {
  const regular = plan.regularAmount
  return regular != null && regular > plan.amount.amount
    ? { amount: regular, currency: plan.amount.currency }
    : null
}
