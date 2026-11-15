import type { AxiosAdapter } from 'axios'
import { describe, expect, it } from 'vitest'
import { createApiClient } from './createApiClient'

const adapter: AxiosAdapter = async (config) => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  data: { value: 1, meta: {} },
})

describe('ApiClient.lastTraceId', () => {
  it('is empty before any request, then the trace id of the latest request (what an error report carries)', async () => {
    const client = createApiClient({ baseUrl: '/api/v1', adapter })
    expect(client.lastTraceId()).toBeUndefined()

    await client.value('/a', { traceId: '0af7651916cd43dd8448eb211c80319c' })
    expect(client.lastTraceId()).toBe('0af7651916cd43dd8448eb211c80319c')

    await client.value('/b')
    expect(client.lastTraceId()).toMatch(/^[0-9a-f]{32}$/)
    expect(client.lastTraceId()).not.toBe('0af7651916cd43dd8448eb211c80319c')
  })

  it('also remembers the trace id of a request that failed', async () => {
    const client = createApiClient({
      baseUrl: '/api/v1',
      adapter: async (config) => ({ status: 500, statusText: 'x', headers: {}, config, data: {} }),
    })
    await client.value('/a', { traceId: 'ffffffffffffffffffffffffffffffff' }).catch(() => undefined)
    expect(client.lastTraceId()).toBe('ffffffffffffffffffffffffffffffff')
  })
})
