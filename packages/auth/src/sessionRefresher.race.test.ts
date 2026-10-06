import { describe, expect, it, vi } from 'vitest'
import { createRefreshStore } from './refreshStore'
import { createAuthSession } from './session'
import { createSessionRefresher } from './sessionRefresher'
import { createTokenStore, type TokenStorage } from './tokenStore'
import type { AuthTokenResponse } from './types'
import type { AuthApi } from './authApi'

const response = (n: number): AuthTokenResponse => ({
  accessToken: `access-${n}`,
  tokenType: 'Bearer',
  expiresAt: '2030-01-01T00:00:00Z',
  principal: { accountId: 'acc_1', roles: [] },
  refreshToken: `r1.${n}`,
  sessionId: 'ses_1',
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

function memoryStorage(data = new Map<string, string>()): TokenStorage {
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('I1 — an in-flight refresh must not resurrect a session that was signed out meanwhile', () => {
  it('same tab: logout while the refresh response is on its way — the late response is discarded', async () => {
    const tokens = createTokenStore()
    const refreshTokens = createRefreshStore()
    tokens.set('access-1')
    refreshTokens.set({ refreshToken: 'r1.1', sessionId: 'ses_1' })
    const pending = deferred<AuthTokenResponse>()
    const ended = vi.fn()
    const refresher = createSessionRefresher({
      tokens,
      refreshTokens,
      delivery: 'body',
      refresh: () => pending.promise,
      onSessionEnded: ended,
      locks: false,
    })
    const api = { logout: async () => undefined } as unknown as AuthApi
    const session = createAuthSession({ api, store: tokens, refreshStore: refreshTokens })

    const result = refresher.refresh('Bearer access-1')
    await session.logout()
    pending.resolve(response(2))

    await expect(result).resolves.toBe(false)
    expect(tokens.get()).toBeNull()
    expect(refreshTokens.get()).toBeNull()
    expect(ended).not.toHaveBeenCalled() // the user chose to sign out — no "session ended" notice
  })

  it('cross tab: the other tab signed out (shared storage) while this tab refreshes — the response is discarded', async () => {
    const data = new Map<string, string>()
    const tabB = {
      tokens: createTokenStore({ storage: memoryStorage(data) }),
      refresh: createRefreshStore({ storage: memoryStorage(data) }),
    }
    tabB.tokens.set('access-1')
    tabB.refresh.set({ refreshToken: 'r1.1', sessionId: 'ses_1' })
    const tabA = {
      tokens: createTokenStore({ storage: memoryStorage(data) }),
      refresh: createRefreshStore({ storage: memoryStorage(data) }),
    }
    const pending = deferred<AuthTokenResponse>()
    const refresher = createSessionRefresher({
      tokens: tabB.tokens,
      refreshTokens: tabB.refresh,
      delivery: 'body',
      refresh: () => pending.promise,
      locks: false,
    })
    const result = refresher.refresh('Bearer access-1')
    tabA.refresh.clear() // tab A signs out: the shared storage is emptied
    tabA.tokens.clear()
    pending.resolve(response(2))

    await expect(result).resolves.toBe(false)
    expect(data.has('skeleton.accessToken')).toBe(false)
    expect(data.has('skeleton.refresh')).toBe(false)
  })

  it('a different sign-in replaced the credential while the refresh was in flight — the stale response is discarded', async () => {
    const tokens = createTokenStore()
    const refreshTokens = createRefreshStore()
    tokens.set('access-1')
    refreshTokens.set({ refreshToken: 'r1.1', sessionId: 'ses_1' })
    const pending = deferred<AuthTokenResponse>()
    const refresher = createSessionRefresher({
      tokens,
      refreshTokens,
      delivery: 'body',
      refresh: () => pending.promise,
      locks: false,
    })
    const result = refresher.refresh('Bearer access-1')
    refreshTokens.set({ refreshToken: 'other.9', sessionId: 'ses_9' })
    tokens.set('other-access')
    pending.resolve(response(2))

    await expect(result).resolves.toBe(false)
    expect(tokens.get()).toBe('other-access')
    expect(refreshTokens.get()?.refreshToken).toBe('other.9')
  })
})
