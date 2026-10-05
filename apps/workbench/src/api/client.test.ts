import { afterEach, describe, expect, it } from 'vitest'
import {
  createApiClient,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'
import {
  apiBasic,
  apiCursor,
  apiResponse,
  apiValue,
  createWorkbenchApiClient,
  serverClock,
  setApiHttpClientForTesting,
} from './client'

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
      breakGlass: { accountId: 'acc_admin', reason: 'support', secret: 's3cret' },
    })

    expect(result).toEqual({ id: 'item-1' })
    expect(requests[0].baseURL).toBe('/api/v1')
    expect(requests[0].data).toBe(JSON.stringify({ name: 'sample' }))
    expect(requests[0].headers.Authorization).toBe('Bearer access-token')
    expect(requests[0].headers['Idempotency-Key']).toBe('idem-1')
    expect(requests[0].headers['X-Dev-Email']).toBe('user@example.com')
    expect(requests[0].headers['X-Break-Glass-Account-Id']).toBe('acc_admin')
    expect(requests[0].headers['X-Break-Glass-Reason']).toBe('support')
    expect(requests[0].headers['X-Break-Glass-Secret']).toBe('s3cret')
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

describe('workbench api wiring', () => {
  it('sends the device time zone and feeds the response Date header to the server clock', async () => {
    const requests: CapturedRequest[] = []
    const client = createWorkbenchApiClient({
      env: { VITE_API_BASE_URL: 'http://localhost:18080/api/v1/' },
      adapter: captureAdapter(requests, [
        {
          headers: { date: 'Fri, 12 Jun 2026 00:00:00 GMT' },
          data: { value: 1, meta: { timestamp: 't' } },
        },
      ]),
    })

    await client.value('/hello')

    expect(requests[0].baseURL).toBe('http://localhost:18080/api/v1')
    expect(requests[0].headers['X-Time-Zone']).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    // 보정 뒤 서버 시각은 응답이 말한 시각 근처다(기기 시계와 무관)
    const drift = Math.abs(
      serverClock.now().getTime() - Date.parse('Fri, 12 Jun 2026 00:00:00 GMT'),
    )
    expect(drift).toBeLessThan(5_000)
  })
})

function stubApiClient(
  ...responses: Array<{ status?: number; headers?: Record<string, string>; data: unknown }>
) {
  const requests: CapturedRequest[] = []
  restoreClient = setApiHttpClientForTesting(
    createApiClient({
      baseUrl: '/api/v1',
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
