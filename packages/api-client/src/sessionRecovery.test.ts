import type { AxiosAdapter } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { createApiClient, type UnauthorizedContext } from './createApiClient'
import { ErrorCodes, retryAfterSeconds } from './errorCodes'
import { ApiRequestError } from './types'

const ok = (config: Parameters<AxiosAdapter>[0], value: unknown) => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  data: { value, meta: { timestamp: 't' } },
})
const unauthorized = (config: Parameters<AxiosAdapter>[0]) => ({
  status: 401,
  statusText: 'Unauthorized',
  headers: {},
  config,
  data: { code: 'COMMON.UNAUTHORIZED', title: 'Unauthorized', status: 401, timestamp: 't' },
})

describe('account / session error codes', () => {
  it('names every code of the account http contract section 10', () => {
    expect(ErrorCodes).toMatchObject({
      AUTH_EMAIL_NOT_VERIFIED: 'AUTH.EMAIL_NOT_VERIFIED',
      AUTH_ACCOUNT_SUSPENDED: 'AUTH.ACCOUNT_SUSPENDED',
      AUTH_TOO_MANY_ATTEMPTS: 'AUTH.TOO_MANY_ATTEMPTS',
      AUTH_REFRESH_INVALID: 'AUTH.REFRESH_INVALID',
      AUTH_REFRESH_REUSED: 'AUTH.REFRESH_REUSED',
      AUTH_SESSION_NOT_FOUND: 'AUTH.SESSION_NOT_FOUND',
      AUTH_CSRF_HEADER_REQUIRED: 'AUTH.CSRF_HEADER_REQUIRED',
      ACCOUNT_TOKEN_INVALID: 'ACCOUNT.TOKEN_INVALID',
      ACCOUNT_PASSWORD_POLICY: 'ACCOUNT.PASSWORD_POLICY',
      ACCOUNT_CURRENT_PASSWORD_INVALID: 'ACCOUNT.CURRENT_PASSWORD_INVALID',
      ACCOUNT_REAUTH_FAILED: 'ACCOUNT.REAUTH_FAILED',
      ACCOUNT_CAPTCHA_FAILED: 'ACCOUNT.CAPTCHA_FAILED',
      ACCOUNT_EMAIL_TAKEN: 'ACCOUNT.EMAIL_TAKEN',
      ACCOUNT_SIGN_UP_CLOSED: 'ACCOUNT.SIGN_UP_CLOSED',
      ACCOUNT_SOCIAL_EMAIL_CONFLICT: 'ACCOUNT.SOCIAL_EMAIL_CONFLICT',
      ACCOUNT_IDENTITY_TAKEN: 'ACCOUNT.IDENTITY_TAKEN',
      ACCOUNT_IDENTITY_EXISTS: 'ACCOUNT.IDENTITY_EXISTS',
      ACCOUNT_IDENTITY_NOT_FOUND: 'ACCOUNT.IDENTITY_NOT_FOUND',
      ACCOUNT_LAST_SIGN_IN_METHOD: 'ACCOUNT.LAST_SIGN_IN_METHOD',
      ACCOUNT_LAST_ADMIN: 'ACCOUNT.LAST_ADMIN',
      ACCOUNT_SELF_ACTION_FORBIDDEN: 'ACCOUNT.SELF_ACTION_FORBIDDEN',
      ACCOUNT_NOT_FOUND: 'ACCOUNT.NOT_FOUND',
      ACCOUNT_RATE_LIMITED: 'ACCOUNT.RATE_LIMITED',
      ACCOUNT_PASSWORD_REQUIRED: 'ACCOUNT.PASSWORD_REQUIRED',
      ACCOUNT_METHOD_UNKNOWN: 'ACCOUNT.METHOD_UNKNOWN',
    })
  })
})

