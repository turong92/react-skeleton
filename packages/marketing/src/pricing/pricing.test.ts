import { describe, expect, it } from 'vitest'
import { formatPrice, monthlyEquivalent, savingsPercent, type PricingPlan } from './pricing'

const plans: PricingPlan[] = [
  { id: 'free', name: 'Free', price: { monthly: 0, yearly: 0 }, features: [], ctaLabel: 'Start' },
  { id: 'pro', name: 'Pro', price: { monthly: 10, yearly: 96 }, features: [], ctaLabel: 'Buy' },
  { id: 'team', name: 'Team', price: { monthly: 25, yearly: 240 }, features: [], ctaLabel: 'Buy' },
  { id: 'ent', name: 'Enterprise', price: null, features: [], ctaLabel: 'Contact' },
]

describe('monthlyEquivalent', () => {
  it('is the monthly price for monthly billing and a twelfth of the yearly total for yearly', () => {
    expect(monthlyEquivalent(plans[1], 'monthly')).toBe(10)
    expect(monthlyEquivalent(plans[1], 'yearly')).toBe(8)
  })
  it('a custom-priced plan has none', () => {
    expect(monthlyEquivalent(plans[3], 'monthly')).toBeNull()
  })
})

describe('savingsPercent', () => {
  it('is the best whole-number saving of paying yearly, over the plans that have a price', () => {
    expect(savingsPercent(plans)).toBe(20)
  })
  it('is 0 when yearly is not cheaper, or there is nothing to compare', () => {
    expect(savingsPercent([{ ...plans[1], price: { monthly: 10, yearly: 120 } }])).toBe(0)
    expect(savingsPercent([plans[0], plans[3]])).toBe(0)
  })
})

describe('formatPrice', () => {
  it('formats in the given currency and locale, without needless decimals', () => {
    expect(formatPrice(8, 'USD', 'en-US')).toBe('$8')
    expect(formatPrice(9900, 'KRW', 'ko-KR')).toBe('₩9,900')
  })
  it('keeps cents when there are some', () => {
    expect(formatPrice(8.5, 'USD', 'en-US')).toBe('$8.50')
  })
})
