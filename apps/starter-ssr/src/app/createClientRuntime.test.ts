import type { TokenStorage } from '@skeleton/auth'
import { describe, expect, it } from 'vitest'
import { AUTH_NAMESPACE } from '../auth/authConfig'
import { createClientRuntime } from './createClientApp'

function memory(): TokenStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}
const login = (accountId: string) => ({
  accessToken: `token-${accountId}`,
  tokenType: 'Bearer',
  expiresAt: '2030-01-01T00:00:00Z',
  principal: { accountId, roles: [] },
  refreshToken: `r.${accountId}`,
})

describe('I2 — the browser app drops its server-state cache when the account goes away or changes', () => {
  it('a different account signing in (magic link / social) clears the cache', () => {
    const { auth, queryClient } = createClientRuntime({ env: {}, storage: memory() })
    auth.session.signIn(login('A'))
    queryClient.setQueryData(['notes'], ["A's note"])
    auth.session.signIn(login('B'))
    expect(queryClient.getQueryData(['notes'])).toBeUndefined()
  })

  it('signing out (the header button, or another tab through the storage event) clears the cache', async () => {
    const { auth, queryClient } = createClientRuntime({ env: {}, storage: memory() })
    auth.session.signIn(login('A'))
    queryClient.setQueryData(['notes'], ["A's note"])
    await auth.session.logout()
    expect(queryClient.getQueryData(['notes'])).toBeUndefined()
  })

  it('a server-rendered cache hydrated before sign-in survives the first sign-in', () => {
    const { auth, queryClient } = createClientRuntime({ env: {}, storage: memory() })
    queryClient.setQueryData(['public'], ['from the server'])
    auth.session.signIn(login('A'))
    expect(queryClient.getQueryData(['public'])).toEqual(['from the server'])
  })
})

describe('M10 — storage names carry the app namespace', () => {
  it('tokens are stored under <namespace>.accessToken / .refresh', () => {
    const storage = memory()
    const { auth } = createClientRuntime({ env: {}, storage })
    auth.restore()
    auth.session.signIn(login('A'))
    expect(AUTH_NAMESPACE).not.toBe('skeleton')
    expect([...storage.data.keys()].sort()).toEqual([
      `${AUTH_NAMESPACE}.accessToken`,
      `${AUTH_NAMESPACE}.refresh`,
    ])
  })
})
