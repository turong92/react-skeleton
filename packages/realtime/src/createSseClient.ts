import { createTraceContext, type TraceContext } from '@skeleton/api-client'
import {
  DEFAULT_NOTIFICATION_RECONNECT_POLICY,
  nextNotificationReconnectDelay,
  shouldRetryNotificationReconnect,
  type NotificationReconnectPolicy,
} from './notificationReconnectPolicy'
import { readSseStream, type SseEvent } from './sseStream'
import type { RealtimeStatus } from './types'

export type SseResponseInfo = {
  response: Response
  request: { url: string; headers: Headers }
  traceContext: TraceContext
  durationMs: number
}

export type SseClientOptions = {
  /** 요청 URL(백엔드 `GET /notifications/sse?topic=…`). 재연결마다 다시 읽는다 */
  url: string | (() => string)
  /** 재연결마다 다시 불러, 바뀐 토큰을 쓴다 */
  getAuthHeaders?: () => Record<string, string> | undefined
  /** 같은 흐름을 묶는 traceId(없으면 새로 만든다) */
  traceId?: string | (() => string | undefined)
  onEvent: (event: SseEvent) => void
  /** 바뀔 때만 불린다 */
  onStatus?: (status: RealtimeStatus) => void
  /** 응답 헤더를 받은 직후(로그 · 교환 기록용) */
  onResponse?: (info: SseResponseInfo) => void
  onError?: (error: unknown) => void
  /** 재연결 정책. `false` 면 끊겨도 다시 붙지 않는다 */
  reconnect?: NotificationReconnectPolicy | false
  /** 테스트용 */
  fetch?: typeof fetch
}

export type SseClient = {
  /** 연결을 시작한다(이미 있으면 갈아 끼운다). 이번 연결이 끝나면 resolve — 재연결은 따로 예약된다 */
  start(): Promise<void>
  stop(): void
  getStatus(): RealtimeStatus
}

/** fetch 스트리밍 SSE 클라이언트 — 헤더(Authorization · traceparent)를 보낼 수 있어 `EventSource` 를 쓰지 않는다 */
export function createSseClient(options: SseClientOptions): SseClient {
  let status: RealtimeStatus = 'idle'
  let controller: AbortController | null = null
  let manualStop = false
  let reconnectAttempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

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
        void connect(attempt)
      },
      nextNotificationReconnectDelay(attempt, policy),
    )
  }

  async function connect(attempt: number): Promise<void> {
    clearTimer()
    manualStop = false
    reconnectAttempt = attempt
    controller?.abort()
    const abortController = new AbortController()
    controller = abortController
    const traceId = typeof options.traceId === 'function' ? options.traceId() : options.traceId
    const traceContext = createTraceContext(traceId)
    const headers = new Headers({
      Accept: 'text/event-stream',
      traceparent: traceContext.traceparent,
      'X-Trace-Id': traceContext.traceId,
    })
    Object.entries(options.getAuthHeaders?.() ?? {}).forEach(([name, value]) =>
      headers.set(name, value),
    )
    const url = typeof options.url === 'function' ? options.url() : options.url
    setStatus(attempt > 0 ? 'reconnecting' : 'connecting')
    const started = performance.now()
    let shouldReconnect = false

    try {
      const response = await (options.fetch ?? fetch)(url, {
        headers,
        signal: abortController.signal,
      })
      options.onResponse?.({
        response,
        request: { url, headers },
        traceContext,
        durationMs: Math.round(performance.now() - started),
      })
      if (!response.ok || !response.body) {
        setStatus('error')
        shouldReconnect = true
        return
      }
      reconnectAttempt = 0
      setStatus('open')
      await readSseStream(response.body, abortController.signal, options.onEvent)
      if (!abortController.signal.aborted) shouldReconnect = true
    } catch (error) {
      if (!abortController.signal.aborted) {
        setStatus('error')
        options.onError?.(error)
        shouldReconnect = true
      }
    } finally {
      const isCurrent = controller === abortController
      if (isCurrent) controller = null
      if (isCurrent && shouldReconnect) scheduleReconnect(reconnectAttempt + 1)
    }
  }

  return {
    start: () => connect(0),
    stop() {
      manualStop = true
      clearTimer()
      controller?.abort()
      controller = null
      reconnectAttempt = 0
      setStatus('idle')
    },
    getStatus: () => status,
  }
}
