import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from './authApi'
import { createRefreshStore } from './refreshStore'
import { createAuthSession } from './session'
import { createSessionRefresher } from './sessionRefresher'
import { createTokenStore } from './tokenStore'
import { fakeJwt } from './test/fixtures'
import type { AuthTokenResponse } from './types'

const fresh = (): AuthTokenResponse => ({
  accessToken: fakeJwt({ sub: 'acc_1' }),
  tokenType: 'Bearer',
  expiresAt: '2030-01-01T00:00:00Z',
  principal: { accountId: 'acc_1', roles: [] },
  refreshToken: 'r1.2',
  sessionId: 'ses_1',
})
const expired = () =>
  new ApiRequestError(
    { code: ErrorCodes.AUTH_REFRESH_INVALID, title: 'x', status: 401, timestamp: 't' },
    't',
    's',
    'p',
  )

function setup(refresh: AuthApi['refresh']) {
  const store = createTokenStore()
  const refreshStore = createRefreshStore()
  refreshStore.set({ refreshToken: 'r1.1', sessionId: 'ses_1' })
  const api = { refresh, logout: async () => undefined } as unknown as AuthApi
  const refresher = createSessionRefresher({
    tokens: store,
    refreshTokens: refreshStore,
    delivery: 'body',
    refresh: (token) => api.refresh(token),
    locks: false,
  })
  const session = createAuthSession({ api, store, refreshStore, refresher })
  return { store, refreshStore, session, refresher }
}

describe('M4 — restore() shares the single-flight and drops dead credentials', () => {
  it('a restore racing a 401-triggered refresh makes one server call (the rotated token is never presented twice)', async () => {
    const refresh = vi.fn<AuthApi['refresh']>(async () => fresh())
    const { session, refresher, refreshStore } = setup(refresh)
    await Promise.all([session.restore(), refresher.refresh()])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refreshStore.get()?.refreshToken).toBe('r1.2')
    expect(session.getState().status).toBe('authenticated')
  })

  it('a dead refresh token is cleared (the next page load does not present it again)', async () => {
    const { session, refreshStore, store } = setup(async () => {
      throw expired()
    })
    await session.restore()
    expect(refreshStore.get()).toBeNull()
    expect(store.get()).toBeNull()
    expect(session.getState().status).toBe('anonymous')
  })

  it('a network failure on the first attempt returns restore() at once, keeps the credential, shows "reconnecting" (never "anonymous") and reconnects on its own', async () => {
    vi.useFakeTimers()
    try {
      const net = new ApiRequestError(
        { code: 'CLIENT.NETWORK_ERROR', title: 'n', status: 0, timestamp: 't' },
        't',
        's',
        'p',
      )
      let down = true
      const { session, refreshStore } = setup(async () => {
        if (down) throw net
        return fresh()
      })
      const restoring = session.restore()
      await vi.advanceTimersByTimeAsync(10) // the first attempt failed: restore() returns now, it does not wait out the ~60 s of retries
      await expect(restoring).resolves.toBeUndefined()
      expect(session.getState().status).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(70_000)
      expect(session.getState().status).toBe('reconnecting')
      expect(refreshStore.get()?.refreshToken).toBe('r1.1')
      down = false
      await vi.advanceTimersByTimeAsync(20_000)
      expect(session.getState().status).toBe('authenticated')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a background retry that ends in AUTH.REFRESH_INVALID turns "reconnecting" into "anonymous"', async () => {
    vi.useFakeTimers()
    try {
      const net = new ApiRequestError(
        { code: 'CLIENT.NETWORK_ERROR', title: 'n', status: 0, timestamp: 't' },
        't',
        's',
        'p',
      )
      let calls = 0
      const { session, refreshStore } = setup(async () => {
        if (calls++ === 0) throw net
        throw expired()
      })
      await session.restore()
      expect(session.getState().status).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(5_000)
      expect(session.getState().status).toBe('anonymous')
      expect(refreshStore.get()).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a first attempt still pending after 3 s returns restore() as "reconnecting" and is not sent twice; its answer then signs in', async () => {
    vi.useFakeTimers()
    try {
      const refresh = vi.fn<AuthApi['refresh']>(async () => {
        await new Promise((resolve) => setTimeout(resolve, 21_000))
        return fresh()
      })
      const { session } = setup(refresh)
      const restoring = session.restore()
      await vi.advanceTimersByTimeAsync(3_100)
      await expect(restoring).resolves.toBeUndefined()
      expect(session.getState().status).toBe('reconnecting')
      await vi.advanceTimersByTimeAsync(20_000)
      expect(session.getState().status).toBe('authenticated')
      expect(refresh).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
