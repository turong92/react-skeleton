import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSseClient } from './createSseClient'
import type { RealtimeStatus } from './types'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const open = () =>
  new Response(new ReadableStream<Uint8Array>({ start() {} }), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
const status = (code: number) => new Response(null, { status: code })

function setup(
  responses: Array<() => Response>,
  extra: Partial<Parameters<typeof createSseClient>[0]> = {},
) {
  let token = 'old'
  const sent: string[] = []
  const statuses: RealtimeStatus[] = []
  const fetchStub = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(new Headers(init?.headers).get('Authorization') ?? '')
    return (responses.shift() ?? open)()
  })
  const client = createSseClient({
    url: 'http://api.test/sse',
    getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
    onEvent: () => undefined,
    onStatus: (s) => statuses.push(s),
    fetch: fetchStub as unknown as typeof fetch,
    ...extra,
  })
  return { client, sent, statuses, setToken: (t: string) => (token = t) }
}

describe('I7 — live notifications recover after the access token expired', () => {
  it('401 → refresh once → reconnect with the new token (no permanent "off")', async () => {
    const ctx = setup([() => status(401)], {
      recoverUnauthorized: async (failed) => {
        expect(failed).toBe('Bearer old')
        ctx.setToken('new')
        return true
      },
    })
    void ctx.client.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(ctx.sent).toEqual(['Bearer old', 'Bearer new'])
    expect(ctx.client.getStatus()).toBe('open')
  })

  it('does not loop: a second 401 right after a refresh goes off', async () => {
    const recover = vi.fn(async () => true)
    const ctx = setup([() => status(401), () => status(401)], { recoverUnauthorized: recover })
    void ctx.client.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(recover).toHaveBeenCalledTimes(1)
    expect(ctx.client.getStatus()).toBe('off')
  })

  it('401 that cannot be recovered (session ended) goes off', async () => {
    const ctx = setup([() => status(401)], { recoverUnauthorized: async () => false })
    void ctx.client.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(ctx.client.getStatus()).toBe('off')
  })

  it('without the hook a 401 still goes off (old behaviour)', async () => {
    const ctx = setup([() => status(401)])
    void ctx.client.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(ctx.client.getStatus()).toBe('off')
  })

  it('a token change restarts a stream that is off (the refresh happened elsewhere, e.g. a REST call)', async () => {
    let fire: () => void = () => undefined
    const ctx = setup([() => status(401)], {
      subscribeAuthChanges: (onChange) => {
        fire = onChange
        return () => undefined
      },
    })
    void ctx.client.start()
    await vi.advanceTimersByTimeAsync(10)
    expect(ctx.client.getStatus()).toBe('off')
    ctx.setToken('new')
    fire()
    await vi.advanceTimersByTimeAsync(10)
    expect(ctx.sent).toEqual(['Bearer old', 'Bearer new'])
    expect(ctx.client.getStatus()).toBe('open')
  })

  it('a token change leaves a healthy stream alone, and stop() unsubscribes', async () => {
    const unsubscribe = vi.fn()
    let fire: () => void = () => undefined
    const ctx = setup([], {
      subscribeAuthChanges: (onChange) => {
        fire = onChange
        return unsubscribe
      },
    })
    void ctx.client.start()
    await vi.advanceTimersByTimeAsync(10)
    fire()
    await vi.advanceTimersByTimeAsync(10)
    expect(ctx.sent).toHaveLength(1)
    ctx.client.stop()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
