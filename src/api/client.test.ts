import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { createSkeletonHttpClient } from '../modules/http/skeletonHttpClient'
import { apiBasic, apiCursor, apiResponse, apiValue, setApiHttpClientForTesting } from './client'

type CapturedRequest = {
  url?: string
  baseURL?: string
  method?: string
  headers: Record<string, unknown>
  data: unknown
}

let restoreClient = () => {}

afterEach(() => {
  restoreClient()
  restoreClient = () => {}
})

describe('api client', () => {
  it('adds trace, authorization, dev-login, and idempotency headers through the shared http module', async () => {
    const { requests } = stubApiClient({
      data: {
        value: { id: 'item-1' },
        meta: {
          traceId: '0123456789abcdef0123456789abcdef',
          spanId: 'fedcba9876543210',
          timestamp: '2026-06-12T00:00:00Z',
        },
      },
    })

    const result = await apiValue<{ id: string }>('/examples/items', {
      method: 'POST',
      json: { name: 'sample' },
      traceId: '0123456789abcdef0123456789abcdef',
      accessToken: 'access-token',
      idempotencyKey: 'idem-1',
      devLogin: { email: 'user@example.com' },
    })

    expect(result).toEqual({ id: 'item-1' })
    expect(requests[0].baseURL).toBe('/api/v1')
    expect(requests[0].data).toBe(JSON.stringify({ name: 'sample' }))
    expect(requests[0].headers.Authorization).toBe('Bearer access-token')
    expect(requests[0].headers['Idempotency-Key']).toBe('idem-1')
    expect(requests[0].headers['X-Dev-Email']).toBe('user@example.com')
    expect(requests[0].headers['X-Trace-Id']).toBe('0123456789abcdef0123456789abcdef')
    expect(requests[0].headers.traceparent).toMatch(
      /^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/,
    )
  })

  it('returns status, headers, and envelope when the caller needs the transport layer', async () => {
    stubApiClient({
      status: 201,
      headers: {
        location: '/api/v1/examples/items/item-1',
        'x-trace-id': '0123456789abcdef0123456789abcdef',
        'x-span-id': 'fedcba9876543210',
      },
      data: {
        value: { id: 'item-1' },
        meta: {
          traceId: '0123456789abcdef0123456789abcdef',
          spanId: 'fedcba9876543210',
          timestamp: '2026-06-12T00:00:00Z',
        },
      },
    })

    const result = await apiResponse('/examples/items', {
      method: 'POST',
      json: { name: 'sample' },
    })

    expect(result.status).toBe(201)
    expect(result.headers.location).toBe('/api/v1/examples/items/item-1')
    expect(result.trace.traceId).toBe('0123456789abcdef0123456789abcdef')
    expect(result.trace.spanId).toBe('fedcba9876543210')
    expect(result.envelope).toEqual({
      value: { id: 'item-1' },
      meta: {
        traceId: '0123456789abcdef0123456789abcdef',
        spanId: 'fedcba9876543210',
        timestamp: '2026-06-12T00:00:00Z',
      },
    })
  })

  it('supports basic and cursor envelopes', async () => {
    stubApiClient(
      {
        data: {
          meta: {
            traceId: '0123456789abcdef0123456789abcdef',
            timestamp: '2026-06-12T00:00:00Z',
          },
        },
      },
      {
        data: {
          values: [{ id: 'item-1' }],
          cursor: { nextCursor: 'item-1', hasNext: true },
          meta: { timestamp: '2026-06-12T00:00:00Z' },
        },
      },
    )

    await expect(apiBasic('/account/consent', { method: 'PATCH' })).resolves.toEqual({
      meta: {
        traceId: '0123456789abcdef0123456789abcdef',
        timestamp: '2026-06-12T00:00:00Z',
      },
    })

    await expect(apiCursor<{ id: string }>('/items')).resolves.toEqual({
      values: [{ id: 'item-1' }],
      cursor: { nextCursor: 'item-1', hasNext: true },
      meta: { timestamp: '2026-06-12T00:00:00Z' },
    })
  })
})

function stubApiClient(
  ...responses: Array<{ status?: number; headers?: Record<string, string>; data: unknown }>
) {
  const requests: CapturedRequest[] = []
  restoreClient = setApiHttpClientForTesting(
    createSkeletonHttpClient({
      baseURL: '/api/v1',
      adapter: captureAdapter(requests, responses),
    }),
  )
  return { requests }
}

function captureAdapter(
  requests: CapturedRequest[],
  responses: Array<{ status?: number; headers?: Record<string, string>; data: unknown }>,
): AxiosAdapter {
  return async (config) => {
    requests.push({
      url: config.url,
      baseURL: config.baseURL,
      method: config.method,
      headers: { ...config.headers },
      data: config.data,
    })
    return responseOf(
      config,
      responses.shift() ?? { data: { meta: { timestamp: '2026-06-12T00:00:00Z' } } },
    )
  }
}

function responseOf(
  config: InternalAxiosRequestConfig,
  response: {
    status?: number
    headers?: Record<string, string>
    data: unknown
  },
): AxiosResponse {
  return {
    config,
    data: response.data,
    headers: response.headers ?? {},
    status: response.status ?? 200,
    statusText: response.status === 201 ? 'Created' : 'OK',
  }
}