describe('retryAfterSeconds', () => {
  const error = (data: unknown) =>
    new ApiRequestError(
      { code: 'ACCOUNT.RATE_LIMITED', title: 'x', status: 429, timestamp: 't', data },
      't',
      's',
      'p',
    )
  it('reads data.retryAfterSeconds of a 429 body', () => {
    expect(retryAfterSeconds(error({ retryAfterSeconds: 42 }))).toBe(42)
  })
  it('is undefined when the body has none, or for other errors', () => {
    expect(retryAfterSeconds(error(undefined))).toBeUndefined()
    expect(retryAfterSeconds(new Error('x'))).toBeUndefined()
  })
  it('falls back to the Retry-After header carried on the error', () => {
    const withHeader = error(undefined) as ApiRequestError & { retryAfterHeader?: number }
    expect(retryAfterSeconds(Object.assign(withHeader, { retryAfterHeader: 7 }))).toBe(7)
  })
})

describe('recoverUnauthorized', () => {
  it('retries the request once with fresh auth headers after the hook recovers', async () => {
    let token = 'old'
    const seen: string[] = []
    const adapter: AxiosAdapter = async (config) => {
      const auth = String(config.headers.get('Authorization'))
      seen.push(auth)
      return auth === 'Bearer new' ? ok(config, 'fine') : unauthorized(config)
    }
    const recover = vi.fn(async (context: UnauthorizedContext) => {
      void context
      token = 'new'
      return true
    })
    const client = createApiClient({
      baseUrl: '/api',
      adapter,
      getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
      recoverUnauthorized: recover,
    })
    await expect(client.value('/me')).resolves.toBe('fine')
    expect(seen).toEqual(['Bearer old', 'Bearer new'])
    expect(recover).toHaveBeenCalledTimes(1)
    expect(recover.mock.calls[0][0]).toMatchObject({ failedAuthorization: 'Bearer old' })
  })

  it('does not loop: a second 401 after recovery is thrown and onError sees it once', async () => {
    const onError = vi.fn()
    const client = createApiClient({
      baseUrl: '/api',
      adapter: async (config) => unauthorized(config),
      getAuthHeaders: () => ({ Authorization: 'Bearer x' }),
      recoverUnauthorized: async () => true,
      onError,
    })
    await expect(client.value('/me')).rejects.toMatchObject({ apiError: { status: 401 } })
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('surfaces the original 401 when the hook returns false', async () => {
    const client = createApiClient({
      baseUrl: '/api',
      adapter: async (config) => unauthorized(config),
      recoverUnauthorized: async () => false,
    })
    await expect(client.value('/me')).rejects.toMatchObject({ apiError: { status: 401 } })
  })

  it('surfaces what the hook throws (a refresh that hit the network error is not a 401)', async () => {
    const boom = new ApiRequestError(
      { code: 'CLIENT.NETWORK_ERROR', title: 'n', status: 0, timestamp: 't' },
      't',
      's',
      'p',
    )
    const client = createApiClient({
      baseUrl: '/api',
      adapter: async (config) => unauthorized(config),
      recoverUnauthorized: async () => {
        throw boom
      },
    })
    await expect(client.value('/me')).rejects.toBe(boom)
  })

  it('never recovers skipAuth requests (login / refresh themselves)', async () => {
    const recover = vi.fn(async () => true)
    const client = createApiClient({
      baseUrl: '/api',
      adapter: async (config) => unauthorized(config),
      recoverUnauthorized: recover,
    })
    await expect(client.value('/auth/login', { skipAuth: true })).rejects.toBeDefined()
    expect(recover).not.toHaveBeenCalled()
  })
})

describe('withCredentials', () => {
  it('sends cookies when the client is configured for cookie delivery', async () => {
    let seen: boolean | undefined
    const client = createApiClient({
      baseUrl: '/api',
      withCredentials: true,
      adapter: async (config) => {
        seen = config.withCredentials
        return ok(config, 1)
      },
    })
    await client.value('/x')
    expect(seen).toBe(true)
  })
})
