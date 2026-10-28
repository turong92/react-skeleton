import { describe, expect, it } from 'vitest'
import { defaultRewardsLabels, koRewardsLabels } from '../labels'
import type { CouponStage } from '../types'
import { stageSummary } from './stageSummary'

const free = (periods: number | null): CouponStage => ({
  type: 'FREE',
  value: 0,
  maxDiscount: null,
  periods,
})
const percent = (value: number, periods: number | null, maxDiscount: number | null = null) =>
  ({ type: 'PERCENT', value, maxDiscount, periods }) satisfies CouponStage
const fixed = (value: number, periods: number | null) =>
  ({ type: 'FIXED', value, maxDiscount: null, periods }) satisfies CouponStage

describe('stageSummary (ko)', () => {
  const ko = (stages: CouponStage[], currency: string | null = 'KRW') =>
    stageSummary(stages, koRewardsLabels.coupon, { currency, locale: 'ko-KR' })

  it('first stage free once, then 50% for 3', () => {
    expect(ko([free(1), percent(50, 3)])).toBe('첫 1회 무료, 이후 3회 50%')
  })
  it('a forever percent is "every time"', () => {
    expect(ko([percent(10, null)])).toBe('매번 10%')
  })
  it('a single one-time stage reads as a plain discount; free stays free', () => {
    expect(ko([fixed(1000, 1)])).toBe('1,000원 할인')
    expect(ko([percent(30, 1, 5000)])).toBe('30% 할인 (최대 5,000원)')
    expect(ko([free(1)])).toBe('무료')
  })
  it('a single multi-period stage and a forever tail', () => {
    expect(ko([free(3)])).toBe('3회 무료')
    expect(ko([free(1), percent(10, null)])).toBe('첫 1회 무료, 이후 매번 10%')
  })
  it('no stages is an empty string', () => {
    expect(ko([])).toBe('')
  })
})

describe('stageSummary (en)', () => {
  it('uses the english phrases', () => {
    const en = (stages: CouponStage[]) =>
      stageSummary(stages, defaultRewardsLabels.coupon, { currency: 'USD', locale: 'en-US' })
    expect(en([free(1), percent(50, 3)])).toBe(
      'Free on the first payment, 50% off on the next 3 payments',
    )
    expect(en([percent(10, null)])).toBe('10% off every time')
    expect(en([fixed(500, 1)])).toBe('$5.00 off')
  })
})
