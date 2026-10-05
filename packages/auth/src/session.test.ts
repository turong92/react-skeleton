import { describe, expect, it, vi } from 'vitest'
import { fakeJwt } from './test/fixtures'
import { createAuthSession } from './session'
import { createTokenStore } from './tokenStore'
import type { AuthApi } from './authApi'
import type { AuthPrincipal, AuthTokenResponse } from './types'

const principal: AuthPrincipal = {
  accountId: 'acc_1',
  username: 'u',
  email: 'u@e.com',
  roles: ['USER'],
}
const response = (accessToken: string): AuthTokenResponse => ({
  accessToken,
  tokenType: 'Bearer',
  expiresAt: '2026-06-12T01:00:00Z',
  principal,
})

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: async () => response('login-token'),
    socialLogin: async () => response('social-token'),
    me: async () => principal,
    ...overrides,
  }
}

describe('createAuthSession', () => {
  it('starts anonymous with an empty store', () => {
    const session = createAuthSession({ api: fakeApi(), store: createTokenStore() })
    expect(session.getState()).toEqual({ status: 'anonymous', token: null, principal: null })
  })

  it('starts authenticated from a stored token, decoding the principal from its claims', () => {
    const store = createTokenStore()
    store.set(fakeJwt({ sub: 'acc_9', roles: ['ADMIN'] }))
    const { status, principal: decoded } = createAuthSession({ api: fakeApi(), store }).getState()
    expect(status).toBe('authenticated')
    expect(decoded).toEqual({ accountId: 'acc_9', username: null, email: null, roles: ['ADMIN'] })
  })

  it('login stores the token, takes the principal from the response and notifies subscribers', async () => {
    const store = createTokenStore()
    const login = vi.fn(async () => response('login-token'))
    const session = createAuthSession({ api: fakeApi({ login }), store })
    const listener = vi.fn()
    session.subscribe(listener)

    const result = await session.login({ email: 'u@e.com', password: 'pw' })

    expect(login).toHaveBeenCalledWith({ email: 'u@e.com', password: 'pw' })
    expect(result.accessToken).toBe('login-token')
    expect(store.get()).toBe('login-token')
    expect(session.getState()).toEqual({
      status: 'authenticated',
      token: 'login-token',
      principal,
    })
    expect(listener).toHaveBeenCalled()
  })

  it('a failed login keeps the state and rethrows', async () => {
    const store = createTokenStore()
    const session = createAuthSession({
      api: fakeApi({
        login: async () => {
          throw new Error('bad credentials')
        },
      }),
      store,
    })
    await expect(session.login({ email: 'x', password: 'y' })).rejects.toThrow('bad credentials')
    expect(session.getState().status).toBe('anonymous')
    expect(store.get()).toBeNull()
  })

  it('socialLogin passes provider, code and redirectUri and stores the token', async () => {
    const store = createTokenStore()
    const socialLogin = vi.fn(async () => response('social-token'))
    const session = createAuthSession({ api: fakeApi({ socialLogin }), store })
    await session.socialLogin('kakao', 'code-1', 'https://app/cb')
    expect(socialLogin).toHaveBeenCalledWith('kakao', 'code-1', 'https://app/cb')
    expect(store.get()).toBe('social-token')
    expect(session.getState().principal).toEqual(principal)
  })

  it('logout clears the token and the principal', async () => {
    const store = createTokenStore()
    const session = createAuthSession({ api: fakeApi(), store })
    await session.login({ email: 'u@e.com', password: 'pw' })
    session.logout()
    expect(store.get()).toBeNull()
    expect(session.getState()).toEqual({ status: 'anonymous', token: null, principal: null })
  })

  it('follows the store when something else clears it (a 401 handler)', async () => {
    const store = createTokenStore()
    const session = createAuthSession({ api: fakeApi(), store })
    await session.login({ email: 'u@e.com', password: 'pw' })
    const listener = vi.fn()
    session.subscribe(listener)
    store.clear()
    expect(session.getState().status).toBe('anonymous')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('refresh asks /auth/me and replaces the principal; a failure leaves it as it was', async () => {
    const store = createTokenStore()
    store.set('opaque-token')
    const next: AuthPrincipal = { ...principal, roles: ['ADMIN'] }
    let fail = false
    const session = createAuthSession({
      api: fakeApi({
        me: async () => {
          if (fail) throw new Error('down')
          return next
        },
      }),
      store,
    })
    expect(session.getState().principal).toBeNull()
    await session.refresh()
    expect(session.getState().principal).toEqual(next)
    fail = true
    await expect(session.refresh()).rejects.toThrow('down')
    expect(session.getState().principal).toEqual(next)
  })

  it('hands React a stable snapshot until something changes', async () => {
    const session = createAuthSession({ api: fakeApi(), store: createTokenStore() })
    expect(session.getState()).toBe(session.getState())
    const before = session.getState()
    await session.login({ email: 'u@e.com', password: 'pw' })
    expect(session.getState()).not.toBe(before)
    expect(session.getState()).toBe(session.getState())
  })
})
