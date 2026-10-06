import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { createReauthStore, submitWithReauth, type PendingReauthAction } from './reauth'

const err = (code: string, status: number) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 'trace', 'span', 'tp')

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe('createReauthStore (the pending action survives the mail round trip)', () => {
  const action: PendingReauthAction = { kind: 'email-change', newEmail: 'new@example.com' }

  it('remembers a pending action across store instances sharing the storage (a page reload)', () => {
    const storage = memoryStorage()
    createReauthStore({ storage }).remember(action)
    expect(createReauthStore({ storage }).pending()).toEqual(action)
  })

  it('forgets a pending action after the mail link lifetime (30 min)', () => {
    const storage = memoryStorage()
    let now = 1_000_000
    const store = createReauthStore({ storage, now: () => now })
    store.remember(action)
    now += 31 * 60_000
    expect(store.pending()).toBeNull()
  })

  it('a stashed token is handed out once and only while fresh', () => {
    const storage = memoryStorage()
    let now = 5_000
    const store = createReauthStore({ storage, now: () => now })
    store.stashToken('tok')
    expect(store.hasToken()).toBe(true)
    expect(store.takeToken()).toBe('tok')
    expect(store.takeToken()).toBeNull()
    store.stashToken('tok2')
    now += 26 * 60_000
    expect(store.takeToken()).toBeNull()
  })

  it('never keeps a new password: the stored action carries only what the form needs to resume', () => {
    const storage = memoryStorage()
    createReauthStore({ storage }).remember({ kind: 'set-password' })
    expect([...storage.map.values()].join('')).not.toMatch(/password":/i)
  })

  it('works without storage (memory) and survives a throwing storage and corrupt JSON', () => {
    const memory = createReauthStore({})
    memory.remember(action)
    expect(memory.pending()).toEqual(action)
    const throwing = createReauthStore({
      storage: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('denied')
        },
        removeItem: () => {
          throw new Error('denied')
        },
      },
    })
    throwing.remember(action)
    expect(throwing.pending()).toEqual(action)
    const storage = memoryStorage()
    storage.map.set('skeleton.reauth.pending', '{nope')
    expect(createReauthStore({ storage }).pending()).toBeNull()
  })

  it('clearPending removes the action', () => {
    const store = createReauthStore({ storage: memoryStorage() })
    store.remember(action)
    store.clearPending()
    expect(store.pending()).toBeNull()
  })
})

describe('submitWithReauth (passwordless accounts: try, and on REAUTH_REQUIRED mail a link and remember the action)', () => {
  const action: PendingReauthAction = { kind: 'set-password' }

  it('sends the stashed token with the first attempt and finishes', async () => {
    const store = createReauthStore({ storage: memoryStorage() })
    store.stashToken('rt')
    const run = vi.fn(async () => 'ok')
    const requestMail = vi.fn()
    const result = await submitWithReauth({ store, requestMail, action, run })
    expect(run).toHaveBeenCalledWith({ confirmationToken: 'rt' })
    expect(result).toEqual({ status: 'done', value: 'ok' })
    expect(requestMail).not.toHaveBeenCalled()
    expect(store.hasToken()).toBe(false)
  })

  it('without a token it tries once; 403 ACCOUNT.REAUTH_REQUIRED → remembers the action and mails the link', async () => {
    const store = createReauthStore({ storage: memoryStorage() })
    const run = vi.fn(async () => {
      throw err('ACCOUNT.REAUTH_REQUIRED', 403)
    })
    const requestMail = vi.fn(async () => undefined)
    const result = await submitWithReauth({ store, requestMail, action, run })
    expect(run).toHaveBeenCalledWith({})
    expect(requestMail).toHaveBeenCalledTimes(1)
    expect(store.pending()).toEqual(action)
    expect(result).toEqual({ status: 'mail-sent' })
  })

  it('a stashed token the server refuses (400 ACCOUNT.REAUTH_FAILED: used or expired) starts a fresh mail round trip', async () => {
    const store = createReauthStore({ storage: memoryStorage() })
    store.stashToken('stale')
    const run = vi.fn(async () => {
      throw err('ACCOUNT.REAUTH_FAILED', 400)
    })
    const requestMail = vi.fn(async () => undefined)
    expect(await submitWithReauth({ store, requestMail, action, run })).toEqual({
      status: 'mail-sent',
    })
    expect(store.hasToken()).toBe(false)
  })

  it('any other failure is rethrown and nothing is mailed', async () => {
    const store = createReauthStore({ storage: memoryStorage() })
    const failure = err('ACCOUNT.PASSWORD_POLICY', 400)
    const requestMail = vi.fn()
    await expect(
      submitWithReauth({
        store,
        requestMail,
        action,
        run: async () => {
          throw failure
        },
      }),
    ).rejects.toBe(failure)
    expect(requestMail).not.toHaveBeenCalled()
    expect(store.pending()).toBeNull()
  })

  it('a 429 on the mail request surfaces (the caller shows the wait time)', async () => {
    const store = createReauthStore({ storage: memoryStorage() })
    const limited = err('ACCOUNT.RATE_LIMITED', 429)
    await expect(
      submitWithReauth({
        store,
        action,
        run: async () => {
          throw err('ACCOUNT.REAUTH_REQUIRED', 403)
        },
        requestMail: async () => {
          throw limited
        },
      }),
    ).rejects.toBe(limited)
  })
})
