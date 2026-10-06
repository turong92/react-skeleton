import { describe, expect, it, vi } from 'vitest'
import { createRefreshStore } from './refreshStore'
import { createTokenStore, type TokenStorage } from './tokenStore'

/** 두 탭이 같은 localStorage 를 나눠 쓰는 모양 — 한 탭이 쓰면 다른 탭에 storage 이벤트가 간다 */
function sharedStorage() {
  const data = new Map<string, string>()
  const targets: Array<{ listeners: Set<(event: { key: string | null }) => void> }> = []
  const tab = () => {
    const mine = { listeners: new Set<(event: { key: string | null }) => void>() }
    targets.push(mine)
    const storage: TokenStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        data.set(key, value)
        targets.filter((t) => t !== mine).forEach((t) => t.listeners.forEach((l) => l({ key })))
      },
      removeItem: (key) => {
        data.delete(key)
        targets.filter((t) => t !== mine).forEach((t) => t.listeners.forEach((l) => l({ key })))
      },
    }
    const events = {
      addEventListener: (_type: 'storage', listener: (event: { key: string | null }) => void) =>
        void mine.listeners.add(listener),
      removeEventListener: (_type: 'storage', listener: (event: { key: string | null }) => void) =>
        void mine.listeners.delete(listener),
    }
    return { storage, events }
  }
  return { tab, data }
}

describe('token store across tabs', () => {
  it('another tab signing in or out reaches this tab (storage event)', () => {
    const shared = sharedStorage()
    const a = shared.tab()
    const b = shared.tab()
    const storeA = createTokenStore({ storage: a.storage, crossTab: { events: a.events } })
    const storeB = createTokenStore({ storage: b.storage, crossTab: { events: b.events } })
    const seen = vi.fn()
    storeB.subscribe(seen)
    storeA.set('token-1')
    expect(storeB.get()).toBe('token-1')
    expect(seen).toHaveBeenCalledTimes(1)
    storeA.clear()
    expect(storeB.get()).toBeNull()
    expect(seen).toHaveBeenCalledTimes(2)
  })

  it('ignores storage events of other keys', () => {
    const shared = sharedStorage()
    const a = shared.tab()
    const b = shared.tab()
    const storeB = createTokenStore({ storage: b.storage, crossTab: { events: b.events } })
    const seen = vi.fn()
    storeB.subscribe(seen)
    a.storage.setItem('something-else', 'x')
    expect(seen).not.toHaveBeenCalled()
  })

  it('reload() re-reads the persisted value for decisions taken inside a lock', () => {
    const shared = sharedStorage()
    const a = shared.tab()
    const b = shared.tab()
    const storeA = createTokenStore({ storage: a.storage })
    const storeB = createTokenStore({ storage: b.storage }) // no event wiring: only reload sees it
    storeA.set('rotated')
    expect(storeB.get()).toBeNull()
    storeB.reload()
    expect(storeB.get()).toBe('rotated')
  })

  it('is inert without a window (SSR): no listener, no throw', () => {
    expect(() => createTokenStore({ crossTab: true })).not.toThrow()
  })
})

describe('refresh store', () => {
  it('round-trips the credentials as JSON and syncs across tabs', () => {
    const shared = sharedStorage()
    const a = shared.tab()
    const b = shared.tab()
    const storeA = createRefreshStore({ storage: a.storage, crossTab: { events: a.events } })
    const storeB = createRefreshStore({ storage: b.storage, crossTab: { events: b.events } })
    storeA.set({
      refreshToken: 'r1.x',
      refreshExpiresAt: '2026-11-05T00:00:00Z',
      sessionId: 'ses_1',
    })
    expect(storeB.get()).toEqual({
      refreshToken: 'r1.x',
      refreshExpiresAt: '2026-11-05T00:00:00Z',
      sessionId: 'ses_1',
    })
    storeA.clear()
    expect(storeB.get()).toBeNull()
  })

  it('treats corrupt persisted JSON as signed out', () => {
    const shared = sharedStorage()
    const a = shared.tab()
    a.storage.setItem('skeleton.refresh', '{not json')
    expect(createRefreshStore({ storage: a.storage }).get()).toBeNull()
  })
})
