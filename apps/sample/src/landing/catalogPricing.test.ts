import type { Catalog, CatalogPrice, CatalogProduct } from '@skeleton/payment'
import type { PricingPlan } from '@skeleton/marketing'
import { describe, expect, it } from 'vitest'
import { catalogPricing } from './catalogPricing'

const free: PricingPlan = {
  id: 'free',
  name: 'Free',
  price: { monthly: 0, yearly: 0 },
  features: ['1 project'],
  ctaLabel: 'Start free',
}
const price = (over: Partial<CatalogPrice> & Pick<CatalogPrice, 'code'>): CatalogPrice => ({
  period: 'P1M',
  amount: 1000,
  currency: 'KRW',
  compareAtAmount: null,
  saleEndsAt: null,
  ...over,
})
const product = (code: string, prices: CatalogPrice[], over: Partial<CatalogProduct> = {}) =>
  ({
    code,
    kind: 'SUBSCRIPTION',
    level: 1,
    highlighted: false,
    sortOrder: 0,
    texts: {
      ko: { name: `${code}-ko`, description: `${code} 설명` },
      en: { name: `${code}-en`, description: null },
    },
    prices,
    ...over,
  }) satisfies CatalogProduct
const options = (language: 'ko' | 'en' = 'ko') => ({
  language,
  free,
  featuresOf: (code: string) => [`${code} feature`],
  ctaLabel: 'Start',
})
const catalog = (products: CatalogProduct[], currency: string | null = 'KRW'): Catalog => ({
  currency,
  products,
})

describe('catalogPricing — the catalog as a pricing table', () => {
  it('puts the dictionary free card first, then the products in the order given', () => {
    const result = catalogPricing(
      catalog([
        product('standard', [price({ code: 's-m' })]),
        product('pro', [price({ code: 'p-m' })], { highlighted: true }),
      ]),
      options(),
    )
    expect(result?.plans.map((p) => p.id)).toEqual(['free', 'standard', 'pro'])
    expect(result?.plans[2]?.highlighted).toBe(true)
    expect(result?.plans[1]).toMatchObject({
      name: 'standard-ko',
      description: 'standard 설명',
      features: ['standard feature'],
      ctaLabel: 'Start',
    })
  })

  it('reads the name in the language of the screen, falling back to English, then the code', () => {
    const p = product('x', [price({ code: 'x-m' })])
    expect(catalogPricing(catalog([p]), options('en'))?.plans[1]?.name).toBe('x-en')
    const onlyEn = { ...p, texts: { en: p.texts.en! } }
    expect(catalogPricing(catalog([onlyEn]), options('ko'))?.plans[1]?.name).toBe('x-en')
    expect(catalogPricing(catalog([{ ...p, texts: {} }]), options())?.plans[1]?.name).toBe('x')
  })

  it('month and year prices become the two intervals; USD cents become dollars; the currency is the one the server chose', () => {
    const result = catalogPricing(
      catalog(
        [
          product('pro', [
            price({ code: 'p-m', amount: 999, currency: 'USD' }),
            price({ code: 'p-y', period: 'P1Y', amount: 9900, currency: 'USD' }),
          ]),
        ],
        'USD',
      ),
      options('en'),
    )
    expect(result?.currency).toBe('USD')
    expect(result?.plans[1]?.price).toEqual({ monthly: 9.99, yearly: 99 })
  })

  it('won stay won, and a missing interval is null (not 0)', () => {
    const result = catalogPricing(
      catalog([product('a', [price({ code: 'a-m', amount: 6900 })])]),
      options(),
    )
    expect(result?.plans[1]?.price).toEqual({ monthly: 6900, yearly: null })
  })

  it('a sale price carries the regular price and the end for that interval only', () => {
    const result = catalogPricing(
      catalog([
        product('std', [
          price({ code: 's-m', amount: 6900 }),
          price({
            code: 's-y',
            period: 'P1Y',
            amount: 59000,
            compareAtAmount: 69000,
            saleEndsAt: '2026-11-30T12:00:00Z',
          }),
        ]),
      ]),
      options(),
    )
    const plan = result?.plans[1]
    expect(plan?.compareAt).toEqual({ yearly: 69000 })
    expect(plan?.saleEndsAt).toEqual({ yearly: '2026-11-30T12:00:00Z' })
  })

  it('without a server currency, the first price decides and prices in other currencies are left out', () => {
    const result = catalogPricing(
      catalog(
        [
          product('a', [
            price({ code: 'a-usd', amount: 500, currency: 'USD' }),
            price({ code: 'a-krw' }),
          ]),
        ],
        null,
      ),
      options('en'),
    )
    expect(result?.currency).toBe('USD')
    expect(result?.plans[1]?.price).toEqual({ monthly: 5, yearly: null })
  })

  it('products with no month or year price (one-time, or sold out in this currency) are skipped', () => {
    const result = catalogPricing(
      catalog([product('once', [price({ code: 'o', period: null })]), product('none', [])]),
      options(),
    )
    expect(result).toBeNull()
  })

  it('an empty catalog shows no table at all (null), not a table of only the free card', () => {
    expect(catalogPricing(catalog([]), options())).toBeNull()
  })
})
