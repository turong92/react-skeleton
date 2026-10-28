import { describe, expect, it } from 'vitest'
import type { AdminCatalogPrice } from './catalogAdminTypes'
import { priceStateOf } from './priceState'

const price = (over: Partial<AdminCatalogPrice> = {}): AdminCatalogPrice => ({
  code: 'p',
  period: 'P1M',
  amount: 1000,
  currency: 'KRW',
  compareAtAmount: null,
  saleStartsAt: null,
  saleEndsAt: null,
  selling: true,
  current: false,
  stoppedAt: null,
  providerRefs: {},
  ...over,
})
const now = new Date('2026-11-01T00:00:00Z')

describe('priceStateOf', () => {
  it('a price that is sold now is current', () => {
    expect(priceStateOf(price({ current: true }), now)).toBe('current')
  })

  it('a stopped price is stopped even if the server still says current', () => {
    expect(priceStateOf(price({ stoppedAt: '2026-10-01T00:00:00Z', selling: false }), now)).toBe(
      'stopped',
    )
    expect(priceStateOf(price({ selling: false }), now)).toBe('stopped')
  })

  it('a sale that has not started is scheduled; one that ended is ended', () => {
    expect(priceStateOf(price({ saleStartsAt: '2026-11-02T00:00:00Z' }), now)).toBe('scheduled')
    expect(priceStateOf(price({ saleEndsAt: '2026-11-01T00:00:00Z' }), now)).toBe('ended')
  })

  it('a selling price of a product that is not on sale is told apart from a stopped price', () => {
    expect(priceStateOf(price({ current: true }), now, false)).toBe('productStopped')
    expect(priceStateOf(price({ selling: false }), now, false)).toBe('stopped')
  })

  it('a selling regular price during a sale is covered', () => {
    expect(priceStateOf(price(), now)).toBe('covered')
  })
})
