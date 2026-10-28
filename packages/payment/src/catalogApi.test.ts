import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createCatalogApi } from './catalogApi'

function fakeClient(reply: unknown = { currency: 'KRW', products: [] }) {
  const calls: { path: string; request?: ApiRequest }[] = []
  return {
    calls,
    client: {
      value: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ path, request })
        return reply as T
      },
    },
  }
}

describe('createCatalogApi (mirrors the public read contract)', () => {
  it('products → GET /catalog/products without a kind filter', async () => {
    const { client, calls } = fakeClient()
    await expect(createCatalogApi(client).products()).resolves.toEqual({
      currency: 'KRW',
      products: [],
    })
    expect(calls).toEqual([{ path: '/catalog/products', request: undefined }])
  })

  it('passes kind as a query parameter', async () => {
    const { client, calls } = fakeClient()
    await createCatalogApi(client).products('SUBSCRIPTION')
    expect(calls[0]).toEqual({
      path: '/catalog/products',
      request: { params: { kind: 'SUBSCRIPTION' } },
    })
  })

  it('basePath is configurable and trailing slashes are dropped', async () => {
    const { client, calls } = fakeClient()
    await createCatalogApi(client, { basePath: '/shop/' }).products('ONE_TIME')
    expect(calls[0]?.path).toBe('/shop/products')
  })
})
