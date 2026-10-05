import { createTraceContext, type TraceContext } from '@skeleton/api-client'
import {
  canConnectNotificationWebSocket,
  createNotificationConnectFrame,
  createNotificationDisconnectFrame,
  createNotificationSubscribeFrames,
  parseNotificationMessage,
  type NotificationStompMessage,
  type NotificationStompTraceHeaders,
} from './notificationStompSession'
import {
  DEFAULT_NOTIFICATION_RECONNECT_POLICY,
  nextNotificationReconnectDelay,
  shouldRetryNotificationReconnect,
  type NotificationReconnectPolicy,
} from './notificationReconnectPolicy'
import { encodeStompFrame, parseStompFrames, type ParsedStompFrame } from './stompFrames'
import type { RealtimeStatus } from './types'

/** 브라우저 `WebSocket` 중 이 클라이언트가 쓰는 부분 — 테스트에서 가짜로 갈아 끼운다 */
export type WebSocketLike = {
  readyState: number
  send(data: string): void
  close(): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: (() => void) | null
  onclose: (() => void) | null
}

export type StompDiagnostic =
  | { type: 'blocked'; reason: 'missing-token'; traceContext: TraceContext }
  | {
      type: 'socket-open'
      url: string
      /** 보낸 CONNECT 헤더(토큰 포함 — 화면에 낼 땐 가린다) */
      headers: Record<string, string | number | undefined>
      traceContext: TraceContext
      durationMs: number
    }
  | { type: 'stomp-error'; frame: ParsedStompFrame; traceContext: TraceContext; durationMs: number }
  | { type: 'socket-error' }
  | { type: 'exception'; error: unknown }

export type StompNotificationClientOptions = {
  /** 전체 WebSocket URL — `websocketUrlFromApiBase(baseUrl, '/ws/notifications')` */
  url: string | (() => string)
  /** 구독할 topic(기본 `demo`). 사용자 큐 `/user/queue/notifications` 는 항상 구독 */
  topic?: string
  /** bearer 토큰. WebSocket 은 토큰이 있어야만 붙는다(dev-login 헤더는 REST/SSE 전용) */
  getAccessToken: () => string | null | undefined
  traceId?: string | (() => string | undefined)
  onMessage: (message: NotificationStompMessage) => void
  onStatus?: (status: RealtimeStatus) => void
  /** 교환 기록 · 토스트용 이벤트 */
  onDiagnostic?: (diagnostic: StompDiagnostic) => void
  reconnect?: NotificationReconnectPolicy | false
  /** 기본 `new WebSocket(url, protocols)` */
  webSocketFactory?: (url: string, protocols: string[]) => WebSocketLike
  /** 기본 `['v12.stomp']` */
  protocols?: string[]
}

export type StompNotificationClient = {
  start(): void
  stop(): void
  getStatus(): RealtimeStatus
}

const WEB_SOCKET_OPEN = 1

