import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSseClient, type SseClientOptions } from './createSseClient'
import type { RealtimeStatus } from './types'
import type { SseEvent } from './sseStream'

const encoder = new TextEncoder()

/** 열려 있는 SSE 응답 — push 로 조각을 보내고 abort 되면 진짜 fetch 처럼 스트림이 AbortError 로 끊긴다 */
function openStream(signal: AbortSignal | null | undefined) {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  signal?.addEventListener('abort', () => {
    try {
      controller.error(new DOMException('aborted', 'AbortError'))
    } catch {
      // already closed
    }
  })
  return {
    body,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  }
}

type FetchCall = { url: string; headers: Headers; signal: AbortSignal }

function setup(options: Partial<SseClientOptions> = {}) {
  const calls: FetchCall[] = []
  const streams: Array<ReturnType<typeof openStream>> = []
  const responses: Array<(stream: ReturnType<typeof openStream>) => Response> = []
  const statuses: RealtimeStatus[] = []
  const events: SseEvent[] = []
  const errors: unknown[] = []
  const infos: Array<{ status: number; durationMs: number; traceId: string }> = []

  const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const stream = openStream(init?.signal)
    streams.push(stream)
    calls.push({
      url: String(url),
      headers: new Headers(init?.headers),
      signal: init?.signal as AbortSignal,
    })
    const make =
      responses.shift() ??
      ((s) =>
        new Response(s.body, { status: 200, headers: { 'content-type': 'text/event-stream' } }))
    return make(stream)
  })

  const client = createSseClient({
    url: 'http://api.test/api/v1/notifications/sse?topic=demo',
    onEvent: (event) => events.push(event),
    onStatus: (status) => statuses.push(status),
    onError: (error) => errors.push(error),
    onResponse: ({ response, durationMs, traceContext }) =>
      infos.push({ status: response.status, durationMs, traceId: traceContext.traceId }),
    fetch: fetchStub as unknown as typeof fetch,
    ...options,
  })
  return { client, calls, streams, responses, statuses, events, errors, infos, fetchStub }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createSseClient', () => {
  it('connects with the SSE, trace and auth headers and reports connecting → open', async () => {
    const { client, calls, statuses, infos } = setup({
      traceId: '0123456789abcdef0123456789abcdef',
      getAuthHeaders: () => ({ Authorization: 'Bearer tok' }),
    })
    void client.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(statuses).toEqual(['connecting', 'open'])
    expect(client.getStatus()).toBe('open')
    expect(calls[0].url).toBe('http://api.test/api/v1/notifications/sse?topic=demo')
    expect(calls[0].headers.get('Accept')).toBe('text/event-stream')
    expect(calls[0].headers.get('Authorization')).toBe('Bearer tok')
    expect(calls[0].headers.get('X-Trace-Id')).toBe('0123456789abcdef0123456789abcdef')
    expect(calls[0].headers.get('traceparent')).toMatch(
      /^00-0123456789abcdef0123456789abcdef-[0-9a-f]{16}-01$/,
    )
    expect(infos).toEqual([
      { status: 200, durationMs: expect.any(Number), traceId: '0123456789abcdef0123456789abcdef' },
    ])
  })

  it('delivers parsed events as the stream produces them', async () => {
    const { client, streams, events } = setup()
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    streams[0].push('id: e1\nevent: connected\ndata: {"topics":["demo"]}\n\n: keepalive\n\n')
    streams[0].push('id: e2\ndata: {"n":2}\n\n')
    await vi.advanceTimersByTimeAsync(0)
    expect(events).toEqual([
      { id: 'e1', name: 'connected', data: { topics: ['demo'] } },
      { id: 'e2', name: 'message', data: { n: 2 } },
    ])
  })

  it('reconnects with exponential backoff when the stream ends (status changes are reported once), resetting once open again', async () => {
    const { client, streams, calls, statuses } = setup()
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    streams[0].end()
    await vi.advanceTimersByTimeAsync(0)
    expect(client.getStatus()).toBe('reconnecting')
    expect(calls).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toHaveLength(2)
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting', 'open'])

    // open 이 되었으니 시도 횟수가 0 으로 돌아가 다시 첫 지연(1s)부터
    streams[1].end()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(calls).toHaveLength(3)
  })

  it('a non-2xx response is an error, then it retries', async () => {
    const { client, responses, calls, statuses } = setup()
    responses.push(() => new Response('nope', { status: 503 }))
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses).toEqual(['connecting', 'error', 'reconnecting'])
    await vi.advanceTimersByTimeAsync(1_000)
    expect(calls).toHaveLength(2)
    expect(client.getStatus()).toBe('open')
  })

  it('a fetch failure reports onError, then retries', async () => {
    const { client, errors, fetchStub } = setup()
    fetchStub.mockRejectedValueOnce(new TypeError('network down'))
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(errors).toHaveLength(1)
    expect(String(errors[0])).toContain('network down')
    expect(client.getStatus()).toBe('reconnecting')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  it('stop() aborts the request, goes idle and never reconnects', async () => {
    const { client, calls, statuses, errors } = setup()
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    client.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls[0].signal.aborted).toBe(true)
    expect(client.getStatus()).toBe('idle')
    expect(statuses.at(-1)).toBe('idle')
    expect(calls).toHaveLength(1)
    expect(errors).toEqual([])
  })

  it('stop() during the reconnect wait cancels the pending retry', async () => {
    const { client, streams, calls } = setup()
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    streams[0].end()
    await vi.advanceTimersByTimeAsync(0)
    expect(client.getStatus()).toBe('reconnecting')
    client.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toHaveLength(1)
    expect(client.getStatus()).toBe('idle')
  })

  it('reconnect: false leaves the status at error without scheduling anything', async () => {
    const { client, responses, calls } = setup({ reconnect: false })
    responses.push(() => new Response('nope', { status: 500 }))
    void client.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(client.getStatus()).toBe('error')
    expect(calls).toHaveLength(1)
  })

  it('gives up with error after the policy maxAttempts', async () => {
    const { client, fetchStub } = setup({
      reconnect: { initialDelayMs: 10, maxDelayMs: 10, multiplier: 1, maxAttempts: 2 },
    })
    fetchStub.mockRejectedValue(new TypeError('down'))
    void client.start()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetchStub).toHaveBeenCalledTimes(3) // 첫 시도 + 재시도 2번
    expect(client.getStatus()).toBe('error')
  })

  it('re-reads url and auth headers on every (re)connection so a new token is used', async () => {
    let token = 'one'
    const { client, streams, calls } = setup({
      url: () => `http://api.test/sse?token=${token}`,
      getAuthHeaders: () => ({ Authorization: `Bearer ${token}` }),
    })
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    token = 'two'
    streams[0].end()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(calls.map((c) => c.headers.get('Authorization'))).toEqual(['Bearer one', 'Bearer two'])
    expect(calls[1].url).toBe('http://api.test/sse?token=two')
  })

  it('starting again replaces the running connection without triggering its reconnect', async () => {
    const { client, calls } = setup()
    void client.start()
    await vi.advanceTimersByTimeAsync(0)
    void client.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toHaveLength(2)
    expect(calls[0].signal.aborted).toBe(true)
    expect(calls[1].signal.aborted).toBe(false)
    expect(client.getStatus()).toBe('open')
  })
})
