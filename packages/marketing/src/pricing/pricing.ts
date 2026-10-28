export type BillingInterval = 'monthly' | 'yearly'

export type PricingPlan = {
  id: string
  name: string
  description?: string
  /**
   * 금액(통화의 기본 단위 — USD 면 달러, KRW 면 원). `yearly` 는 연 결제 **총액**. 그 주기의 가격이 없으면 그 칸은 `null`
   * (그 주기 화면에서는 카드를 숨긴다). 객체 전체가 `null` 이면 문의(맞춤 가격)
   */
  price: { monthly: number | null; yearly: number | null } | null
  /** 행사 중이면 취소선으로 보일 정가(`price` 와 같은 단위 · 같은 주기 기준). 정가가 `price` 보다 클 때만 그린다 */
  compareAt?: { monthly?: number; yearly?: number }
  /** 행사가가 끝나는 때(ISO-8601 시각) — 「○월 ○일까지」 */
  saleEndsAt?: { monthly?: string; yearly?: string }
  features: string[]
  ctaLabel: string
  /** 가장 권하는 요금제 — 강조 + 말머리 */
  highlighted?: boolean
}

/** 두 주기의 값이 모두 0(또는 없음)인 요금제 — 무료 카드 */
export function isFree(plan: PricingPlan): boolean {
  return plan.price !== null && (plan.price.monthly ?? 0) === 0 && (plan.price.yearly ?? 0) === 0
}

/** 한 달 값 — 월 결제는 월 가격, 연 결제는 연 총액의 12분의 1. 문의 요금제 · 그 주기 가격이 없는 요금제는 null */
export function monthlyEquivalent(plan: PricingPlan, interval: BillingInterval): number | null {
  const total = plan.price?.[interval]
  if (total == null) return null
  return interval === 'monthly' ? total : total / 12
}

/** 정가의 한 달 값 — [monthlyEquivalent] 와 같은 셈. 행사 중이 아니거나 정가가 지금 가격보다 크지 않으면 null */
export function regularMonthlyEquivalent(
  plan: PricingPlan,
  interval: BillingInterval,
): number | null {
  const regular = plan.compareAt?.[interval]
  const now = plan.price?.[interval]
  if (regular == null || now == null || regular <= now) return null
  return interval === 'monthly' ? regular : regular / 12
}

/** 연 가격이 있는(0 이 아닌) 요금제가 하나라도 있나 — 없으면 월 · 연 토글을 그리지 않는다 */
export function hasYearlyPlans(plans: PricingPlan[]): boolean {
  return plans.some((plan) => (plan.price?.yearly ?? 0) > 0)
}

/** 그 주기에 보일 요금제 — 문의(`price: null`) · 무료는 늘 보이고, 그 주기 가격이 없는 요금제는 뺀다 */
export function plansForInterval(plans: PricingPlan[], interval: BillingInterval): PricingPlan[] {
  return plans.filter(
    (plan) => plan.price === null || isFree(plan) || plan.price[interval] !== null,
  )
}

/** 연 결제가 월 결제보다 얼마나 싼가(%, 정수) — 두 주기 가격이 모두 있는 요금제 중 가장 큰 값. 비교할 것이 없거나 더 싸지 않으면 0 */
export function savingsPercent(plans: PricingPlan[]): number {
  let best = 0
  for (const plan of plans) {
    const { monthly, yearly } = plan.price ?? {}
    if (monthly == null || yearly == null || monthly <= 0) continue
    best = Math.max(best, Math.round((1 - yearly / (monthly * 12)) * 100))
  }
  return best
}

/** 행사 끝 날짜 글자 — 시간대를 **명시해** 쓴다(기본 UTC, 서버 렌더와 같아야 한다) */
export function formatSaleEnd(iso: string, locale: string, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium' }).format(new Date(iso))
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
