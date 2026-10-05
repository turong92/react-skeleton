import { savingsPercent } from '@skeleton/marketing'
import { describe, expect, it } from 'vitest'
import { pricingFor } from './pricingData'

describe('pricingFor — the sample prices, in the currency of the language', () => {
  it('Korean prices are in won and English in dollars', () => {
    expect(pricingFor('ko').currency).toBe('KRW')
    expect(pricingFor('en').currency).toBe('USD')
  })

  it('has a free, a highlighted paid and a team plan, and paying yearly is cheaper', () => {
    for (const locale of ['ko', 'en'] as const) {
      const { prices } = pricingFor(locale)
      expect(prices.free).toEqual({ monthly: 0, yearly: 0 })
      expect(prices.pro.yearly).toBeLessThan(prices.pro.monthly * 12)
      expect(prices.team.yearly).toBeLessThan(prices.team.monthly * 12)
      expect(
        savingsPercent([{ id: 'pro', name: 'p', price: prices.pro, features: [], ctaLabel: '' }]),
      ).toBeGreaterThan(0)
    }
  })
})
