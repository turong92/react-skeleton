import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createCatalogAdminApi } from './catalogAdminApi'

type Call = { path: string; request?: ApiRequest }

function fakeClient(reply: unknown = {}) {
  const calls: Call[] = []
  const record = async (path: string, request?: ApiRequest) => {
    calls.push({ path, request })
    return reply
  }
  return {
    calls,
    client: {
      value: record as <T>(path: string, request?: ApiRequest) => Promise<T>,
      list: (async (path: string, request?: ApiRequest) =>
        (await record(path, request)) as unknown[]) as <T>(
        path: string,
        request?: ApiRequest,
      ) => Promise<T[]>,
    },
  }
}

describe('createCatalogAdminApi (paths and bodies mirror the operator contract)', () => {
  it('products and providers are plain GET lists', async () => {
    const { client, calls } = fakeClient([])
    const api = createCatalogAdminApi(client)
    await api.products()
    await api.providers()
    expect(calls.map((c) => [c.path, c.request])).toEqual([
      ['/admin/catalog/products', undefined],
      ['/admin/catalog/providers', undefined],
    ])
  })

  it('createProduct → POST /products with the body; updateProduct → PUT /products/{code}', async () => {
    const { client, calls } = fakeClient()
    const api = createCatalogAdminApi(client)
    const texts = { ko: { name: '스탠다드', description: null } }
    await api.createProduct({ code: 'standard', kind: 'SUBSCRIPTION', level: 2, texts })
    await api.updateProduct('a/b', { selling: false })
    expect(calls).toEqual([
      {
        path: '/admin/catalog/products',
        request: {
          method: 'POST',
          json: { code: 'standard', kind: 'SUBSCRIPTION', level: 2, texts },
        },
      },
      {
        path: '/admin/catalog/products/a%2Fb',
        request: { method: 'PUT', json: { selling: false } },
      },
    ])
  })

  it('addPrice → POST /products/{code}/prices; stopPrice → POST /prices/{code}/stop', async () => {
    const { client, calls } = fakeClient()
    const api = createCatalogAdminApi(client)
    await api.addPrice('standard', { amount: 59000, currency: 'KRW', period: 'P1Y' })
    await api.stopPrice('standard-y')
    expect(calls).toEqual([
      {
        path: '/admin/catalog/products/standard/prices',
        request: { method: 'POST', json: { amount: 59000, currency: 'KRW', period: 'P1Y' } },
      },
      { path: '/admin/catalog/prices/standard-y/stop', request: { method: 'POST' } },
    ])
  })

  it('setSaleEnd → PATCH with saleEndsAt (null clears the end); provider refs → PUT / DELETE', async () => {
    const { client, calls } = fakeClient()
    const api = createCatalogAdminApi(client)
    await api.setSaleEnd('p', null)
    await api.setProviderRef('p', 'paddle', 'pri_1')
    await api.removeProviderRef('p', 'paddle')
    expect(calls).toEqual([
      { path: '/admin/catalog/prices/p', request: { method: 'PATCH', json: { saleEndsAt: null } } },
      {
        path: '/admin/catalog/prices/p/provider-refs/paddle',
        request: { method: 'PUT', json: { externalId: 'pri_1' } },
      },
      { path: '/admin/catalog/prices/p/provider-refs/paddle', request: { method: 'DELETE' } },
    ])
  })

  it('basePath is configurable and trailing slashes are dropped', async () => {
    const { client, calls } = fakeClient([])
    await createCatalogAdminApi(client, { basePath: '/ops/catalog/' }).products()
    expect(calls[0]?.path).toBe('/ops/catalog/products')
  })
})
