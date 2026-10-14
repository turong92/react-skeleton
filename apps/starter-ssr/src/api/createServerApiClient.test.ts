import {
  ClientErrorCodes,
  isErrorCode,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createServerApiClient } from './createServerApiClient'

const reply =
  (seen: InternalAxiosRequestConfig[], data: unknown): AxiosAdapter =>
  async (config) => {
    seen.push(config)
    return { config, data, headers: {}, status: 200, statusText: 'OK' }
  }

describe('createServerApiClient — the backend client the server render uses', () => {
  it('calls the absolute backend url with the server-side timeout, once (no retry), without any user credential', async () => {
    const seen: InternalAxiosRequestConfig[] = []
    const api = createServerApiClient({
      baseUrl: 'http://backend:8080/api/v1',
      timeoutMs: 1234,
      adapter: reply(seen, { value: { message: 'hi' }, meta: { timestamp: 't' } }),
    })
    await expect(api.value('/hello')).resolves.toEqual({ message: 'hi' })
    expect(seen).toHaveLength(1)
    expect(seen[0].baseURL).toBe('http://backend:8080/api/v1')
    expect(seen[0].timeout).toBe(1234)
    expect(seen[0].headers.Authorization).toBeUndefined()
  })

  it('passes the visitor’s host as X-Forwarded-Host on every call — also the public skipAuth ones — and leaves Host alone; nothing when not asked', async () => {
    const seen: InternalAxiosRequestConfig[] = []
    const adapter = reply(seen, { value: {}, meta: { timestamp: 't' } })
    const base = { baseUrl: 'http://backend:8080/api/v1', timeoutMs: 1000, adapter }
    const forwarding = createServerApiClient({ ...base, forwardHost: 'a.localhost:3000' })
    await forwarding.value('/hello')
    await forwarding.value('/auth/methods', { skipAuth: true })
    await createServerApiClient(base).value('/hello')
    expect(seen[0].headers['X-Forwarded-Host']).toBe('a.localhost:3000')
    expect(seen[1].headers['X-Forwarded-Host']).toBe('a.localhost:3000')
    expect(seen.slice(0, 2).every((c) => c.headers.Host === undefined)).toBe(true)
    expect(seen[2].headers['X-Forwarded-Host']).toBeUndefined()
  })

  it('a backend that is down surfaces as the client network error code (the render then falls back)', async () => {
    const api = createServerApiClient({
      baseUrl: 'http://backend:8080/api/v1',
      timeoutMs: 50,
      adapter: async () => {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
      },
    })
    const failure = await api.value('/hello').catch((error: unknown) => error)
    expect(isErrorCode(failure, ClientErrorCodes.NETWORK_ERROR)).toBe(true)
  })
})
