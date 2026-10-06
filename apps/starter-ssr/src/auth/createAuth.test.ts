import type { AuthApi, TokenStorage } from '@skeleton/auth'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TOKEN_STORAGE_KEY } from '@skeleton/auth'
import { createAuth, createDeferredTokens } from './createAuth'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const storage: TokenStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
  return { data, storage }
}

const api: AuthApi = {
  login: async () => ({
    accessToken: 'fresh-token',
    tokenType: 'Bearer',
    expiresAt: '2030-01-01T00:00:00Z',
    principal: { accountId: 'a1', roles: [] },
  }),
  socialLogin: async () => {
    throw new Error('unused')
  },
  me: async () => {
    throw new Error('unused')
  },
  refresh: async () => {
    throw new Error('unused')
  },
  logout: async () => undefined,
  magicLinkRequest: async () => undefined,
  methods: async () => {
    throw new Error('unused')
  },
  magicLinkRedeem: async () => {
    throw new Error('unused')
  },
}

const build = (storage?: TokenStorage) => {
  const tokens = createDeferredTokens({ storage })
  return { tokens, auth: createAuth({ api, tokens }) }
}

describe('createAuth — a session that is safe to hydrate', () => {
  it('starts anonymous even though the browser storage holds a token (the first client render must equal the server render)', () => {
    const { storage } = fakeStorage({ 'skeleton.accessToken': 'stored-token' })
    const { auth } = build(storage)
    expect(auth.session.getState().status).toBe('anonymous')
    expect(auth.isRestored()).toBe(false)
  })

  it('restore() reads the stored token after hydration: authenticated, restored, subscribers told', () => {
    const { storage } = fakeStorage({ 'skeleton.accessToken': 'stored-token' })
    const { auth } = build(storage)
    const sessionListener = vi.fn()
    const restoredListener = vi.fn()
    auth.session.subscribe(sessionListener)
    auth.subscribeRestored(restoredListener)

    auth.restore()

    expect(auth.session.getState()).toMatchObject({
      status: 'authenticated',
      token: 'stored-token',
    })
    expect(auth.isRestored()).toBe(true)
    expect(sessionListener).toHaveBeenCalled()
    expect(restoredListener).toHaveBeenCalledTimes(1)
    auth.restore()
    expect(restoredListener).toHaveBeenCalledTimes(1)
  })

  it('restore() with nothing stored (or no storage at all, as on the server) still reports restored and stays anonymous', () => {
    const { auth: empty } = build(fakeStorage().storage)
    empty.restore()
    expect(empty.session.getState().status).toBe('anonymous')
    expect(empty.isRestored()).toBe(true)

    const { auth: server } = build()
    server.restore()
    expect(server.session.getState().status).toBe('anonymous')
  })

  it('a login is written to the storage and a logout removes it, so a reload keeps the session', async () => {
    const { storage, data } = fakeStorage()
    const { auth } = build(storage)
    auth.restore()
    await auth.session.login({ email: 'a@b.c', password: 'x' })
    expect(data.get('skeleton.accessToken')).toBe('fresh-token')
    auth.session.logout()
    expect(data.has('skeleton.accessToken')).toBe(false)
  })

  it('a blocked storage (private window) does not throw: memory only', () => {
    const blocked: TokenStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    const { auth } = build(blocked)
    expect(() => auth.restore()).not.toThrow()
    expect(auth.session.getState().status).toBe('anonymous')
  })

  it('exposes the token store so the API client can send the token the session holds', () => {
    const { storage } = fakeStorage({ 'skeleton.accessToken': 'stored-token' })
    const { tokens, auth } = build(storage)
    expect(tokens.store.get()).toBeNull()
    auth.restore()
    expect(tokens.store.get()).toBe('stored-token')
  })
})

describe('deferred refresh credentials', () => {
  it('are not read at creation (server render and the first client paint stay signed-out), only written', () => {
    const { storage, data } = fakeStorage({
      'skeleton.refresh': JSON.stringify({ refreshToken: 'r1.x' }),
    })
    const tokens = createDeferredTokens({ storage })
    expect(tokens.refreshStore.get()).toBeNull()
    tokens.refreshStore.set({ refreshToken: 'r1.y' })
    expect(data.get('skeleton.refresh')).toContain('r1.y')
  })

  it('restore() lifts both the access token and the refresh credential from the storage', () => {
    const { storage } = fakeStorage({
      [DEFAULT_TOKEN_STORAGE_KEY]: 'access-1',
      'skeleton.refresh': JSON.stringify({ refreshToken: 'r1.x', sessionId: 'ses_1' }),
    })
    const tokens = createDeferredTokens({ storage })
    tokens.restore()
    expect(tokens.store.get()).toBe('access-1')
    expect(tokens.refreshStore.get()).toEqual({ refreshToken: 'r1.x', sessionId: 'ses_1' })
  })

  it('after restore(), reload() sees the real storage instead of wiping memory', () => {
    const { storage } = fakeStorage({ [DEFAULT_TOKEN_STORAGE_KEY]: 'access-1' })
    const tokens = createDeferredTokens({ storage })
    tokens.restore()
    tokens.store.reload()
    expect(tokens.store.get()).toBe('access-1')
  })
})
