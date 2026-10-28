import type { PaymentAmount } from './types'
import type { SubscriptionPlan } from './subscriptionTypes'

/** 한 상품의 플랜들 - 주기가 짧은 것부터 */
export type PlanGroup = { key: string; plans: SubscriptionPlan[] }

const PERIOD =
  /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/** 기준 시각 - 서버의 `PlanChangeRules.ANCHOR`(2000-01-01)와 같은 고정한 날에 `after(기준, 1)` 처럼 주기를 달력으로 더해 길이를 잰다(달 길이가 달마다 달라 한 달 = 28~31일이다) */
const BASE = Date.UTC(2000, 0, 1)

/**
 * 주기 길이(분) - 정렬 · 짧은/긴 주기 판정에만 쓴다. 서버 `PlanChangeRules` 와 같은 고정 기준 시각(2000-01-01)에 달력으로 더해 잰다(한 달 = 1월의 31일, 한 해 = 366일).
 * 그래서 서버처럼 `P1M` 이 `P4W` 보다 길고 `P30D` 보다 길다. 서버의 확정 판정(`timing`)과 같은 기준이지만, 이 값은 화면의 묶음용이고 확정은 서버 미리보기가 한다. 읽을 수 없는(복합 · 빈 · 모르는 글자 · 수가 너무 큰) 주기는 무한대(맨 뒤)
 */
export function periodMinutes(period: string): number {
  const match = typeof period === 'string' ? PERIOD.exec(period) : null
  if (!match) return Number.POSITIVE_INFINITY
  const [years, months, weeks, days, hours, minutes, seconds] = match
    .slice(1)
    .map((part) => Number(part ?? 0))
  const end = Date.UTC(2000 + years!, months!, 1 + weeks! * 7 + days!, hours!, minutes!, seconds!)
  const length = (end - BASE) / 60_000
  return Number.isFinite(length) ? length : Number.POSITIVE_INFINITY
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
