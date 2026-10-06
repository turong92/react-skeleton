import { afterEach, describe, expect, it, vi } from 'vitest'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function withBrowser() {
  const local = fakeStorage()
  const session = fakeStorage()
  vi.stubGlobal('window', {
    localStorage: local,
    sessionStorage: session,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    location: { origin: 'https://app.test' },
  })
  vi.resetModules()
  return { local, session }
}

describe('I6 — the documented default storage is the real one (localStorage, shared by tabs)', () => {
  it('browserTokenStorage() is window.localStorage', async () => {
    const { local } = await withBrowser()
    const { browserTokenStorage } = await import('./storage')
    expect(browserTokenStorage()).toBe(local)
  })

  it('a sign-in is written to localStorage, never sessionStorage', async () => {
    const { local, session } = await withBrowser()
    const { tokenStore, refreshStore } = await import('./tokenStore')
    tokenStore.set('jwt')
    refreshStore.set({ refreshToken: 'r', sessionId: 's' })
    expect(local.data.size).toBe(2)
    expect(session.data.size).toBe(0)
  })
})

describe('M10 — every storage key, lock and channel name carries this app’s namespace', () => {
  it('the token and refresh keys are namespaced', async () => {
    const { local } = await withBrowser()
    const { tokenStore, refreshStore } = await import('./tokenStore')
    const { AUTH_NAMESPACE } = await import('./authConfig')
    tokenStore.set('jwt')
    refreshStore.set({ refreshToken: 'r', sessionId: 's' })
    expect(AUTH_NAMESPACE).not.toBe('skeleton')
    expect([...local.data.keys()].sort()).toEqual([
      `${AUTH_NAMESPACE}.accessToken`,
      `${AUTH_NAMESPACE}.refresh`,
    ])
  })

  it('the refresh lock is namespaced (two apps on one origin do not queue behind each other)', async () => {
    await withBrowser()
    const names: string[] = []
    vi.stubGlobal('navigator', {
      userAgent: 'test',
      locks: {
        request: async (name: string, run: () => Promise<unknown>) => {
          names.push(name)
          return run()
        },
      },
    })
    const { refresher } = await import('./refresher')
    const { tokenStore, refreshStore } = await import('./tokenStore')
    const { AUTH_NAMESPACE } = await import('./authConfig')
    tokenStore.set('a')
    refreshStore.set({ refreshToken: 'r' })
    await refresher.refresh().catch(() => undefined) // the api is not bound in this test — only the lock name matters
    expect(names).toEqual([`${AUTH_NAMESPACE}.auth.refresh`])
  })
})
