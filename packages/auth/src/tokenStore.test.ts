import { describe, expect, it, vi } from 'vitest'
import { createTokenStore, type TokenStorage } from './tokenStore'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const storage: TokenStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
  return { storage, data }
}

describe('createTokenStore', () => {
  it('keeps the token in memory only when no storage is injected', () => {
    const store = createTokenStore()
    expect(store.get()).toBeNull()
    store.set('abc')
    expect(store.get()).toBe('abc')
    store.clear()
    expect(store.get()).toBeNull()
  })

  it('notifies subscribers on change, not on a repeated value, and stops after unsubscribe', () => {
    const store = createTokenStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    store.set('a')
    store.set('a')
    store.set('b')
    store.clear()
    store.clear()
    expect(listener).toHaveBeenCalledTimes(3)
    unsubscribe()
    store.set('c')
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('reads the persisted token at creation and writes through on set / clear', () => {
    const { storage, data } = memoryStorage({ 'skeleton.accessToken': 'saved' })
    const store = createTokenStore({ storage })
    expect(store.get()).toBe('saved')
    store.set('next')
    expect(data.get('skeleton.accessToken')).toBe('next')
    store.clear()
    expect(data.has('skeleton.accessToken')).toBe(false)
  })

  it('uses the storage key it is given', () => {
    const { storage, data } = memoryStorage()
    createTokenStore({ storage, storageKey: 'my-app.token' }).set('x')
    expect([...data.keys()]).toEqual(['my-app.token'])
  })

  it('keeps working in memory when the storage throws (private window, blocked)', () => {
    const broken: TokenStorage = {
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
    const store = createTokenStore({ storage: broken })
    expect(store.get()).toBeNull()
    store.set('still-works')
    expect(store.get()).toBe('still-works')
    store.clear()
    expect(store.get()).toBeNull()
  })

  it('treats an empty token as cleared', () => {
    const store = createTokenStore()
    store.set('a')
    store.set('')
    expect(store.get()).toBeNull()
  })
})
