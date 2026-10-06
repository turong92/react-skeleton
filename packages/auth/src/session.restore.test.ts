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

  it('a network failure keeps the credential and surfaces the error', async () => {
    const net = new ApiRequestError(
      { code: 'CLIENT.NETWORK_ERROR', title: 'n', status: 0, timestamp: 't' },
      't',
      's',
      'p',
    )
    const { session, refreshStore } = setup(async () => {
      throw net
    })
    await expect(session.restore()).rejects.toBe(net)
    expect(refreshStore.get()?.refreshToken).toBe('r1.1')
  })
})
