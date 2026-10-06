import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import { createReauthStore } from './reauth'
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
  new ApiRequestError({ code, title: code, status, timestamp: 't' }, 'trace', 's', 'p')

describe('resolveReauthLanding (the mail link hands its token back to the pending action)', () => {
  it('same browser tab: an email change that was pending is completed with the token', async () => {
    const store = createReauthStore({ storage: memory() })
    store.remember({ kind: 'email-change', newEmail: 'new@example.com' })
    const changeEmail = vi.fn(async () => undefined)
    const outcome = await resolveReauthLanding({ token: 'rt', store, accountApi: { changeEmail } })
    expect(changeEmail).toHaveBeenCalledWith({
      newEmail: 'new@example.com',
      confirmationToken: 'rt',
    })
    expect(outcome).toEqual({ status: 'completed', action: 'email-change' })
    expect(store.pending()).toBeNull()
    expect(store.hasToken()).toBe(false)
  })

  it('a pending first-password / social link cannot be finished here (no secret was kept): the token is kept for the next submit', async () => {
    const store = createReauthStore({ storage: memory() })
    store.remember({ kind: 'set-password' })
    const outcome = await resolveReauthLanding({
      token: 'rt',
      store,
      accountApi: { changeEmail: vi.fn() },
    })
    expect(outcome).toEqual({ status: 'stashed', resume: 'set-password' })
    expect(store.takeToken()).toBe('rt')
    expect(store.pending()).toBeNull()
  })

  it('another tab or device (nothing pending here): the token is kept and the user is told where to continue', async () => {
    const store = createReauthStore({ storage: memory() })
    const changeEmail = vi.fn()
    const outcome = await resolveReauthLanding({ token: 'rt', store, accountApi: { changeEmail } })
    expect(changeEmail).not.toHaveBeenCalled()
    expect(outcome).toEqual({ status: 'stashed', resume: null })
    expect(store.hasToken()).toBe(true)
  })

  it('a refused token on the pending email change ends the pending action and reports the failure (no loop)', async () => {
    const store = createReauthStore({ storage: memory() })
    store.remember({ kind: 'email-change', newEmail: 'new@example.com' })
    const failure = err('ACCOUNT.REAUTH_FAILED', 400)
    const outcome = await resolveReauthLanding({
      token: 'old',
      store,
      accountApi: {
        changeEmail: async () => {
          throw failure
        },
      },
    })
    expect(outcome).toEqual({ status: 'failed', error: failure })
    expect(store.pending()).toBeNull()
    expect(store.hasToken()).toBe(false)
  })
})

describe('handing the token to the tab that started the action (the mail link opens a NEW tab)', () => {
  it('the landing tab offers the token; a tab with a pending action accepts and finishes it', async () => {
    const { createReauthChannelHub, listenForReauthToken } = await import('./reauthChannel')
    const hub = createReauthChannelHub()
    const waiting = createReauthStore({ storage: memory() }) // tab A
    waiting.remember({ kind: 'email-change', newEmail: 'new@example.com' })
    const changeEmail = vi.fn(async () => undefined)
    const outcomes: unknown[] = []
    const stop = listenForReauthToken({
      channel: hub.open(),
      store: waiting,
      accountApi: { changeEmail },
      onOutcome: (o) => outcomes.push(o),
    })

    const landing = createReauthStore({ storage: memory() }) // tab B, empty sessionStorage
    const outcome = await resolveReauthLanding({
      token: 'rt',
      store: landing,
      accountApi: { changeEmail: vi.fn() },
      channel: hub.open(),
    })
    expect(outcome).toEqual({ status: 'handed-off' })
    expect(landing.hasToken()).toBe(false)
    await vi.waitFor(() =>
      expect(outcomes).toEqual([{ status: 'completed', action: 'email-change' }]),
    )
    expect(changeEmail).toHaveBeenCalledWith({
      newEmail: 'new@example.com',
      confirmationToken: 'rt',
    })
    stop()
  })

  it('nobody answers (the origin tab was closed, or another device): the landing keeps the token itself', async () => {
    const { createReauthChannelHub } = await import('./reauthChannel')
    const hub = createReauthChannelHub()
    const store = createReauthStore({ storage: memory() })
    const outcome = await resolveReauthLanding({
      token: 'rt',
      store,
      accountApi: { changeEmail: vi.fn() },
      channel: hub.open(),
      handoffTimeoutMs: 20,
    })
    expect(outcome).toEqual({ status: 'stashed', resume: null })
    expect(store.hasToken()).toBe(true)
  })

  it('a tab with nothing pending ignores offers', async () => {
    const { createReauthChannelHub, listenForReauthToken } = await import('./reauthChannel')
    const hub = createReauthChannelHub()
    const idle = createReauthStore({ storage: memory() })
    const onOutcome = vi.fn()
    listenForReauthToken({
      channel: hub.open(),
      store: idle,
      accountApi: { changeEmail: vi.fn() },
      onOutcome,
    })
    const accepted = await hub.open().offer('rt', 20)
    expect(accepted).toBe(false)
    expect(onOutcome).not.toHaveBeenCalled()
  })

  it('the real BroadcastChannel adapter carries offer and acknowledgement between two channels', async () => {
    const { createBroadcastReauthChannel } = await import('./reauthChannel')
    const a = createBroadcastReauthChannel('test.reauth.' + Math.random())!
    const name = 'test.reauth.shared'
    const left = createBroadcastReauthChannel(name)!
    const right = createBroadcastReauthChannel(name)!
    const stop = right.onOffer({ claim: () => true, take: () => undefined })
    expect(await left.offer('rt', 500)).toBe(true)
    stop()
    a.close()
    left.close()
    right.close()
  })
})
