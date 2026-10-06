import { describe, expect, it } from 'vitest'
import { authStorageKeys } from './storageKeys'
import { DEFAULT_REFRESH_STORAGE_KEY } from './refreshStore'
import { DEFAULT_TOKEN_STORAGE_KEY } from './tokenStore'

describe('M10 — storage, lock and channel names are namespaced per app', () => {
  it('every name starts with the namespace, so two apps on one origin never share a token, a lock or a channel', () => {
    const a = Object.values(authStorageKeys('notes'))
    const b = Object.values(authStorageKeys('shop'))
    expect(a.every((key) => key.startsWith('notes.'))).toBe(true)
    expect(a.filter((key) => b.includes(key))).toEqual([])
  })

  it('the default namespace keeps the names the package always used (nobody is signed out by the upgrade)', () => {
    const keys = authStorageKeys()
    expect(keys.accessToken).toBe(DEFAULT_TOKEN_STORAGE_KEY)
    expect(keys.refresh).toBe(DEFAULT_REFRESH_STORAGE_KEY)
    expect(keys.refreshLock).toBe('skeleton.auth.refresh')
    expect(keys.reauthPrefix).toBe('skeleton.reauth.')
    expect(keys.returnTo).toBe('skeleton.returnTo')
    expect(keys.social).toBe('skeleton.social.')
    expect(keys.socialLink).toBe('skeleton.social-link.')
    expect(keys.signUp).toBe('skeleton.signUp')
    expect(keys.reauthChannel).toBe('skeleton.reauth')
  })

  it('rejects a namespace that is not a plain word (it ends up in storage keys and lock names)', () => {
    expect(() => authStorageKeys('')).toThrow()
    expect(() => authStorageKeys('a b')).toThrow()
    expect(() => authStorageKeys('Acme-Shop_2')).not.toThrow()
  })
})
