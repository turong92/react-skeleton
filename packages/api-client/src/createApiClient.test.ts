import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './createApiClient'
import { ApiRequestError, type ApiError, type ApiValueResponse } from './types'

type CapturedRequest = {
  url?: string
  baseURL?: string
  method?: string
  timeout?: number
  headers: Record<string, unknown>
  data: unknown
}

describe('createApiClient', () => {
  it('adds standard skeleton headers and returns the full transport response', async () => {
    const requests: CapturedRequest[] = []
    const client = createApiClient({
      baseUrl: 'https://api.example.com/api/v1',
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
      idempotencyKey: 'idem-1',
      headers: { Authorization: 'Bearer access-token', 'X-Dev-Email': 'user@example.com' },
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
    const client = createApiClient({
      baseUrl: '/api/v1',
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

describe('createApiClient error responses', () => {
  const backendError = {
    code: 'COMMON.VALIDATION_FAILED',
    title: 'Validation failed',
    status: 400,
    detail: 'email format invalid',
    traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    spanId: 'bbbbbbbbbbbbbbbb',
    timestamp: '2026-06-12T00:00:00Z',
    errors: [{ field: 'email', code: 'INVALID_FORMAT', message: 'bad' }],
    data: { retryAfterSeconds: 3 },
  } satisfies ApiError

  async function failure(status: number, data: unknown, headers: Record<string, string> = {}) {
    const client = createApiClient({
      baseUrl: '/api/v1',
      adapter: captureAdapter([], { status, headers, data }),
    })
    const error = await client.value('/x').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiRequestError)
    return error as ApiRequestError
  }

  it('carries the 4xx backend body: status, code, title, detail, field errors and data', async () => {
    const error = await failure(400, backendError)

    expect(error.apiError).toEqual(backendError)
    expect(error.apiError.code).toBe('COMMON.VALIDATION_FAILED')
    expect(error.apiError.status).toBe(400)
    expect(error.apiError.errors).toEqual([
      { field: 'email', code: 'INVALID_FORMAT', message: 'bad' },
    ])
    expect(error.apiError.data).toEqual({ retryAfterSeconds: 3 })
    expect(error.message).toBe('[400] Validation failed - email format invalid')
  })

  it('takes traceId and spanId from the body, traceparent from the response header', async () => {
    const error = await failure(400, backendError, {
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
    })

    expect(error.traceId).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(error.requestId).toBe(error.traceId)
    expect(error.spanId).toBe('bbbbbbbbbbbbbbbb')
    expect(error.traceparent).toBe('00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01')
  })

  it('falls back to the trace headers when the body has no trace ids', async () => {
    const withoutTrace = { ...backendError, traceId: undefined, spanId: undefined }
    const error = await failure(
      401,
      { ...withoutTrace, code: 'AUTH.INVALID_CREDENTIALS', status: 401 },
      {
        'x-trace-id': 'cccccccccccccccccccccccccccccccc',
        'x-span-id': 'dddddddddddddddd',
      },
    )

    expect(error.apiError.code).toBe('AUTH.INVALID_CREDENTIALS')
    expect(error.traceId).toBe('cccccccccccccccccccccccccccccccc')
    expect(error.spanId).toBe('dddddddddddddddd')
  })

  it('carries a 5xx backend body the same way', async () => {
    const error = await failure(500, {
      code: 'COMMON.INTERNAL_SERVER_ERROR',
      title: 'Internal server error',
      status: 500,
      timestamp: '2026-06-12T00:00:00Z',
    })

    expect(error.apiError.status).toBe(500)
    expect(error.apiError.code).toBe('COMMON.INTERNAL_SERVER_ERROR')
  })

  it('accepts the nullable fields the backend leaves null', async () => {
    const error = await failure(404, {
      code: 'COMMON.NOT_FOUND',
      title: 'Not found',
      status: 404,
      detail: null,
      traceId: null,
      spanId: null,
      timestamp: '2026-06-12T00:00:00Z',
      errors: null,
      data: null,
    })

    expect(error.apiError.code).toBe('COMMON.NOT_FOUND')
    expect(error.message).toBe('[404] Not found')
    expect(error.traceId).toMatch(/^[0-9a-f]{32}$/)
  })

  it('synthesizes a CLIENT.HTTP_ERROR when the body is not an ApiError', async () => {
    const error = await failure(502, '<html>Bad gateway</html>')

    expect(error.apiError.code).toBe('CLIENT.HTTP_ERROR')
    expect(error.apiError.status).toBe(502)
    expect(error.apiError.detail).toBe('Failed to reach /x')
  })

  it('synthesizes a CLIENT.HTTP_ERROR when the body lacks the backend code', async () => {
    const error = await failure(400, { title: 'Bad', status: 400, timestamp: 't' })

    expect(error.apiError.code).toBe('CLIENT.HTTP_ERROR')
  })

  it('reports transport failures as status 0 with CLIENT.NETWORK_ERROR', async () => {
    const client = createApiClient({
      baseUrl: '/api/v1',
      adapter: async () => {
        throw new Error('socket hang up')
      },
    })
    const error = (await client.value('/x').catch((caught: unknown) => caught)) as ApiRequestError

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error.apiError.status).toBe(0)
    expect(error.apiError.code).toBe('CLIENT.NETWORK_ERROR')
    expect(error.apiError.detail).toContain('socket hang up')
  })
})

describe('createApiClient envelopes', () => {
  const meta = { timestamp: '2026-06-12T00:00:00Z' }

  it('supports basic, cursor, list and page envelopes and rejects a wrong shape', async () => {
    const responses = [
      { data: { meta } },
      {
        data: { values: [{ id: 'item-1' }], cursor: { nextCursor: 'item-1', hasNext: true }, meta },
      },
      { data: { values: [1, 2], meta } },
      {
        data: {
          values: [1],
          pagination: {
            page: 0,
            size: 1,
            totalElements: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
          meta,
        },
      },
      { data: { nope: true } },
    ]
    const client = createApiClient({
      baseUrl: '/api/v1',
      adapter: async (config) => responseOf(config, responses.shift()!),
    })

    await expect(client.basic('/account/consent', { method: 'PATCH' })).resolves.toEqual({ meta })
    await expect(client.cursor('/items')).resolves.toMatchObject({ cursor: { hasNext: true } })
    await expect(client.list('/numbers')).resolves.toEqual([1, 2])
    await expect(client.page('/pages')).resolves.toMatchObject({ pagination: { totalPages: 1 } })
    await expect(client.value('/wrong')).rejects.toThrow('Expected ApiValueResponse from /wrong')
  })

  it('noContent: a 204 (platform Response.noContent) has no body to validate — resolves with nothing; errors still throw', async () => {
    const calls: string[] = []
    const client = createApiClient({
      baseUrl: '/api/v1',
      adapter: async (config) => {
        calls.push(`${config.method} ${config.url}`)
        return config.url === '/gone'
          ? responseOf(config, {
              status: 404,
              data: { code: 'X.NOT_FOUND', title: 'nf', status: 404, timestamp: 't' },
            })
          : responseOf(config, { status: 204, data: '' })
      },
    })
    await expect(client.noContent('/notes/n1', { method: 'DELETE' })).resolves.toBeUndefined()
    await expect(client.noContent('/gone', { method: 'DELETE' })).rejects.toBeInstanceOf(
      ApiRequestError,
    )
    expect(calls).toEqual(['delete /notes/n1', 'delete /gone'])
  })

  it('builds absolute endpoints from the base url', () => {
    const client = createApiClient({ baseUrl: 'https://api.example.com/api/v1/' })
    expect(client.endpoint('/docs/ui')).toBe('https://api.example.com/api/v1/docs/ui')
  })
})

describe('createApiClient config hooks', () => {
  const ok = { data: { value: 1, meta: { timestamp: 't' } } }

  function clientWith(
    config: Partial<Parameters<typeof createApiClient>[0]>,
    requests: CapturedRequest[],
  ) {
    return createApiClient({
      baseUrl: '/api/v1',
      adapter: captureAdapter(requests, ok),
      ...config,
    })
  }

  it('asks getAuthHeaders for headers on every request (sync or async) and lets the request override them', async () => {
    const requests: CapturedRequest[] = []
    let token = 'one'
    const client = clientWith(
      { getAuthHeaders: async () => ({ Authorization: `Bearer ${token}` }) },
      requests,
    )

    await client.value('/a')
    token = 'two'
    await client.value('/b')
    await client.value('/c', { headers: { Authorization: 'Bearer explicit' } })

    expect(requests.map((r) => r.headers.Authorization)).toEqual([
      'Bearer one',
      'Bearer two',
      'Bearer explicit',
    ])
  })

  it('skips getAuthHeaders when the request says skipAuth (e.g. the login call itself)', async () => {
    const requests: CapturedRequest[] = []
    const client = clientWith(
      { getAuthHeaders: () => ({ Authorization: 'Bearer stale' }) },
      requests,
    )
    await client.value('/auth/login', { skipAuth: true })
    expect(requests[0].headers.Authorization).toBeUndefined()
  })

  it('sends X-Time-Zone from the getTimeZone provider and omits it when the provider returns nothing', async () => {
    const requests: CapturedRequest[] = []
    let zone: string | undefined = 'Asia/Seoul'
    const client = clientWith({ getTimeZone: () => zone }, requests)
    await client.value('/a')
    zone = undefined
    await client.value('/b')
    expect(requests[0].headers['X-Time-Zone']).toBe('Asia/Seoul')
    expect(requests[1].headers['X-Time-Zone']).toBeUndefined()
  })

  it('hands the response Date header to onResponseDate — also for error responses', async () => {
    const dates: Array<string | undefined> = []
    const client = createApiClient({
      baseUrl: '/api/v1',
      onResponseDate: (date) => dates.push(date),
      adapter: async (config) =>
        responseOf(config, {
          status: dates.length === 0 ? 200 : 500,
          headers: { Date: 'Fri, 12 Jun 2026 00:00:00 GMT' },
          data: dates.length === 0 ? { value: 1, meta: { timestamp: 't' } } : 'boom',
        }),
    })
    await client.value('/ok')
    await client.value('/bad').catch(() => undefined)
    expect(dates).toEqual(['Fri, 12 Jun 2026 00:00:00 GMT', 'Fri, 12 Jun 2026 00:00:00 GMT'])
  })

  it('calls onError once with the ApiRequestError before it is thrown, and a throwing hook does not mask it', async () => {
    const seen: ApiRequestError[] = []
    const client = createApiClient({
      baseUrl: '/api/v1',
      onError: (error) => {
        seen.push(error)
        throw new Error('hook bug')
      },
      adapter: captureAdapter([], {
        status: 401,
        data: { code: 'COMMON.UNAUTHORIZED', title: 'Unauthorized', status: 401, timestamp: 't' },
      }),
    })
    const thrown = await client.value('/me').catch((caught: unknown) => caught)
    expect(thrown).toBeInstanceOf(ApiRequestError)
    expect(seen).toEqual([thrown])
  })

  it('logs request groups only when debug is on', async () => {
    const group = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'groupEnd').mockImplementation(() => {})
    await clientWith({}, []).value('/quiet')
    expect(group).not.toHaveBeenCalled()
    await clientWith({ debug: true }, []).value('/loud')
    expect(group).toHaveBeenCalledTimes(1)
  })
})

afterEach(() => vi.restoreAllMocks())

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
