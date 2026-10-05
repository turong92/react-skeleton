import {
  ApiRequestError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'
import { createTokenStore } from '@skeleton/auth'
import { describe, expect, it, vi } from 'vitest'
import { createAppApiClient } from './createAppApiClient'

type Captured = { baseURL?: string; headers: Record<string, unknown> }

function adapterFor(
  captured: Captured[],
  reply: { status?: number; data: unknown; headers?: Record<string, string> },
): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    captured.push({ baseURL: config.baseURL, headers: { ...config.headers } })
    return {
      config,
      data: reply.data,
      headers: reply.headers ?? {},
      status: reply.status ?? 200,
      statusText: 'OK',
    }
  }
}

const ok = { data: { value: { message: 'hi' }, meta: { timestamp: 't' } } }

describe('createAppApiClient — the env wiring a project copies', () => {
  it('builds the base url from VITE_API_BASE_URL (default /api/v1)', async () => {
    const captured: Captured[] = []
    const withEnv = createAppApiClient({
      env: { VITE_API_BASE_URL: 'http://localhost:18080/api/v1/' },
      tokenStore: createTokenStore(),
      adapter: adapterFor(captured, ok),
    })
    await withEnv.value('/hello')
    const bare = createAppApiClient({
      env: {},
      tokenStore: createTokenStore(),
      adapter: adapterFor(captured, ok),
    })
    await bare.value('/hello')
    expect(captured.map((c) => c.baseURL)).toEqual(['http://localhost:18080/api/v1', '/api/v1'])
  })

  it('sends the device time zone and the stored token as a Bearer header', async () => {
    const captured: Captured[] = []
    const tokenStore = createTokenStore()
    const client = createAppApiClient({ env: {}, tokenStore, adapter: adapterFor(captured, ok) })

    await client.value('/hello')
    tokenStore.set('jwt-1')
    await client.value('/auth/me')

    expect(captured[0].headers['X-Time-Zone']).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
    expect(captured[0].headers.Authorization).toBeUndefined()
    expect(captured[1].headers.Authorization).toBe('Bearer jwt-1')
  })

  it('a 401 drops the token and tells the app, a 500 does not', async () => {
    const tokenStore = createTokenStore()
    tokenStore.set('expired')
    const onUnauthorized = vi.fn()
    const unauthorized = createAppApiClient({
      env: {},
      tokenStore,
      onUnauthorized,
      adapter: adapterFor([], {
        status: 401,
        data: { code: 'COMMON.UNAUTHORIZED', title: 'Unauthorized', status: 401, timestamp: 't' },
      }),
    })
    await expect(unauthorized.value('/auth/me')).rejects.toBeInstanceOf(ApiRequestError)
    expect(tokenStore.get()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)

    tokenStore.set('fresh')
    const broken = createAppApiClient({
      env: {},
      tokenStore,
      onUnauthorized,
      adapter: adapterFor([], {
        status: 500,
        data: { code: 'COMMON.INTERNAL_SERVER_ERROR', title: 'Oops', status: 500, timestamp: 't' },
      }),
    })
    await expect(broken.value('/hello')).rejects.toBeInstanceOf(ApiRequestError)
    expect(tokenStore.get()).toBe('fresh')
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
