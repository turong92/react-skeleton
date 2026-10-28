import { describe, expect, it } from 'vitest'
import { catalogProductsQuery } from './catalogQueries'
import { paymentKeys } from './queries'

describe('catalogProductsQuery', () => {
  it('the key is under the payment root and differs per kind', () => {
    expect(paymentKeys.catalogProducts().slice(0, 1)).toEqual(['payment'])
    expect(paymentKeys.catalogProducts('SUBSCRIPTION')).not.toEqual(
      paymentKeys.catalogProducts('ONE_TIME'),
    )
    expect(paymentKeys.catalogProducts()).not.toEqual(paymentKeys.catalogProducts('ONE_TIME'))
  })

  it('reads the products of that kind through the api', async () => {
    const calls: unknown[] = []
    const api = {
      products: async (kind?: string) => {
        calls.push(kind)
        return { currency: 'USD', products: [] }
      },
    }
    const query = catalogProductsQuery(api, 'SUBSCRIPTION')
    await expect(query.queryFn()).resolves.toEqual({ currency: 'USD', products: [] })
    expect(calls).toEqual(['SUBSCRIPTION'])
  })
})
