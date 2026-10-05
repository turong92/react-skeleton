export type BillingInterval = 'monthly' | 'yearly'

export type PricingPlan = {
  id: string
  name: string
  description?: string
  /** 금액(통화의 기본 단위 — USD 면 달러, KRW 면 원). `yearly` 는 연 결제 **총액**. `null` 이면 문의(맞춤 가격) */
  price: { monthly: number; yearly: number } | null
  features: string[]
  ctaLabel: string
  /** 가장 권하는 요금제 — 강조 + 말머리 */
  highlighted?: boolean
}

/** 한 달 값 — 월 결제는 월 가격, 연 결제는 연 총액의 12분의 1. 문의 요금제는 null */
export function monthlyEquivalent(plan: PricingPlan, interval: BillingInterval): number | null {
  if (!plan.price) return null
  return interval === 'monthly' ? plan.price.monthly : plan.price.yearly / 12
}

/** 연 결제가 월 결제보다 얼마나 싼가(%, 정수) — 가격 있는 요금제 중 가장 큰 값. 비교할 것이 없거나 더 싸지 않으면 0 */
export function savingsPercent(plans: PricingPlan[]): number {
  let best = 0
  for (const plan of plans) {
    if (!plan.price || plan.price.monthly <= 0) continue
    best = Math.max(best, Math.round((1 - plan.price.yearly / (plan.price.monthly * 12)) * 100))
  }
  return best
}

/** 통화 · 로케일을 **명시해** 쓴다(기기 로케일에 기대면 서버 렌더와 어긋난다). 정수 금액은 소수점 없이 */
export function formatPrice(amount: number, currency: string, locale: string): string {
  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(amount)
}
