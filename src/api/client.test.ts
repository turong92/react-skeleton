import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiBasic, apiCursor, apiResponse, apiValue } from './client'

type FetchCall = {
  url: string
  init: RequestInit
}

const calls: FetchCall[] = []

afterEach(() => {
  calls.length = 0
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('adds trace, authorization, dev-login, and idempotency headers', async () => {
    stubFetch(
      jsonResponse({
        value: { id: 'item-1' },
        meta: {
          traceId: '0123456789abcdef0123456789abcdef',
          spanId: 'fedcba9876543210',
          timestamp: '2026-06-12T00:00:00Z',
        },
      }),
    )

    const result = await apiValue<{ id: string }>('/examples/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'sample' }),
      traceId: '0123456789abcdef0123456789abcdef',
      accessToken: 'access-token',
      idempotencyKey: 'idem-1',
      devLogin: { email: 'user@example.com' },
    })

    expect(result).toEqual({ id: 'item-1' })
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get('Authorization')).toBe('Bearer access-token')
    expect(headers.get('Idempotency-Key')).toBe('idem-1')
    expect(headers.get('X-Dev-Email')).toBe('user@example.com')
    expect(headers.get('X-Trace-Id')).toBe('0123456789abcdef0123456789abcdef')
    expect(headers.get('traceparent')).toMatch(
      /^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/,
    )
  })

  it('returns status, headers, and envelope when the caller needs the transport layer', async () => {
    stubFetch(
      jsonResponse(
        {
          value: { id: 'item-1' },
          meta: {
            traceId: '0123456789abcdef0123456789abcdef',
            spanId: 'fedcba9876543210',
            timestamp: '2026-06-12T00:00:00Z',
          },
        },
        {
          status: 201,
          headers: {
            Location: '/api/v1/examples/items/item-1',
            'X-Trace-Id': '0123456789abcdef0123456789abcdef',
            'X-Span-Id': 'fedcba9876543210',
          },
        },
      ),
    )

    const result = await apiResponse('/examples/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'sample' }),
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
    stubFetch(
      jsonResponse({
        meta: {
          traceId: '0123456789abcdef0123456789abcdef',
          timestamp: '2026-06-12T00:00:00Z',
        },
      }),
    )

    await expect(apiBasic('/account/consent', { method: 'PATCH' })).resolves.toEqual({
      meta: {
        traceId: '0123456789abcdef0123456789abcdef',
        timestamp: '2026-06-12T00:00:00Z',
      },
    })

    stubFetch(
      jsonResponse({
        values: [{ id: 'item-1' }],
        cursor: { nextCursor: 'item-1', hasNext: true },
        meta: { timestamp: '2026-06-12T00:00:00Z' },
      }),
    )

    await expect(apiCursor<{ id: string }>('/items')).resolves.toEqual({
      values: [{ id: 'item-1' }],
      cursor: { nextCursor: 'item-1', hasNext: true },
      meta: { timestamp: '2026-06-12T00:00:00Z' },
    })
  })
})

function stubFetch(response: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init })
      return Promise.resolve(response.clone())
    }),
  )
}

function jsonResponse(
  body: unknown,
  init?: {
    status?: number
    headers?: Record<string, string>
  },
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
}
