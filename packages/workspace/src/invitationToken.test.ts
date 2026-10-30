import { describe, expect, it } from 'vitest'
import { createInvitationTokenStore, takeInvitationToken, type UrlHost } from './invitationToken'
import { memoryStorage } from './test/memoryStorage'

function host(search: string, hash = '') {
  const replaced: string[] = []
  const value: UrlHost = {
    location: { pathname: '/invite', search, hash },
    history: { state: { key: 1 }, replaceState: (_s, _t, url) => void replaced.push(url) },
  }
  return { value, replaced }
}

describe('takeInvitationToken — read the one-time token, keep it in the tab, wipe it from the address', () => {
  it('takes ?token= into the tab store and removes only that param from the address', () => {
    const store = createInvitationTokenStore(memoryStorage())
    const { value, replaced } = host('?token=abc&utm=1')
    expect(takeInvitationToken(store, value)).toBe('abc')
    expect(store.read()).toBe('abc')
    expect(replaced).toEqual(['/invite?utm=1'])
  })

  it('also wipes a token carried in the hash', () => {
    const store = createInvitationTokenStore(memoryStorage())
    const { value, replaced } = host('', '#token=abc')
    expect(takeInvitationToken(store, value)).toBe('abc')
    expect(replaced).toEqual(['/invite'])
  })

  it('without a token in the address (we came back from sign-in) it reads the tab store and leaves the address alone', () => {
    const store = createInvitationTokenStore(memoryStorage())
    store.write('kept')
    const { value, replaced } = host('')
    expect(takeInvitationToken(store, value)).toBe('kept')
    expect(replaced).toEqual([])
  })

  it('a new token in the address replaces an older stored one', () => {
    const store = createInvitationTokenStore(memoryStorage())
    store.write('old')
    expect(takeInvitationToken(store, host('?token=new').value)).toBe('new')
    expect(store.read()).toBe('new')
  })

  it('nothing anywhere is null; clear forgets the token', () => {
    const store = createInvitationTokenStore(memoryStorage())
    expect(takeInvitationToken(store, host('').value)).toBeNull()
    store.write('x')
    store.clear()
    expect(store.read()).toBeNull()
  })

  it('a tab store that throws (blocked storage) never breaks the read — the token still comes from the address', () => {
    const broken = {
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
    const store = createInvitationTokenStore(broken)
    expect(takeInvitationToken(store, host('?token=abc').value)).toBe('abc')
    expect(store.read()).toBeNull()
    expect(() => store.clear()).not.toThrow()
  })

  it('on the server (no host, no storage) there is nothing to read', () => {
    const store = createInvitationTokenStore(undefined)
    expect(takeInvitationToken(store, undefined)).toBeNull()
  })
})
