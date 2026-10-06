import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { onAccountChange } from './accountChange'
import type { AuthApi } from './authApi'
import { createUnauthorizedHandler } from './apiClientHooks'
import { createRefreshStore } from './refreshStore'
import { createAuthSession } from './session'
import { createTokenStore, type TokenStorage } from './tokenStore'
import type { AuthTokenResponse } from './types'

const login = (accountId: string): AuthTokenResponse => ({
  accessToken: `token-of-${accountId}`,
  tokenType: 'Bearer',
  expiresAt: '2030-01-01T00:00:00Z',
  principal: { accountId, roles: [] },
  refreshToken: `r.${accountId}`,
})

const api = (overrides: Partial<AuthApi> = {}) =>
  ({ logout: async () => undefined, ...overrides }) as unknown as AuthApi

function setup() {
  const store = createTokenStore()
  const refreshStore = createRefreshStore()
  const session = createAuthSession({ api: api(), store, refreshStore })
  const left = vi.fn()
  onAccountChange(session, left)
  return { store, refreshStore, session, left }
}

describe('I2 — one mechanism tells the app that the signed-in account went away or was replaced', () => {
  it('signing in for the first time is not a change (nothing of a previous account to drop)', () => {
    const { session, left } = setup()
    session.signIn(login('A'))
    expect(left).not.toHaveBeenCalled()
  })

  it('package-internal logout()', async () => {
    const { session, left } = setup()
    session.signIn(login('A'))
    await session.logout()
    expect(left).toHaveBeenCalledExactlyOnceWith({ from: 'A', to: null })
  })

  it('accept() of a different account while signed in (magic link / social landing in a signed-in tab)', () => {
    const { session, left } = setup()
    session.signIn(login('A'))
    session.signIn(login('B'))
    expect(left).toHaveBeenCalledExactlyOnceWith({ from: 'A', to: 'B' })
  })

  it('a token refresh of the same account is not a change', () => {
    const { session, left } = setup()
    session.signIn(login('A'))
    session.signIn({ ...login('A'), accessToken: 'rotated' })
    expect(left).not.toHaveBeenCalled()
  })

  it('another tab signing out (storage event) is noticed', () => {
    let fire: (e: { key: string | null }) => void = () => undefined
    const events = {
      addEventListener: (_: 'storage', l: (e: { key: string | null }) => void) => (fire = l),
      removeEventListener: () => undefined,
    }
    const data = new Map<string, string>()
    const storage: TokenStorage = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    }
    const store = createTokenStore({ storage, crossTab: { events } })
    const session = createAuthSession({ api: api(), store })
    const left = vi.fn()
    onAccountChange(session, left)
    session.signIn(login('A'))
    data.delete('skeleton.accessToken') // the other tab cleared the shared storage
    fire({ key: 'skeleton.accessToken' })
    expect(left).toHaveBeenCalledExactlyOnceWith({ from: 'A', to: null })
  })

  it('the unauthorized handler (a 401 that could not be recovered) is noticed', () => {
    const { session, store, refreshStore, left } = setup()
    session.signIn(login('A'))
    const handler = createUnauthorizedHandler({ store, refreshStore })
    handler(
      new ApiRequestError(
        { code: 'COMMON.UNAUTHORIZED', title: 'u', status: 401, timestamp: 't' },
        't',
        's',
        'p',
      ),
    )
    expect(left).toHaveBeenCalledExactlyOnceWith({ from: 'A', to: null })
  })

  it('stops listening when the returned function is called', async () => {
    const store = createTokenStore()
    const session = createAuthSession({ api: api(), store })
    const left = vi.fn()
    const stop = onAccountChange(session, left)
    session.signIn(login('A'))
    stop()
    await session.logout()
    expect(left).not.toHaveBeenCalled()
  })
})

describe('M3 — the unauthorized handler clears both stores (no login/protected flicker loop)', () => {
  it('drops the refresh credential together with the access token', () => {
    const store = createTokenStore()
    const refreshStore = createRefreshStore()
    store.set('a')
    refreshStore.set({ refreshToken: 'r', sessionId: 's' })
    createUnauthorizedHandler({ store, refreshStore })(
      new ApiRequestError(
        { code: 'COMMON.UNAUTHORIZED', title: 'u', status: 401, timestamp: 't' },
        't',
        's',
        'p',
      ),
    )
    expect(store.get()).toBeNull()
    expect(refreshStore.get()).toBeNull()
  })
})
