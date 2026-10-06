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
})
