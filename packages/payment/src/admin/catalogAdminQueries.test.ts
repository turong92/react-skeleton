import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { paymentKeys } from '../queries'
import type { CatalogAdminApi } from './catalogAdminApi'
import {
  catalogAdminKeys,
  catalogAdminMutations,
  catalogAdminProductsQuery,
  catalogAdminProvidersQuery,
} from './catalogAdminQueries'

function fakeApi() {
  const calls: Array<[string, ...unknown[]]> = []
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args])
      return {} as never
    }
  const api: CatalogAdminApi = {
    products: async () => {
      calls.push(['products'])
      return []
    },
    createProduct: record('createProduct'),
    updateProduct: record('updateProduct'),
    addPrice: record('addPrice'),
    stopPrice: record('stopPrice'),
    setSaleEnd: record('setSaleEnd'),
    setProviderRef: record('setProviderRef'),
    removeProviderRef: record('removeProviderRef'),
    providers: async () => {
      calls.push(['providers'])
      return ['paddle']
    },
  }
  return { api, calls }
}

describe('catalog admin queries', () => {
  it('keys live under the payment root, so every payment screen of this browser refreshes together', () => {
    expect(catalogAdminKeys.products().slice(0, 1)).toEqual(['payment'])
    expect(catalogAdminKeys.products()).not.toEqual(catalogAdminKeys.providers())
    expect(catalogAdminKeys.all.slice(0, paymentKeys.all.length)).toEqual([...paymentKeys.all])
  })

  it('the lists do not retry and keep 403 / 404 off the error toast (the screen says it in place)', async () => {
    const { api, calls } = fakeApi()
    const products = catalogAdminProductsQuery(api)
    const providers = catalogAdminProvidersQuery(api)
    expect(products.retry).toBe(false)
    expect(products.meta.quietStatuses).toEqual([403, 404])
    await products.queryFn()
    await expect(providers.queryFn()).resolves.toEqual(['paddle'])
    expect(calls).toEqual([['products'], ['providers']])
  })
})

describe('catalogAdminMutations', () => {
  const run = async (
    name: keyof ReturnType<typeof catalogAdminMutations>,
    vars: unknown,
    client = new QueryClient(),
  ) => {
    const { api, calls } = fakeApi()
    const options = catalogAdminMutations(api, client)[name]
    await new MutationObserver(client, options as never).mutate(vars as never)
    return calls
  }

  it('each mutation calls the api with its pieces', async () => {
    expect(
      await run('addPrice', { productCode: 's', input: { amount: 1, currency: 'KRW' } }),
    ).toEqual([['addPrice', 's', { amount: 1, currency: 'KRW' }]])
    expect(await run('stopPrice', 'p1')).toEqual([['stopPrice', 'p1']])
    expect(await run('setSaleEnd', { code: 'p1', saleEndsAt: null })).toEqual([
      ['setSaleEnd', 'p1', null],
    ])
    expect(
      await run('setProviderRef', { code: 'p1', provider: 'paddle', externalId: 'pri' }),
    ).toEqual([['setProviderRef', 'p1', 'paddle', 'pri']])
    expect(await run('removeProviderRef', { code: 'p1', provider: 'paddle' })).toEqual([
      ['removeProviderRef', 'p1', 'paddle'],
    ])
    expect(await run('updateProduct', { code: 's', input: { selling: false } })).toEqual([
      ['updateProduct', 's', { selling: false }],
    ])
  })

  it('a success invalidates the whole payment root - the admin list and the public price table both reread', async () => {
    const client = new QueryClient()
    client.setQueryData(catalogAdminKeys.products(), [])
    client.setQueryData(paymentKeys.catalogProducts('SUBSCRIPTION'), {
      currency: 'KRW',
      products: [],
    })
    client.setQueryData(paymentKeys.subscriptionPlans(), [])
    await run('stopPrice', 'p1', client)
    for (const key of [
      catalogAdminKeys.products(),
      paymentKeys.catalogProducts('SUBSCRIPTION'),
      paymentKeys.subscriptionPlans(),
    ])
      expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })
})
