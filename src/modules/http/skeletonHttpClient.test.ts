import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vitest'
import { createSkeletonHttpClient } from './skeletonHttpClient'
import type { ApiValueResponse } from '../../api/types'

type CapturedRequest = {
  url?: string
  baseURL?: string
  method?: string
  timeout?: number
  headers: Record<string, unknown>
  data: unknown
}

describe('createSkeletonHttpClient', () => {
  it('adds standard skeleton headers and returns the full transport response', async () => {
    const requests: CapturedRequest[] = []
    const client = createSkeletonHttpClient({
      baseURL: 'https://api.example.com/api/v1',
      timeoutMs: 4_000,
      adapter: captureAdapter(requests, {
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
        } satisfies ApiValueResponse<{ id: string }>,
      }),
    })

    const response = await client.response<ApiValueResponse<{ id: string }>>('/examples/items', {
      method: 'POST',
      traceId: '0123456789abcdef0123456789abcdef',
      accessToken: 'access-token',
      idempotencyKey: 'idem-1',
      devLogin: { email: 'user@example.com' },
      json: { name: 'sample' },
    })

    expect(response.status).toBe(201)
    expect(response.headers.location).toBe('/api/v1/examples/items/item-1')
    expect(response.trace.traceId).toBe('0123456789abcdef0123456789abcdef')
    expect(response.envelope.value).toEqual({ id: 'item-1' })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      baseURL: 'https://api.example.com/api/v1',
      url: '/examples/items',
      method: 'post',
      timeout: 4_000,
      data: JSON.stringify({ name: 'sample' }),
    })
    expect(requests[0].headers.Authorization).toBe('Bearer access-token')
    expect(requests[0].headers['Idempotency-Key']).toBe('idem-1')
    expect(requests[0].headers['X-Dev-Email']).toBe('user@example.com')
    expect(requests[0].headers['X-Trace-Id']).toBe('0123456789abcdef0123456789abcdef')
    expect(requests[0].headers.traceparent).toMatch(
      /^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/,
    )
  })

  it('retries retryable transport failures before surfacing an error', async () => {
    let attempts = 0
    const client = createSkeletonHttpClient({
      baseURL: '/api/v1',
      retry: { attempts: 2, delayMs: 0 },
      adapter: async (config) => {
        attempts += 1
        if (attempts === 1) {
          throw new Error('temporary network failure')
        }
        return responseOf(config, {
          data: {
            value: { ok: true },
            meta: { timestamp: '2026-06-12T00:00:00Z' },
          } satisfies ApiValueResponse<{ ok: boolean }>,
        })
      },
    })

    await expect(client.value<{ ok: boolean }>('/hello')).resolves.toEqual({ ok: true })
    expect(attempts).toBe(2)
  })
})

function captureAdapter(
  requests: CapturedRequest[],
  response: {
    status?: number
    headers?: Record<string, string>
    data: unknown
  },
): AxiosAdapter {
  return async (config) => {
    requests.push({
      url: config.url,
      baseURL: config.baseURL,
      method: config.method,
      timeout: config.timeout,
      headers: { ...config.headers },
      data: config.data,
    })
    return responseOf(config, response)
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