/** STOMP over WebSocket 알림 클라이언트(백엔드 notification-websocket). CONNECT · SUBSCRIBE · DISCONNECT 프레임과 재연결을 맡는다 */
export function createStompNotificationClient(
  options: StompNotificationClientOptions,
): StompNotificationClient {
  let status: RealtimeStatus = 'idle'
  let socket: WebSocketLike | null = null
  let buffer = ''
  let closing = false
  let manualStop = false
  let reconnectAttempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let traceHeaders: NotificationStompTraceHeaders | null = null

  const policy =
    options.reconnect === false
      ? false
      : (options.reconnect ?? DEFAULT_NOTIFICATION_RECONNECT_POLICY)

  function setStatus(next: RealtimeStatus) {
    if (next === status) return
    status = next
    options.onStatus?.(next)
  }

  function clearTimer() {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  function closeConnection(sendDisconnect: boolean) {
    const current = socket
    closing = true
    if (sendDisconnect && current?.readyState === WEB_SOCKET_OPEN) {
      current.send(encodeStompFrame(createNotificationDisconnectFrame(traceHeaders ?? undefined)))
    }
    if (current) {
      current.onopen = null
      current.onmessage = null
      current.onerror = null
      current.onclose = null
      current.close()
    }
    socket = null
    buffer = ''
    traceHeaders = null
  }

  function scheduleReconnect(attempt: number) {
    if (manualStop) return
    if (policy === false || !shouldRetryNotificationReconnect(attempt, policy)) {
      setStatus('error')
      return
    }
    clearTimer()
    reconnectAttempt = attempt
    setStatus('reconnecting')
    timer = setTimeout(
      () => {
        timer = null
        connect(attempt)
      },
      nextNotificationReconnectDelay(attempt, policy),
    )
  }

  function connect(attempt: number) {
    clearTimer()
    manualStop = false
    closeConnection(true)
    const traceId = typeof options.traceId === 'function' ? options.traceId() : options.traceId
    const traceContext = createTraceContext(traceId)
    const accessToken = options.getAccessToken() ?? ''
    if (!canConnectNotificationWebSocket(accessToken)) {
      setStatus('error')
      options.onDiagnostic?.({ type: 'blocked', reason: 'missing-token', traceContext })
      return
    }

    reconnectAttempt = attempt
    const url = typeof options.url === 'function' ? options.url() : options.url
    const connectFrame = createNotificationConnectFrame(url, { accessToken })
    const trace: NotificationStompTraceHeaders = {
      traceparent: traceContext.traceparent,
      'X-Trace-Id': traceContext.traceId,
    }
    const started = performance.now()
    closing = false
    buffer = ''
    traceHeaders = trace
    setStatus(attempt > 0 ? 'reconnecting' : 'connecting')

    try {
      const created = (options.webSocketFactory ?? defaultFactory)(
        url,
        options.protocols ?? ['v12.stomp'],
      )
      socket = created

      created.onopen = () => {
        const headers = { ...connectFrame.headers, ...trace }
        created.send(encodeStompFrame({ ...connectFrame, headers }))
        options.onDiagnostic?.({
          type: 'socket-open',
          url,
          headers,
          traceContext,
          durationMs: Math.round(performance.now() - started),
        })
      }

      created.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        const parsed = parseStompFrames(buffer + event.data)
        buffer = parsed.remaining
        parsed.frames.forEach((frame) => {
          if (frame.command === 'CONNECTED') {
            reconnectAttempt = 0
            setStatus('open')
            createNotificationSubscribeFrames(options.topic ?? 'demo', trace).forEach(
              (subscribe) => {
                created.send(encodeStompFrame(subscribe))
              },
            )
            return
          }
          if (frame.command === 'ERROR') {
            setStatus('error')
            options.onDiagnostic?.({
              type: 'stomp-error',
              frame,
              traceContext,
              durationMs: Math.round(performance.now() - started),
            })
            return
          }
          const notification = parseNotificationMessage(frame)
          if (notification) options.onMessage(notification)
        })
      }

      created.onerror = () => {
        setStatus('error')
        options.onDiagnostic?.({ type: 'socket-error' })
      }

      created.onclose = () => {
        if (socket === created) {
          socket = null
          traceHeaders = null
        }
        buffer = ''
        if (!closing && !manualStop) scheduleReconnect(reconnectAttempt + 1)
      }
    } catch (error) {
      setStatus('error')
      options.onDiagnostic?.({ type: 'exception', error })
      scheduleReconnect(reconnectAttempt + 1)
    }
  }

  return {
    start: () => connect(0),
    stop() {
      manualStop = true
      clearTimer()
      closeConnection(true)
      reconnectAttempt = 0
      setStatus('idle')
    },
    getStatus: () => status,
  }
}

function defaultFactory(url: string, protocols: string[]): WebSocketLike {
  // 브라우저 WebSocket 은 이벤트 인자 타입이 더 좁다 — 이 클라이언트가 읽는 필드는 같다
  return new WebSocket(url, protocols) as unknown as WebSocketLike
}
