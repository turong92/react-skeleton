import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createAuthApi } from './authApi'
import type { AuthPrincipal, AuthTokenResponse } from './types'

type Call = { path: string; request?: ApiRequest }

function fakeClient<T>(result: T) {
  const calls: Call[] = []
  return {
    calls,
    client: {
      value: async <V>(path: string, request?: ApiRequest) => {
        calls.push({ path, request })
        return result as unknown as V
      },
      noContent: async (path: string, request?: ApiRequest) => {
        calls.push({ path, request })
      },
    },
  }
}

const principal: AuthPrincipal = { accountId: 'acc_1', username: 'u', email: null, roles: ['USER'] }
const token: AuthTokenResponse = {
  accessToken: 'jwt',
  tokenType: 'Bearer',
  expiresAt: '2026-06-12T01:00:00Z',
  principal,
}

describe('createAuthApi (mirrors kotlin-skeleton modules/auth and auth-social)', () => {
  it('login → POST /auth/login with the PasswordLoginRequest body, without the stale token', async () => {
    const { client, calls } = fakeClient(token)
    const result = await createAuthApi(client).login({ email: 'u@example.com', password: 'pw' })
    expect(result).toBe(token)
    expect(calls).toEqual([
      {
        path: '/auth/login',
        request: {
          method: 'POST',
          json: { email: 'u@example.com', password: 'pw' },
          skipAuth: true,
        },
      },
    ])
  })

  it('login accepts accountId or username as the identifier too', async () => {
    const { client, calls } = fakeClient(token)
    const api = createAuthApi(client)
    await api.login({ accountId: 'acc_1', password: 'pw' })
    await api.login({ username: 'admin', password: 'pw' })
    expect(calls.map((c) => c.request?.json)).toEqual([
      { accountId: 'acc_1', password: 'pw' },
      { username: 'admin', password: 'pw' },
    ])
  })

  it('me → GET /auth/me (auth comes from the client getAuthHeaders)', async () => {
    const { client, calls } = fakeClient(principal)
    expect(await createAuthApi(client).me()).toBe(principal)
    expect(calls).toEqual([{ path: '/auth/me', request: undefined }])
  })

  it('socialLogin → POST /auth/social/{provider}/login with authorizationCode and redirectUri', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).socialLogin('google', 'code-1', 'https://app.example.com/cb')
    expect(calls).toEqual([
      {
        path: '/auth/social/google/login',
        request: {
          method: 'POST',
          json: { authorizationCode: 'code-1', redirectUri: 'https://app.example.com/cb' },
          skipAuth: true,
        },
      },
    ])
  })

  it('socialLogin sends the PKCE codeVerifier and nonce next to the code, and nothing extra without them', async () => {
    const { client, calls } = fakeClient(token)
    const api = createAuthApi(client)
    await api.socialLogin('line', 'c', 'https://app/cb', {
      codeVerifier: 'v'.repeat(43),
      nonce: 'nonce-0123456789',
    })
    await api.socialLogin('google', 'c2', 'https://app/cb')
    expect(calls[0].request?.json).toEqual({
      authorizationCode: 'c',
      redirectUri: 'https://app/cb',
      codeVerifier: 'v'.repeat(43),
      nonce: 'nonce-0123456789',
    })
    expect(calls[1].request?.json).toEqual({
      authorizationCode: 'c2',
      redirectUri: 'https://app/cb',
    })
  })

  it('socialLogin leaves redirectUri out when not given and encodes the provider segment', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).socialLogin('my provider', 'code-2')
    expect(calls[0].path).toBe('/auth/social/my%20provider/login')
    expect(JSON.parse(JSON.stringify(calls[0].request?.json))).toEqual({
      authorizationCode: 'code-2',
    })
  })

  it('refresh (body mode) → POST /auth/refresh with the refresh token, skipping auth', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).refresh('r1.abc')
    expect(calls).toEqual([
      {
        path: '/auth/refresh',
        request: { method: 'POST', json: { refreshToken: 'r1.abc' }, skipAuth: true },
      },
    ])
  })

  it('refresh (cookie mode) sends no token but the CSRF header the backend demands', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client, { delivery: 'cookie' }).refresh(null)
    expect(calls[0]).toEqual({
      path: '/auth/refresh',
      request: {
        method: 'POST',
        json: {},
        headers: { 'X-Requested-With': 'fetch' },
        skipAuth: true,
      },
    })
  })

  it('logout → POST /auth/logout (204) with the refresh token; cookie mode adds the CSRF header', async () => {
    const body = fakeClient(token)
    await createAuthApi(body.client).logout('r1.abc')
    expect(body.calls[0]).toEqual({
      path: '/auth/logout',
      request: { method: 'POST', json: { refreshToken: 'r1.abc' }, skipAuth: true },
    })
    const cookie = fakeClient(token)
    await createAuthApi(cookie.client, { delivery: 'cookie' }).logout(null)
    expect(cookie.calls[0].request?.headers).toEqual({ 'X-Requested-With': 'fetch' })
  })

  it('login passes the optional device name as X-Device-Name (no body field)', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).login({ email: 'a@b.c', password: 'pw' }, { deviceName: 'Pixel' })
    expect(calls[0].request?.headers).toEqual({ 'X-Device-Name': 'Pixel' })
    expect(calls[0].request?.json).toEqual({ email: 'a@b.c', password: 'pw' })
  })

  it('magic link redeem passes the optional device name as X-Device-Name too (the contract honours it there)', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).magicLinkRedeem('tok', { deviceName: 'Pixel' })
    expect(calls[0].request?.headers).toEqual({ 'X-Device-Name': 'Pixel' })
    expect(calls[0].request?.json).toEqual({ token: 'tok' })
  })

  it('magic link: request → 202 body, redeem → tokens', async () => {
    const { client, calls } = fakeClient(token)
    const api = createAuthApi(client)
    await api.magicLinkRequest('a@b.c', 'captcha-1')
    await api.magicLinkRedeem('tok')
    expect(calls).toEqual([
      {
        path: '/auth/magic-link/request',
        request: {
          method: 'POST',
          json: { email: 'a@b.c', captchaToken: 'captcha-1' },
          skipAuth: true,
        },
      },
      {
        path: '/auth/magic-link/redeem',
        request: { method: 'POST', json: { token: 'tok' }, skipAuth: true },
      },
    ])
  })

  it('methods → GET /auth/methods, public (the backend tells which sign-in methods exist)', async () => {
    const info = { methods: ['password'], signUp: {}, social: [], captchaRequired: false }
    const { client, calls } = fakeClient(info)
    expect(await createAuthApi(client).methods()).toBe(info)
    expect(calls).toEqual([{ path: '/auth/methods', request: { skipAuth: true } }])
  })

  it('cancelDeletion → POST /account/delete/cancel {restoreToken}, public, answers the login response', async () => {
    const { client, calls } = fakeClient(token)
    expect(await createAuthApi(client).cancelDeletion('opaque')).toBe(token)
    expect(calls).toEqual([
      {
        path: '/account/delete/cancel',
        request: { method: 'POST', json: { restoreToken: 'opaque' }, skipAuth: true },
      },
    ])
  })

  it('cancelDeletion names this device like login does', async () => {
    const { client, calls } = fakeClient(token)
    await createAuthApi(client).cancelDeletion('opaque', { deviceName: 'Pixel' })
    expect(calls[0].request?.headers).toEqual({ 'X-Device-Name': 'Pixel' })
  })
})
