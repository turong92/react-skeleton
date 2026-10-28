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
      coupon('ref', {}, { itemRefs: ['cheer-3000'] }),
      coupon('otherRef', {}, { itemRefs: ['cheer-5000'] }),
    ]
    const target = { purpose: 'ONE_TIME' as const, itemType: 'cheer', itemRef: 'cheer-3000' }
    expect(usableCoupons(list, target).map((c) => c.id)).toEqual(['any', 'once', 'cheer', 'ref'])
  })

  it('a subscription coupon is offered when it fits any of the plans on screen', () => {
    const list = [
      coupon('any'),
      coupon('pro', {}, { purposes: ['SUBSCRIPTION'], planCodes: ['pro'] }),
      coupon('gold', {}, { purposes: ['SUBSCRIPTION'], planCodes: ['gold'] }),
      coupon('once', {}, { purposes: ['ONE_TIME'] }),
    ]
    expect(
      usableCoupons(list, { purpose: 'SUBSCRIPTION', planCodes: ['basic', 'pro'] }).map(
        (c) => c.id,
      ),
    ).toEqual(['any', 'pro'])
  })
})
