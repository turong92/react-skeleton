import { formatMoney } from '../format'
import type { RewardsLabels } from '../labels'
import type { CouponStage } from '../types'

export type StageSummaryOptions = {
  /** 쿠폰의 통화 — 정액 단계의 금액 표기에 쓴다 */
  currency?: string | null
  locale?: string
}

/**
 * 혜택 단계 목록을 한 줄로 — `[FREE×1, PERCENT50×3]` → 「첫 1회 무료, 이후 3회 50%」, `[PERCENT10×영원]` → 「매번 10%」.
 * 단계가 하나이고 한 번이면 그냥 「30% 할인」. 정률 상한이 있으면 괄호로 붙인다.
 */
export function stageSummary(
  stages: readonly CouponStage[],
  labels: RewardsLabels['coupon'],
  { currency = null, locale }: StageSummaryOptions = {},
): string {
  const { stage } = labels
  const money = (amount: number) =>
    formatMoney(amount, currency, { locale, currencySuffix: labels.currencySuffix })
  const benefit = (s: CouponStage) => {
    if (s.type === 'FREE') return stage.free
    if (s.type === 'FIXED') return stage.fixed(money(s.value))
    return stage.percent(s.value)
  }
  const cap = (s: CouponStage) =>
    s.type === 'PERCENT' && s.maxDiscount !== null ? ` (${stage.max(money(s.maxDiscount))})` : ''

  const pieces = stages.map((s, index) => {
    const b = benefit(s)
    const withCap = (text: string) => text + cap(s)
    if (stages.length === 1) {
      if (s.periods === null) return withCap(stage.every(b))
      if (s.periods === 1) return withCap(stage.once(b, s.type === 'FREE'))
      return withCap(stage.times(s.periods, b))
    }
    if (index === 0) return withCap(stage.first(s.periods ?? 0, b))
    return withCap(s.periods === null ? stage.after(b) : stage.next(s.periods, b))
  })
  return pieces.join(stage.join)
}
