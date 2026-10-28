import { describe, expect, it, vi } from 'vitest'
import { refetchOnLanguageChange } from './refetchOnLanguage'

function fakeI18n(initial: string) {
  let locale = initial
  const listeners = new Set<() => void>()
  return {
    getLocale: () => locale,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    set(next: string) {
      locale = next
      listeners.forEach((listener) => listener())
    },
    ping: () => listeners.forEach((listener) => listener()),
  }
}

describe('refetchOnLanguageChange', () => {
  it('rereads the payment queries when the language really changes, not on every notice', () => {
    const i18n = fakeI18n('ko')
    const invalidateQueries = vi.fn(async () => undefined)
    refetchOnLanguageChange(i18n, { invalidateQueries })
    i18n.ping()
    expect(invalidateQueries).not.toHaveBeenCalled()
    i18n.set('en')
    expect(invalidateQueries).toHaveBeenCalledOnce()
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['payment'] })
    i18n.set('en')
    expect(invalidateQueries).toHaveBeenCalledOnce()
  })

  it('stops after the returned unsubscribe', () => {
    const i18n = fakeI18n('ko')
    const invalidateQueries = vi.fn(async () => undefined)
    refetchOnLanguageChange(i18n, { invalidateQueries })()
    i18n.set('en')
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
