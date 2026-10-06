import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { createReauthStore, submitWithReauth } from './reauth'
import { createReauthChannelHub, listenForReauthToken } from './reauthChannel'
import { resolveReauthLanding } from './reauthLanding'

const memory = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}
const err = (code: string, status: number) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 't', 's', 'p')

describe('I3 — the pending action and the stored token belong to one account', () => {
  it('account B never sees (or runs) the email change account A started in the same tab', async () => {
    const storage = memory()
    const base = createReauthStore({ storage })
    base.forAccount('A').remember({ kind: 'email-change', newEmail: 'attacker@x.test' })

    const asB = base.forAccount('B')
    expect(asB.pending()).toBeNull()

    const changeEmail = vi.fn()
    const outcome = await resolveReauthLanding({
      token: 'bs-link-token',
      store: asB,
      accountApi: { changeEmail },
    })
    expect(changeEmail).not.toHaveBeenCalled()
    expect(outcome).toEqual({ status: 'stashed', resume: null })
  })

  it('a token stashed for A is not handed to B', () => {
    const base = createReauthStore({ storage: memory() })
    base.forAccount('A').stashToken('tok')
    expect(base.forAccount('A').hasToken()).toBe(true)
    expect(base.forAccount('B').hasToken()).toBe(false)
    expect(base.forAccount('B').peekToken()).toBeNull()
    expect(base.forAccount('A').hasToken()).toBe(false) // B's look discarded it — it is not A's to keep for later either
  })

  it('clear() removes both the action and the token (sign-out)', () => {
    const base = createReauthStore({ storage: memory() })
    const asA = base.forAccount('A')
    asA.remember({ kind: 'set-password' })
    asA.stashToken('tok')
    base.clear()
    expect(asA.pending()).toBeNull()
    expect(asA.hasToken()).toBe(false)
  })
})

describe('I3 — a transient error must not lose the token or the pending action', () => {
  it('submitWithReauth: a network error on the call keeps the stashed token for the retry', async () => {
    const store = createReauthStore({ storage: memory() })
    store.stashToken('rt')
    await expect(
      submitWithReauth({
        store,
        requestMail: vi.fn(),
        action: { kind: 'set-password' },
        run: async () => {
          throw err('CLIENT.NETWORK_ERROR', 0)
        },
      }),
    ).rejects.toBeDefined()
    expect(store.peekToken()).toBe('rt')
  })

  it('submitWithReauth: success consumes the token (it is single-use)', async () => {
    const store = createReauthStore({ storage: memory() })
    store.stashToken('rt')
    await submitWithReauth({
      store,
      requestMail: vi.fn(),
      action: { kind: 'set-password' },
      run: async () => 'ok',
    })
    expect(store.hasToken()).toBe(false)
  })

  it('landing: a 503 on the pending email change keeps the action and the token (the user can retry)', async () => {
    const store = createReauthStore({ storage: memory() })
    store.remember({ kind: 'email-change', newEmail: 'new@example.com' })
    const outcome = await resolveReauthLanding({
      token: 'rt',
      store,
      accountApi: {
        changeEmail: async () => {
          throw err('COMMON.UNAVAILABLE', 503)
        },
      },
    })
    expect(outcome.status).toBe('failed')
    expect(store.pending()).toEqual({ kind: 'email-change', newEmail: 'new@example.com' })
    expect(store.peekToken()).toBe('rt')
  })
})

describe('I3 — only one tab acknowledges an offered token', () => {
  it('two tabs with a pending action: exactly one takes it and spends the token', async () => {
    const hub = createReauthChannelHub()
    const changeEmail = vi.fn(async () => undefined)
    const mk = () => {
      const store = createReauthStore({ storage: memory() })
      store.remember({ kind: 'email-change', newEmail: 'new@example.com' })
      const onOutcome = vi.fn()
      listenForReauthToken({
        channel: hub.open(),
        store,
        accountApi: { changeEmail },
        onOutcome,
      })
      return { store, onOutcome }
    }
    const first = mk()
    const second = mk()
    const landing = createReauthStore({ storage: memory() })
    const outcome = await resolveReauthLanding({
      token: 'rt',
      store: landing,
      accountApi: { changeEmail: vi.fn() },
      channel: hub.open(),
    })
    expect(outcome).toEqual({ status: 'handed-off' })
    await vi.waitFor(() => expect(changeEmail).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(changeEmail).toHaveBeenCalledTimes(1)
    expect(first.onOutcome.mock.calls.length + second.onOutcome.mock.calls.length).toBe(1)
  })
})

describe('I3 — the real BroadcastChannel adapter grants an offer to one claimant only', () => {
  it('three listeners that could all take it: one take()', async () => {
    const { createBroadcastReauthChannel } = await import('./reauthChannel')
    const name = 'test.reauth.claims.' + Math.random()
    const offerer = createBroadcastReauthChannel(name)!
    const listeners = [1, 2, 3].map(() => createBroadcastReauthChannel(name)!)
    const take = vi.fn()
    const stops = listeners.map((channel) => channel.onOffer({ claim: () => true, take }))
    expect(await offerer.offer('rt', 500)).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(take).toHaveBeenCalledTimes(1)
    expect(take).toHaveBeenCalledWith('rt')
    expect(await offerer.offer('nobody', 30)).toBe(true) // still claimable: each offer is its own
    stops.forEach((stop) => stop())
    ;[offerer, ...listeners].forEach((c) => c.close())
  })

  it('no claimant: the offer times out false', async () => {
    const { createBroadcastReauthChannel } = await import('./reauthChannel')
    const name = 'test.reauth.noclaim.' + Math.random()
    const offerer = createBroadcastReauthChannel(name)!
    const other = createBroadcastReauthChannel(name)!
    const stop = other.onOffer({ claim: () => false, take: vi.fn() })
    expect(await offerer.offer('rt', 40)).toBe(false)
    stop()
    offerer.close()
    other.close()
  })
})
