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

/** 탭 가시성 — 테스트 · 비브라우저 환경에서 갈아 끼운다 */
export type VisibilitySource = {
  hidden: () => boolean
  subscribe: (onChange: () => void) => () => void
}

/** `document` 가 없는 곳(SSR · Node)에서는 늘 보이는 것으로 본다. 호출할 때 읽으므로 import 시점에 전역을 만지지 않는다 */
export function documentVisibility(): VisibilitySource {
  return {
    hidden: () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
    subscribe: (onChange) => {
      if (typeof document === 'undefined') return () => undefined
      document.addEventListener('visibilitychange', onChange)
      return () => document.removeEventListener('visibilitychange', onChange)
    },
  }
}

export const DEFAULT_BUSY_DELAY_MS = 30_000
export const DEFAULT_MAX_RETRY_AFTER_MS = 5 * 60_000

/** `Retry-After`(초 또는 HTTP 날짜) → ms. 읽을 수 없으면 null */
function parseRetryAfter(value: string | null, now: number): number | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const at = Date.parse(trimmed)
  return Number.isNaN(at) ? null : Math.max(0, at - now)
}

export type SseClientOptions = {
  /** 요청 URL(백엔드 `GET /notifications/sse?topic=…`). 재연결마다 다시 읽는다 */
  url: string | (() => string)
  /** 재연결마다 다시 불러, 바뀐 토큰을 쓴다 */
  getAuthHeaders?: () => Record<string, string> | undefined
  /**
   * 401 이면 토큰 갱신을 한 번 시도한다(`@skeleton/auth` 의 `createSessionRefresher().refresh`). 인자는 방금 보낸 `Authorization` 값.
   * true 면 곧바로 다시 잇고, false 면 세션이 끝난 것이라 `off`. 갱신 직후 또 401 이면 `off`(되풀이 없음). 없으면 401 은 바로 `off`
   */
  recoverUnauthorized?: (failedAuthorization: string | undefined) => Promise<boolean>
  /**
   * 토큰이 바뀔 때(다른 요청이 갱신했다 · 다른 탭이 로그인했다) 부를 처리기를 등록한다 — `start()` 부터 `stop()` 까지.
   * 스트림이 죽어 있으면(`off` · `error`) 다시 잇는다. 정상이면 건드리지 않는다
   */
  subscribeAuthChanges?: (onChange: () => void) => () => void
  /** 같은 흐름을 묶는 traceId(없으면 새로 만든다) */
  traceId?: string | (() => string | undefined)
  onEvent: (event: SseEvent) => void
  /** 바뀔 때만 불린다 */
  onStatus?: (status: RealtimeStatus) => void
  /** 응답 헤더를 받은 직후(로그 · 교환 기록용) */
  onResponse?: (info: SseResponseInfo) => void
  onError?: (error: unknown) => void
  /** 연결이 (다시) 열릴 때마다 — `reconnect` 가 true 면 그 사이 놓친 사건이 있을 수 있으니 목록을 다시 읽는다 */
  onOpen?: (info: { reconnect: boolean }) => void
  /** 이 시간 동안 바이트(심장박동 주석 포함)가 없으면 끊고 다시 붙는다. 기본 꺼짐 — 서버가 심장박동을 보낼 때만 켠다 */
  idleTimeoutMs?: number
  /** 429 · 503 일 때 기다릴 시간(기본 30초). `Retry-After` 가 더 길면 그것을 따른다 */
  busyDelayMs?: number
  /** `Retry-After` 상한(기본 5분) */
  maxRetryAfterMs?: number
  /** 탭 가시성(기본 `document.visibilityState`). 숨겨지면 끊고(`paused`) 보이면 곧바로 잇는다 */
  visibility?: VisibilitySource
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

/**
 * fetch 스트리밍 SSE 클라이언트 — 헤더(Authorization · traceparent)를 보낼 수 있어 `EventSource` 를 쓰지 않는다.
 *
 * 하드닝: 탭이 숨겨지면 끊고(`paused`) 보이면 곧바로 잇는다 · `idleTimeoutMs` 동안 바이트가 없으면 끊고 다시 잇는다(켰을 때) ·
 * 401 · 403 · 404 는 영구 중지(`off`, 다시 `start()` 하기 전까지) · 429 · 503 은 느리게(`busyDelayMs`, `Retry-After` 존중) ·
 * 열릴 때마다 `onOpen({ reconnect })`.
 */
export function createSseClient(options: SseClientOptions): SseClient {
  let status: RealtimeStatus = 'idle'
  let controller: AbortController | null = null
  let running = false
  let everOpened = false
  let reconnectAttempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let unsubscribeVisibility: (() => void) | null = null
  let unsubscribeAuth: (() => void) | null = null
  let recoveredUnauthorized = false

  const policy =
    options.reconnect === false
      ? false
      : (options.reconnect ?? DEFAULT_NOTIFICATION_RECONNECT_POLICY)
  const busyDelayMs = options.busyDelayMs ?? DEFAULT_BUSY_DELAY_MS
  const maxRetryAfterMs = options.maxRetryAfterMs ?? DEFAULT_MAX_RETRY_AFTER_MS
  const visibilitySource = options.visibility ?? documentVisibility()

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

  function clearIdle() {
    if (idleTimer === null) return
    clearTimeout(idleTimer)
    idleTimer = null
  }

  function haltSession() {
    running = false
    clearTimer()
    clearIdle()
    unsubscribeVisibility?.()
    unsubscribeVisibility = null
  }

  function scheduleReconnect(attempt: number, delayMs?: number) {
    if (!running) return
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
      delayMs ?? nextNotificationReconnectDelay(attempt, policy),
    )
  }

  function busyDelay(response: Response): number {
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'), Date.now())
    return retryAfter === null
      ? busyDelayMs
      : Math.max(busyDelayMs, Math.min(retryAfter, maxRetryAfterMs))
  }

  async function connect(attempt: number): Promise<void> {
    clearTimer()
    clearIdle()
    controller?.abort()
    controller = null
    running = true
    reconnectAttempt = attempt
    if (visibilitySource.hidden()) {
      setStatus('paused')
      return
    }
    const abortController = new AbortController()
    controller = abortController
    let idleAborted = false
    const armIdle = () => {
      if (options.idleTimeoutMs === undefined) return
      clearIdle()
      idleTimer = setTimeout(() => {
        idleAborted = true
        abortController.abort()
      }, options.idleTimeoutMs)
    }
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
    let retry: { delayMs?: number } | null = null

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
      if (controller !== abortController) return
      if (response.status === 401 && options.recoverUnauthorized && !recoveredUnauthorized) {
        recoveredUnauthorized = true // 한 번만 — 갱신했는데도 401 이면 되풀이하지 않는다
        const recovered = await options
          .recoverUnauthorized(headers.get('Authorization') ?? undefined)
          .catch(() => false)
        if (controller !== abortController) return
        if (recovered) {
          retry = { delayMs: 0 }
          return
        }
      }
      if ([401, 403, 404].includes(response.status)) {
        haltSession()
        setStatus('off')
        return
      }
      if (!response.ok || !response.body) {
        setStatus('error')
        retry = { delayMs: [429, 503].includes(response.status) ? busyDelay(response) : undefined }
        return
      }
      reconnectAttempt = 0
      recoveredUnauthorized = false
      setStatus('open')
      armIdle()
      options.onOpen?.({ reconnect: everOpened })
      everOpened = true
      await readSseStream(response.body, abortController.signal, options.onEvent, armIdle)
      if (!abortController.signal.aborted || idleAborted) retry = {}
    } catch (error) {
      if (idleAborted) retry = {}
      else if (!abortController.signal.aborted) {
        setStatus('error')
        options.onError?.(error)
        retry = {}
      }
    } finally {
      const isCurrent = controller === abortController
      if (isCurrent) {
        controller = null
        clearIdle()
      }
      if (isCurrent && retry) scheduleReconnect(reconnectAttempt + 1, retry.delayMs)
    }
  }

  function onVisibilityChange() {
    if (!running) return
    if (visibilitySource.hidden()) {
      clearTimer()
      clearIdle()
      controller?.abort()
      controller = null
      setStatus('paused')
    } else if (status === 'paused') {
      void connect(0)
    }
  }

  return {
    start() {
      everOpened = false
      recoveredUnauthorized = false
      unsubscribeAuth?.()
      unsubscribeAuth =
        options.subscribeAuthChanges?.(() => {
          if (status === 'off' || status === 'error') void connect(0)
        }) ?? null
      unsubscribeVisibility?.()
      unsubscribeVisibility = visibilitySource.subscribe(onVisibilityChange)
      return connect(0)
    },
    stop() {
      unsubscribeAuth?.()
      unsubscribeAuth = null
      haltSession()
      controller?.abort()
      controller = null
      reconnectAttempt = 0
      setStatus('idle')
    },
    getStatus: () => status,
  }
}
