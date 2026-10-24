import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from './authApi'
import { createAuthSession } from './session'
import { createTokenStore } from './tokenStore'
import type { AuthPrincipal, AuthTokenResponse } from './types'

type Wire = Omit<AuthPrincipal, 'permissions'> & { permissions?: string[] }
const wire: Wire = { accountId: 'acc_1', username: 'u', email: 'u@e.com', roles: ['CS'] }
const tokens = (principal: Wire): AuthTokenResponse => ({
  accessToken: 'tok',
  tokenType: 'Bearer',
  expiresAt: '2026-06-12T01:00:00Z',
  principal: principal as AuthPrincipal,
})
const api = (login: Wire, me: Wire): AuthApi => {
  const unused = async () => {
    throw new Error('unused')
  }
  return {
    login: async () => tokens(login),
    socialLogin: unused,
    me: vi.fn(async () => me as AuthPrincipal),
    refresh: unused,
    logout: async () => undefined,
    magicLinkRequest: async () => undefined,
    magicLinkRedeem: unused,
    cancelDeletion: unused,
    methods: unused,
  }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('session permissions', () => {
  it('refresh() fills [] when /auth/me has no permissions (older server)', async () => {
    const store = createTokenStore()
    store.set('opaque')
    const session = createAuthSession({ api: api(wire, wire), store })
    const principal = await session.refresh()
    expect(principal.permissions).toEqual([])
    expect(session.getState().principal?.permissions).toEqual([])
  })

  it('a login response without permissions is completed from /auth/me once someone listens', async () => {
    const fake = api(wire, { ...wire, permissions: ['payment.read', 'payment.refund'] })
    const session = createAuthSession({ api: fake, store: createTokenStore() })
    session.subscribe(() => undefined)
    await session.login({ email: 'u@e.com', password: 'pw' })
    await settle()
    expect(fake.me).toHaveBeenCalledTimes(1)
    expect(session.getState().principal?.permissions).toEqual(['payment.read', 'payment.refund'])
  })

  it('a login response that already carries permissions needs no extra /auth/me', async () => {
    const fake = api({ ...wire, permissions: ['*'] }, wire)
    const session = createAuthSession({ api: fake, store: createTokenStore() })
    session.subscribe(() => undefined)
    await session.login({ email: 'u@e.com', password: 'pw' })
    await settle()
    expect(fake.me).not.toHaveBeenCalled()
    expect(session.getState().principal?.permissions).toEqual(['*'])
  })

  it('a stored token (reload) is completed from /auth/me when the provider subscribes', async () => {
    const store = createTokenStore()
    store.set('opaque')
    const fake = api(wire, { ...wire, permissions: ['account.read'] })
    const session = createAuthSession({ api: fake, store })
    session.subscribe(() => undefined)
    await settle()
    expect(session.getState().principal?.permissions).toEqual(['account.read'])
  })

  it('a failing /auth/me in the background is swallowed and not retried in a loop', async () => {
    const fake = api(wire, wire)
    fake.me = vi.fn(async () => {
      throw new Error('down')
    })
    const store = createTokenStore()
    store.set('opaque')
    const session = createAuthSession({ api: fake, store })
    session.subscribe(() => undefined)
    session.subscribe(() => undefined)
    await settle()
    expect(fake.me).toHaveBeenCalledTimes(1)
  })
})
