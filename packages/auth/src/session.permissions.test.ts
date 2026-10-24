import { describe, expect, it, vi } from 'vitest'
import type { AuthApi } from './authApi'
import { createAuthSession } from './session'
import { createTokenStore } from './tokenStore'
import { fakeJwt } from './test/fixtures'
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

/** 갱신기(`createSessionRefresher`) · 다른 탭은 `accept` 를 거치지 않고 저장소에 새 액세스 토큰을 바로 쓴다 */
describe('session permissions survive tokens written straight into the store', () => {
  const jwt = (sub: string) => fakeJwt({ sub, roles: ['CS'] })
  const signedIn = async (fake: AuthApi, store = createTokenStore()) => {
    const session = createAuthSession({ api: fake, store })
    session.subscribe(() => undefined)
    await session.login({ email: 'u@e.com', password: 'pw' })
    return { session, store }
  }
  const loginWith = (permissions: string[]) => {
    const fake = api({ ...wire, permissions }, { ...wire, permissions })
    fake.login = async () => ({ ...tokens({ ...wire, permissions }), accessToken: jwt('acc_1') })
    return fake
  }

  it('a refreshed token of the same account keeps the permissions at once and is confirmed by /auth/me', async () => {
    const fake = loginWith(['payment.read', 'payment.refund'])
    const { session, store } = await signedIn(fake)
    store.set(jwt('acc_1') + 'x') // 갱신기가 쓴 새 토큰
    expect(session.getState().principal?.permissions).toEqual(['payment.read', 'payment.refund'])
    await settle()
    expect(fake.me).toHaveBeenCalledTimes(1)
  })

  it('a token written by another tab is treated the same', async () => {
    const fake = loginWith(['account.read'])
    const { session, store } = await signedIn(fake)
    store.set(jwt('acc_1') + 'y')
    store.set(jwt('acc_1') + 'z')
    expect(session.getState().principal?.permissions).toEqual(['account.read'])
  })

  it('another account never inherits them', async () => {
    const fake = loginWith(['*'])
    const { session, store } = await signedIn(fake)
    store.set(jwt('acc_other'))
    expect(session.getState().principal?.permissions).toBeNull()
  })

  it('restore(): a token that appears with nobody having asked yet is completed from /auth/me', async () => {
    const fake = api(wire, { ...wire, permissions: ['payment.read'] })
    const store = createTokenStore()
    const session = createAuthSession({ api: fake, store })
    session.subscribe(() => undefined)
    expect(session.getState().status).toBe('anonymous')
    store.set(jwt('acc_1')) // 새 탭 복원: 갱신기가 저장소에 쓴다
    await settle()
    expect(session.getState().principal?.permissions).toEqual(['payment.read'])
  })

  it('permissions are unknown (null), not empty, until /auth/me answers - and stay null if it keeps failing', async () => {
    vi.useFakeTimers()
    try {
      const fake = api(wire, wire)
      fake.me = vi.fn(async () => {
        throw new Error('down')
      })
      const store = createTokenStore()
      store.set(jwt('acc_1'))
      const session = createAuthSession({ api: fake, store })
      session.subscribe(() => undefined)
      expect(session.getState().principal?.permissions).toBeNull()
      await vi.advanceTimersByTimeAsync(20_000)
      expect(fake.me).toHaveBeenCalledTimes(3) // 몇 번 다시 묻고 멈춘다
      expect(session.getState().principal?.permissions).toBeNull()
      expect(session.getState().permissionsFailed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('giving up on /auth/me can be undone', () => {
  it('retryPermissions() clears the failed mark, asks again and fills the permissions', async () => {
    vi.useFakeTimers()
    try {
      const fake = api(wire, { ...wire, permissions: ['payment.read'] })
      let down = true
      fake.me = vi.fn(async () => {
        if (down) throw new Error('down')
        return { ...wire, permissions: ['payment.read'] } as AuthPrincipal
      })
      const store = createTokenStore()
      store.set(fakeJwt({ sub: 'acc_1', roles: ['CS'] }))
      const session = createAuthSession({ api: fake, store })
      session.subscribe(() => undefined)
      await vi.advanceTimersByTimeAsync(20_000)
      expect(session.getState().permissionsFailed).toBe(true)
      down = false
      session.retryPermissions()
      expect(session.getState().permissionsFailed).toBeUndefined()
      await vi.advanceTimersByTimeAsync(10)
      expect(session.getState().principal?.permissions).toEqual(['payment.read'])
      expect(session.getState().permissionsFailed).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
