import { afterEach, describe, expect, it, vi } from 'vitest'
import { authSession } from '../auth/session'
import { queryClient } from './queryClient'

const login = (accountId: string) => ({
  accessToken: `token-${accountId}`,
  tokenType: 'Bearer',
  expiresAt: '2030-01-01T00:00:00Z',
  principal: { accountId, roles: [] },
  refreshToken: `r.${accountId}`,
})

describe('I2 — the server-state cache is dropped whenever the signed-in account goes away or changes', () => {
  it('a different account arriving in the same tab (magic link / social landing) clears the cache', () => {
    authSession.signIn(login('A'))
    queryClient.setQueryData(['notes'], [{ id: 1, title: "A's private note" }])
    authSession.signIn(login('B'))
    expect(queryClient.getQueryData(['notes'])).toBeUndefined()
  })

  it('the same account refreshing its token keeps the cache', () => {
    authSession.signIn(login('B'))
    queryClient.setQueryData(['notes'], ['kept'])
    authSession.signIn({ ...login('B'), accessToken: 'rotated' })
    expect(queryClient.getQueryData(['notes'])).toEqual(['kept'])
  })
})

describe('author-profile device memory — dropped in the same place as the cache', () => {
  const store = new Map<string, string>()
  const fake = {
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  afterEach(() => {
    vi.unstubAllGlobals()
    store.clear()
  })

  it('a sign-out or a different account forgets the remembered profile; unrelated keys stay', () => {
    vi.stubGlobal('localStorage', fake)
    authSession.signIn(login('A'))
    store.set('skeleton.author-profile:A:general', 'prf_a')
    store.set('theme', 'dark')
    authSession.signIn(login('B'))
    expect([...store.keys()]).toEqual(['theme'])
  })

  it('the same account refreshing its token keeps the memory', () => {
    vi.stubGlobal('localStorage', fake)
    authSession.signIn(login('B'))
    store.set('skeleton.author-profile:B:general', 'prf_b')
    authSession.signIn({ ...login('B'), accessToken: 'rotated' })
    expect(store.get('skeleton.author-profile:B:general')).toBe('prf_b')
  })
})
