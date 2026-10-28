import { describe, expect, it } from 'vitest'
import { groupPlans, periodMinutes, regularAmountOf } from './planGroups'
import type { SubscriptionPlan } from './subscriptionTypes'

const plan = (code: string, period: string, over: Partial<SubscriptionPlan> = {}) =>
  ({
    code,
    name: code,
    amount: { amount: 1000, currency: 'KRW' },
    period,
    level: 1,
    ...over,
  }) satisfies SubscriptionPlan

describe('groupPlans', () => {
  it('puts the plans of one product on one card, shortest period first', () => {
    const groups = groupPlans([
      plan('std-y', 'P1Y', { productCode: 'standard' }),
      plan('pro-m', 'P1M', { productCode: 'pro' }),
      plan('std-m', 'P1M', { productCode: 'standard' }),
    ])
    expect(groups.map((g) => g.plans.map((p) => p.code))).toEqual([['std-m', 'std-y'], ['pro-m']])
  })

  it('plans without a product code stay one card each (old server)', () => {
    const groups = groupPlans([plan('a', 'P1M'), plan('b', 'P1M')])
    expect(groups.map((g) => g.plans.length)).toEqual([1, 1])
  })

  it('seconds count too (the e2e seed uses PT25S and PT40S), so the shorter period comes first', () => {
    const [group] = groupPlans([
      plan('long', 'PT40S', { productCode: 'p' }),
      plan('short', 'PT25S', { productCode: 'p' }),
    ])
    expect(group?.plans.map((p) => p.code)).toEqual(['short', 'long'])
    expect(periodMinutes('PT30S')).toBe(0.5)
  })

  it('an unreadable period sorts last', () => {
    const [group] = groupPlans([
      plan('x', 'weird', { productCode: 'p' }),
      plan('y', 'P1Y', { productCode: 'p' }),
    ])
    expect(group?.plans.map((p) => p.code)).toEqual(['y', 'x'])
  })
})

describe('regularAmountOf', () => {
  it('is the regular price only when it is above the current amount(same currency, minor units)', () => {
    const regular = { amount: 1500, currency: 'KRW' }
    expect(regularAmountOf(plan('a', 'P1M', { regularAmount: 1500 }))).toEqual(regular)
    expect(regularAmountOf(plan('a', 'P1M', { regularAmount: 1000 }))).toBeNull()
    expect(regularAmountOf(plan('a', 'P1M', { regularAmount: null }))).toBeNull()
    expect(regularAmountOf(plan('a', 'P1M'))).toBeNull()
  })
})
