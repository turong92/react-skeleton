import { describe, expect, it, vi } from 'vitest'
import { createConsentStore, type ConsentState, type StorageLike } from './consentStore'

function memoryStorage(
  initial: Record<string, string> = {},
): StorageLike & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  }
}
const base = {
  categories: ['necessary', 'analytics', 'marketing'],
  version: '1',
  storageKey: 'consent',
}
const NOW = new Date('2026-10-06T00:00:00Z')

describe('createConsentStore', () => {
  it('starts undecided: only the necessary category is on, everything else off', () => {
    const store = createConsentStore({ ...base, storage: memoryStorage() })
    expect(store.getState()).toEqual<ConsentState>({
      status: 'undecided',
      version: '1',
      choices: { necessary: true, analytics: false, marketing: false },
    })
  })

  it('acceptAll / rejectAll decide and persist; rejectAll keeps the necessary one on', () => {
    const storage = memoryStorage()
    const store = createConsentStore({ ...base, storage, now: () => NOW })
    store.rejectAll()
    expect(store.getState()).toMatchObject({
      status: 'decided',
      choices: { necessary: true, analytics: false, marketing: false },
      decidedAt: NOW.toISOString(),
    })
    expect(JSON.parse(storage.data.consent)).toMatchObject({
      version: '1',
      choices: { analytics: false },
    })
    store.acceptAll()
    expect(store.getState().choices).toEqual({ necessary: true, analytics: true, marketing: true })
  })

  it('save() takes per-category choices, ignores unknown ids, and can never switch the necessary category off', () => {
    const store = createConsentStore({ ...base, storage: memoryStorage() })
    store.save({ necessary: false, analytics: true, ghost: true })
    expect(store.getState().choices).toEqual({ necessary: true, analytics: true, marketing: false })
  })

  it('remembers the decision across stores (same storage), and has() answers per category', () => {
    const storage = memoryStorage()
    createConsentStore({ ...base, storage }).acceptAll()
    const again = createConsentStore({ ...base, storage })
    expect(again.getState().status).toBe('decided')
    expect(again.has('analytics')).toBe(true)
    expect(createConsentStore({ ...base, storage: memoryStorage() }).has('analytics')).toBe(false)
  })

  it('a decision made under an older version is asked again (the policy or the categories changed)', () => {
    const storage = memoryStorage()
    createConsentStore({ ...base, storage, version: '1' }).acceptAll()
    const next = createConsentStore({ ...base, storage, version: '2' })
    expect(next.getState().status).toBe('undecided')
    expect(next.has('analytics')).toBe(false)
  })

  it('ignores damaged stored values instead of throwing', () => {
    for (const raw of ['{not json', 'null', '"x"', '{"version":"1","choices":5}'])
      expect(
        createConsentStore({ ...base, storage: memoryStorage({ consent: raw }) }).getState().status,
      ).toBe('undecided')
  })

  it('works when storage throws (private mode): the choice lives for the page', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    const store = createConsentStore({ ...base, storage: broken })
    store.acceptAll()
    expect(store.has('analytics')).toBe(true)
  })

  it('reset() forgets the decision and asks again', () => {
    const storage = memoryStorage()
    const store = createConsentStore({ ...base, storage })
    store.acceptAll()
    store.reset()
    expect(store.getState().status).toBe('undecided')
    expect(storage.data.consent).toBeUndefined()
  })

  it('onChange fires with the new state on each decision (not on creation); subscribe/unsubscribe notify listeners', () => {
    const onChange = vi.fn()
    const listener = vi.fn()
    const store = createConsentStore({ ...base, storage: memoryStorage(), onChange })
    expect(onChange).not.toHaveBeenCalled()
    const unsubscribe = store.subscribe(listener)
    store.acceptAll()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toMatchObject({ status: 'decided' })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    store.rejectAll()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('getState() is referentially stable between changes (useSyncExternalStore needs that)', () => {
    const store = createConsentStore({ ...base, storage: memoryStorage() })
    expect(store.getState()).toBe(store.getState())
  })

  it('the server state is "unknown" so the server renders no banner and nothing flickers on hydration', () => {
    expect(createConsentStore({ ...base, storage: memoryStorage() }).getServerState().status).toBe(
      'unknown',
    )
  })

  it('creating a store without storage touches no browser global (server safe)', () => {
    expect(() => createConsentStore(base)).not.toThrow()
  })

  it('refuses a configuration without the necessary category being first-class: categories must be unique ids', () => {
    expect(() => createConsentStore({ ...base, categories: ['necessary', 'necessary'] })).toThrow(
      /unique/,
    )
    expect(() => createConsentStore({ ...base, categories: [] })).toThrow(/at least one/)
  })
})
