import { describe, expect, it } from 'vitest'
import { changeChoices, planChangeTiming, sameCycleFirst } from './planChange'
import type { SubscriptionPlan } from './subscriptionTypes'

const plan = (code: string, level: number, period: string, currency = 'KRW'): SubscriptionPlan => ({
  code,
  name: code,
  amount: { amount: 1000, currency },
  period,
  level,
})
const standardMonth = { level: 2, period: 'P1M', currency: 'KRW' }

describe('planChangeTiming - the same table as the server', () => {
  it('raising the level in the same period, or lengthening the period at the same or a higher level, is right away', () => {
    expect(planChangeTiming(standardMonth, plan('pro-m', 3, 'P1M'))).toBe('NOW')
    expect(planChangeTiming(standardMonth, plan('std-y', 2, 'P1Y'))).toBe('NOW')
    expect(planChangeTiming(standardMonth, plan('pro-y', 3, 'P1Y'))).toBe('NOW')
  })

  it('a lower level (any period) or a shorter period waits for the next renewal', () => {
    expect(planChangeTiming(standardMonth, plan('basic-m', 1, 'P1M'))).toBe('NEXT_RENEWAL')
    expect(planChangeTiming(standardMonth, plan('basic-y', 1, 'P1Y'))).toBe('NEXT_RENEWAL')
    const yearly = { level: 2, period: 'P1Y', currency: 'KRW' }
    expect(planChangeTiming(yearly, plan('std-m', 2, 'P1M'))).toBe('NEXT_RENEWAL')
    expect(planChangeTiming(yearly, plan('pro-m', 3, 'P1M'))).toBe('NEXT_RENEWAL')
  })

  it('nothing to change at the same level and period, and the currency is never changed', () => {
    expect(planChangeTiming(standardMonth, plan('std-again', 2, 'P1M'))).toBeNull()
    expect(planChangeTiming(standardMonth, plan('pro-usd', 3, 'P1M', 'USD'))).toBeNull()
  })

  it('reads the e2e seed periods too (PT25S month, PT40S year)', () => {
    const month = { level: 2, period: 'PT25S', currency: 'KRW' }
    expect(planChangeTiming(month, plan('std-y', 2, 'PT40S'))).toBe('NOW')
    expect(planChangeTiming({ ...month, period: 'PT40S' }, plan('std-m', 2, 'PT25S'))).toBe(
      'NEXT_RENEWAL',
    )
  })
})

describe('changeChoices', () => {
  it('splits the plans into right-away and next-renewal, leaving out the current plan, same-tier plans and other currencies', () => {
    const plans = [
      plan('basic-m', 1, 'P1M'),
      plan('std-m', 2, 'P1M'),
      plan('std-y', 2, 'P1Y'),
      plan('pro-m', 3, 'P1M'),
      plan('pro-usd', 3, 'P1M', 'USD'),
    ]
    const { now, next } = changeChoices(plans, standardMonth, 'std-m')
    expect(now.map((p) => p.code)).toEqual(['std-y', 'pro-m'])
    expect(next.map((p) => p.code)).toEqual(['basic-m'])
  })
})

describe('sameCycleFirst', () => {
  it('puts the plans of the current period first, the next level up leading, then the longer periods', () => {
    const plans = [
      plan('std-y', 2, 'P1Y'),
      plan('pro-m', 3, 'P1M'),
      plan('max-m', 4, 'P1M'),
      plan('pro-y', 3, 'P1Y'),
    ]
    expect(sameCycleFirst(plans, standardMonth).map((p) => p.code)).toEqual([
      'pro-m',
      'max-m',
      'std-y',
      'pro-y',
    ])
    expect(plans.map((p) => p.code)[0]).toBe('std-y') // 받은 배열은 그대로
  })
})
