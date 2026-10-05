import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createStompNotificationClient,
  type StompDiagnostic,
  type StompNotificationClientOptions,
  type WebSocketLike,
} from './createStompNotificationClient'
import { parseStompFrames } from './stompFrames'
import type { NotificationStompMessage } from './notificationStompSession'
import type { RealtimeStatus } from './types'

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = []
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  closed = false
  url: string
  protocols: string[]
  constructor(url: string, protocols: string[]) {
    this.url = url
    this.protocols = protocols
    FakeSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
    this.readyState = 3
  }
  // 서버 쪽 동작
  open() {
    this.readyState = 1
    this.onopen?.()
  }
  receive(raw: string) {
    this.onmessage?.({ data: raw })
  }
  drop() {
    this.readyState = 3
    this.onclose?.()
  }
  frames() {
    return this.sent.flatMap((raw) => parseStompFrames(raw).frames)
  }
}

function setup(options: Partial<StompNotificationClientOptions> = {}) {
  FakeSocket.instances = []
  const statuses: RealtimeStatus[] = []
  const messages: NotificationStompMessage[] = []
  const diagnostics: StompDiagnostic[] = []
  const client = createStompNotificationClient({
    url: 'ws://api.test:18080/ws/notifications',
    getAccessToken: () => 'tok',
    traceId: '0123456789abcdef0123456789abcdef',
    onMessage: (message) => messages.push(message),
    onStatus: (status) => statuses.push(status),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    webSocketFactory: (url, protocols) => new FakeSocket(url, protocols),
    ...options,
  })
  return { client, statuses, messages, diagnostics, socket: (i = 0) => FakeSocket.instances[i] }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createStompNotificationClient', () => {
  it('refuses to connect without a bearer token and says why instead of opening a socket', () => {
    const { client, statuses, diagnostics } = setup({ getAccessToken: () => '' })
    client.start()
    expect(FakeSocket.instances).toHaveLength(0)
    expect(statuses).toEqual(['error'])
    expect(diagnostics).toEqual([
      {
        type: 'blocked',
        reason: 'missing-token',
        traceContext: expect.objectContaining({ traceId: '0123456789abcdef0123456789abcdef' }),
      },
    ])
  })

  it('opens the v12.stomp socket and sends CONNECT with bearer + trace headers on open', () => {
    const { client, statuses, diagnostics, socket } = setup()
    client.start()
    expect(statuses).toEqual(['connecting'])
    expect(socket().url).toBe('ws://api.test:18080/ws/notifications')
    expect(socket().protocols).toEqual(['v12.stomp'])

    socket().open()
    const [connect] = socket().frames()
    expect(connect.command).toBe('CONNECT')
    expect(connect.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'accept-version': '1.2',
      'heart-beat': '10000,10000',
      host: 'api.test:18080',
      'X-Trace-Id': '0123456789abcdef0123456789abcdef',
    })
    expect(connect.headers.traceparent).toMatch(/^00-0123456789abcdef0123456789abcdef-/)
    expect(diagnostics[0]).toMatchObject({ type: 'socket-open', url: socket().url })
  })

  it('on CONNECTED it is open and subscribes to the topic and the user queue with trace headers', () => {
    const { client, statuses, socket } = setup({ topic: 'orders' })
    client.start()
    socket().open()
    socket().receive('CONNECTED\nversion:1.2\n\n\u0000')
    expect(statuses).toEqual(['connecting', 'open'])
    const subscribes = socket()
      .frames()
      .filter((f) => f.command === 'SUBSCRIBE')
    expect(subscribes.map((f) => f.headers.destination)).toEqual([
      '/topic/notifications/orders',
      '/user/queue/notifications',
    ])
    subscribes.forEach((f) =>
      expect(f.headers['X-Trace-Id']).toBe('0123456789abcdef0123456789abcdef'),
    )
  })

  it('delivers MESSAGE frames, also when a frame is split across socket messages', () => {
    const { client, messages, socket } = setup()
    client.start()
    socket().open()
    socket().receive('CONNECTED\nversion:1.2\n\n\u0000')
    socket().receive('MESSAGE\ndestination:/topic/notifications/demo\n\n{"eventId":')
    socket().receive('"e1"}\u0000')
    expect(messages).toEqual([
      { destination: '/topic/notifications/demo', value: { eventId: 'e1' } },
    ])
  })

  it('ignores non-text socket data', () => {
    const { client, messages, socket } = setup()
    client.start()
    socket().open()
    socket().onmessage?.({ data: new ArrayBuffer(4) })
    expect(messages).toEqual([])
  })

  it('an ERROR frame makes the status error and reports the frame', () => {
    const { client, statuses, diagnostics, socket } = setup()
    client.start()
    socket().open()
    socket().receive('ERROR\nmessage:bad token\n\ndenied\u0000')
    expect(statuses.at(-1)).toBe('error')
    expect(diagnostics.at(-1)).toMatchObject({
      type: 'stomp-error',
      frame: { command: 'ERROR', headers: { message: 'bad token' }, body: 'denied' },
    })
  })

  it('a socket error is reported and the status is error', () => {
    const { client, statuses, diagnostics, socket } = setup()
    client.start()
    socket().onerror?.()
    expect(statuses.at(-1)).toBe('error')
    expect(diagnostics.at(-1)).toEqual({ type: 'socket-error' })
  })

  it('an unexpected close reconnects with backoff on a new socket; CONNECTED resets the attempt count', () => {
    const { client, statuses, socket } = setup()
    client.start()
    socket().open()
    socket().receive('CONNECTED\nversion:1.2\n\n\u0000')
    socket().drop()
    expect(statuses.at(-1)).toBe('reconnecting')
    expect(FakeSocket.instances).toHaveLength(1)

    vi.advanceTimersByTime(1_000)
    expect(FakeSocket.instances).toHaveLength(2)
    socket(1).open()
    socket(1).receive('CONNECTED\nversion:1.2\n\n\u0000')
    expect(statuses.at(-1)).toBe('open')

    socket(1).drop()
    vi.advanceTimersByTime(1_000) // 다시 첫 지연부터
    expect(FakeSocket.instances).toHaveLength(3)
  })

  it('stop() sends DISCONNECT on an open socket, closes it, goes idle and does not reconnect', () => {
    const { client, statuses, socket } = setup()
    client.start()
    socket().open()
    socket().receive('CONNECTED\nversion:1.2\n\n\u0000')
    client.stop()
    const last = socket().frames().at(-1)!
    expect(last.command).toBe('DISCONNECT')
    expect(last.headers['X-Trace-Id']).toBe('0123456789abcdef0123456789abcdef')
    expect(socket().closed).toBe(true)
    expect(statuses.at(-1)).toBe('idle')
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('stop() while reconnecting cancels the retry', () => {
    const { client, socket } = setup()
    client.start()
    socket().open()
    socket().drop()
    client.stop()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(client.getStatus()).toBe('idle')
  })

  it('a factory that throws is reported and retried', () => {
    let attempts = 0
    const { client, diagnostics } = setup({
      webSocketFactory: (url, protocols) => {
        attempts += 1
        if (attempts === 1) throw new Error('bad url')
        return new FakeSocket(url, protocols)
      },
    })
    client.start()
    expect(diagnostics.at(-1)).toMatchObject({ type: 'exception' })
    expect(client.getStatus()).toBe('reconnecting')
    vi.advanceTimersByTime(1_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('reconnect: false does not retry after a drop', () => {
    const { client, socket } = setup({ reconnect: false })
    client.start()
    socket().open()
    socket().drop()
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(client.getStatus()).toBe('error')
  })

  it('starting again closes the previous socket and its close event does not schedule a retry', () => {
    const { client, socket } = setup()
    client.start()
    socket().open()
    client.start()
    expect(socket(0).closed).toBe(true)
    socket(0).onclose?.() // 이미 떼어 낸 핸들러 — 아무 일도 없어야 한다
    vi.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(2)
  })
})
