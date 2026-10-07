import { describe, expect, it, vi } from 'vitest'
import { fakeJwt } from './test/fixtures'
import { createAuthSession } from './session'
import { createRefreshStore } from './refreshStore'
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
    refresh: async () => response('refreshed'),
    logout: async () => undefined,
    magicLinkRequest: async () => undefined,
    magicLinkRedeem: async () => response('magic-token'),
    cancelDeletion: async () => response('restored-token'),
    methods: async () => {
      throw new Error('unused')
    },
    ...overrides,
  }
}

describe('createAuthSession', () => {
  it('starts anonymous with an empty store', () => {
    const session = createAuthSession({ api: fakeApi(), store: createTokenStore() })
    expect(session.getState()).toEqual({ status: 'anonymous', token: null, principal: null })
  })

  it('magicLinkLogin names this device like login does (X-Device-Name for the session list)', async () => {
    const magicLinkRedeem = vi.fn(async () => response('magic-token'))
    const session = createAuthSession({
      api: fakeApi({ magicLinkRedeem }),
      store: createTokenStore(),
      deviceName: 'Pixel',
    })
    await session.magicLinkLogin('tok')
    expect(magicLinkRedeem).toHaveBeenCalledWith('tok', { deviceName: 'Pixel' })
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

  describe('with a refresh store', () => {
    const withRefresh = (
      overrides: Partial<AuthApi> = {},
      delivery: 'body' | 'cookie' = 'body',
    ) => {
      const store = createTokenStore()
      const refreshStore = createRefreshStore()
      const api = fakeApi(overrides)
      const session = createAuthSession({ api, store, refreshStore, delivery })
      return { store, refreshStore, session, api }
    }
    const rotated = (n: number): AuthTokenResponse => ({
      ...response(`access-${n}`),
      refreshToken: `r1.${n}`,
      refreshExpiresAt: '2026-11-05T00:00:00Z',
      sessionId: 'ses_1',
    })

    it('login keeps the refresh token next to the access token', async () => {
      const { session, refreshStore } = withRefresh({ login: async () => rotated(1) })
      await session.login({ email: 'u@e.com', password: 'pw' })
      expect(refreshStore.get()).toEqual({
        refreshToken: 'r1.1',
        refreshExpiresAt: '2026-11-05T00:00:00Z',
        sessionId: 'ses_1',
      })
    })

    it('cookie mode keeps only the session marker, never a token', async () => {
      const { session, refreshStore } = withRefresh(
        { login: async () => ({ ...rotated(1), refreshToken: 'leaked' }) },
        'cookie',
      )
      await session.login({ email: 'u@e.com', password: 'pw' })
      expect(refreshStore.get()?.refreshToken).toBeNull()
      expect(refreshStore.get()?.sessionId).toBe('ses_1')
    })

    it('signIn(response) adopts tokens from any flow (magic link redeem)', async () => {
      const { session, store } = withRefresh({ magicLinkRedeem: async () => rotated(3) })
      await session.magicLinkLogin('tok')
      expect(store.get()).toBe('access-3')
    })

    it('logout clears locally at once, then tells the server which refresh token to revoke', async () => {
      const logout = vi.fn(async () => undefined)
      const { session, store, refreshStore } = withRefresh({
        login: async () => rotated(1),
        logout,
      })
      await session.login({ email: 'u@e.com', password: 'pw' })
      const pending = session.logout()
      expect(store.get()).toBeNull() // sync part
      expect(refreshStore.get()).toBeNull()
      await pending
      expect(logout).toHaveBeenCalledWith('r1.1')
    })

    it('logout still signs out when the server call fails', async () => {
      const { session, store } = withRefresh({
        login: async () => rotated(1),
        logout: async () => {
          throw new Error('offline')
        },
      })
      await session.login({ email: 'u@e.com', password: 'pw' })
      await expect(session.logout()).resolves.toBeUndefined()
      expect(store.get()).toBeNull()
    })

    it('another tab clearing the refresh store signs this tab out too', async () => {
      const { session, refreshStore, store } = withRefresh({ login: async () => rotated(1) })
      await session.login({ email: 'u@e.com', password: 'pw' })
      refreshStore.clear()
      store.clear()
      expect(session.getState().status).toBe('anonymous')
    })

    it('restore() exchanges a surviving refresh credential for an access token (new tab, memory access store)', async () => {
      const refresh = vi.fn(async () => rotated(5))
      const { session, store, refreshStore } = withRefresh({ refresh })
      refreshStore.set({ refreshToken: 'r1.4', sessionId: 'ses_1' })
      expect(session.getState().status).toBe('anonymous')
      await session.restore()
      expect(refresh).toHaveBeenCalledWith('r1.4')
      expect(store.get()).toBe('access-5')
      expect(refreshStore.get()?.refreshToken).toBe('r1.5')
      expect(session.getState().status).toBe('authenticated')
    })

    it('restore() does nothing when already authenticated or when there is no credential', async () => {
      const refresh = vi.fn(async () => rotated(5))
      const none = withRefresh({ refresh })
      await none.session.restore()
      expect(refresh).not.toHaveBeenCalled()
      const have = withRefresh({ refresh })
      have.store.set('x')
      have.refreshStore.set({ refreshToken: 'r1.4' })
      await have.session.restore()
      expect(refresh).not.toHaveBeenCalled()
    })
  })

  it('cancelDeletion signs in with the answer exactly like a login (token stored, device named)', async () => {
    const cancelDeletion = vi.fn(async () => response('restored-token'))
    const store = createTokenStore()
    const session = createAuthSession({
      api: fakeApi({ cancelDeletion }),
      store,
      deviceName: 'Pixel',
    })
    await session.cancelDeletion('opaque')
    expect(cancelDeletion).toHaveBeenCalledWith('opaque', { deviceName: 'Pixel' })
    expect(store.get()).toBe('restored-token')
    expect(session.getState().status).toBe('authenticated')
  })

  it('cancelDeletion that fails leaves the session anonymous', async () => {
    const store = createTokenStore()
    const session = createAuthSession({
      api: fakeApi({
        cancelDeletion: async () => {
          throw new Error('410')
        },
      }),
      store,
    })
    await expect(session.cancelDeletion('opaque')).rejects.toThrow('410')
    expect(store.get()).toBeNull()
  })
})
