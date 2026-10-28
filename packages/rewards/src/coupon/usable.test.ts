import { describe, expect, it } from 'vitest'
import type { Coupon } from '../types'
import { usableCoupons } from './usable'

const coupon = (
  id: string,
  over: Partial<Coupon> = {},
  scope: Partial<Coupon['scope']> = {},
): Coupon => ({
  id,
  name: id,
  status: 'AVAILABLE',
  expiresAt: null,
  stages: [],
  currency: null,
  minAmount: null,
  scope: { purposes: [], itemTypes: [], planCodes: [], ...scope },
  ...over,
})

describe('usableCoupons', () => {
  it('only coupons that can be put on a new payment: the AVAILABLE tab also lists coupons held by another payment (RESERVED)', () => {
    const list = [coupon('a'), coupon('b', { status: 'RESERVED' })]
    expect(usableCoupons(list, { purpose: 'ONE_TIME' }).map((c) => c.id)).toEqual(['a'])
  })

  it('an empty scope list means everywhere; a filled one must contain what is being bought', () => {
    const list = [
      coupon('any'),
      coupon('once', {}, { purposes: ['ONE_TIME'] }),
      coupon('sub', {}, { purposes: ['SUBSCRIPTION'] }),
      coupon('cheer', {}, { itemTypes: ['cheer'] }),
      coupon('other', {}, { itemTypes: ['book'] }),
    ]
    expect(
      usableCoupons(list, { purpose: 'ONE_TIME', itemType: 'cheer' }).map((c) => c.id),
    ).toEqual(['any', 'once', 'cheer'])
  })

  it('a one-off purchase has no plan, so a coupon limited to plans does not fit it (as the server decides)', () => {
    const list = [coupon('any'), coupon('plans', {}, { planCodes: ['pro'] })]
    expect(
      usableCoupons(list, { purpose: 'ONE_TIME', itemType: 'cheer' }).map((c) => c.id),
    ).toEqual(['any'])
    expect(
      usableCoupons(list, {
        purpose: 'SUBSCRIPTION',
        itemType: 'subscription',
        planCodes: ['pro'],
      }).map((c) => c.id),
    ).toEqual(['any', 'plans'])
  })

  it('a subscription is of the type "subscription": a coupon for cheers only does not fit it', () => {
    const list = [
      coupon('cheers', {}, { itemTypes: ['cheer'] }),
      coupon('subs', {}, { itemTypes: ['subscription'] }),
    ]
    expect(
      usableCoupons(list, {
        purpose: 'SUBSCRIPTION',
        itemType: 'subscription',
        planCodes: ['pro'],
      }).map((c) => c.id),
    ).toEqual(['subs'])
  })

  it('a subscription coupon is offered when it fits any of the plans on screen', () => {
    const list = [
      coupon('any'),
      coupon('pro', {}, { purposes: ['SUBSCRIPTION'], planCodes: ['pro'] }),
      coupon('gold', {}, { purposes: ['SUBSCRIPTION'], planCodes: ['gold'] }),
      coupon('once', {}, { purposes: ['ONE_TIME'] }),
    ]
    expect(
      usableCoupons(list, {
        purpose: 'SUBSCRIPTION',
        itemType: 'subscription',
        planCodes: ['basic', 'pro'],
      }).map((c) => c.id),
    ).toEqual(['any', 'pro'])
  })

  it('a coupon that is usable only from a later time is not offered yet (the server lists it as AVAILABLE and refuses it in the quote)', () => {
    const list = [
      coupon('now'),
      coupon('soon', { usableFrom: '2026-11-02T00:00:00Z' }),
      coupon('past', { usableFrom: '2026-10-01T00:00:00Z' }),
    ]
    const now = Date.parse('2026-10-29T00:00:00Z')
    expect(
      usableCoupons(list, { purpose: 'ONE_TIME', itemType: 'cheer', now }).map((c) => c.id),
    ).toEqual(['now', 'past'])
  })
})
