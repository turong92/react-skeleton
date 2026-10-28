import { describe, expect, it } from 'vitest'
import {
  formatPrice,
  hasYearlyPlans,
  monthlyEquivalent,
  plansForInterval,
  regularMonthlyEquivalent,
  savingsPercent,
  type PricingPlan,
} from './pricing'

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

describe('optional intervals and sale prices', () => {
  const monthlyOnly: PricingPlan = {
    id: 'm',
    name: 'M',
    price: { monthly: 10, yearly: null },
    features: [],
    ctaLabel: '',
  }
  const yearlyOnly: PricingPlan = {
    id: 'y',
    name: 'Y',
    price: { monthly: null, yearly: 96 },
    features: [],
    ctaLabel: '',
  }

  it('monthlyEquivalent is null for an interval the plan does not sell', () => {
    expect(monthlyEquivalent(monthlyOnly, 'yearly')).toBeNull()
    expect(monthlyEquivalent(yearlyOnly, 'monthly')).toBeNull()
  })

  it('the saving counts only plans that have both intervals', () => {
    expect(savingsPercent([monthlyOnly, yearlyOnly])).toBe(0)
    expect(savingsPercent([monthlyOnly, plans[1]])).toBe(20)
  })

  it('hasYearlyPlans ignores the free card (its yearly is 0) and custom plans', () => {
    expect(hasYearlyPlans([plans[0], monthlyOnly, plans[3]])).toBe(false)
    expect(hasYearlyPlans([plans[0], monthlyOnly, plans[1]])).toBe(true)
  })

  it('plansForInterval hides plans without that interval but keeps free and custom ones', () => {
    const all = [plans[0], monthlyOnly, yearlyOnly, plans[3]]
    expect(plansForInterval(all, 'monthly').map((p) => p.id)).toEqual(['free', 'm', 'ent'])
    expect(plansForInterval(all, 'yearly').map((p) => p.id)).toEqual(['free', 'y', 'ent'])
  })

  it('the regular price shows only when it is above the current price, per month for yearly', () => {
    const sale: PricingPlan = {
      ...plans[1],
      price: { monthly: 10, yearly: 60 },
      compareAt: { monthly: 10, yearly: 96 },
    }
    expect(regularMonthlyEquivalent(sale, 'monthly')).toBeNull()
    expect(regularMonthlyEquivalent(sale, 'yearly')).toBe(8)
    expect(regularMonthlyEquivalent({ ...sale, compareAt: { yearly: 50 } }, 'yearly')).toBeNull()
  })
})
