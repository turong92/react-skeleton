/**
 * 사용자 기기에서 난 오류를 서버(`POST /api/v1/client-errors` — kotlin-skeleton `alert` 모듈, 기본 꺼짐)로 보내는 최소형.
 * 앱 · UI 는 [ErrorReporter] 인터페이스만 안다 — 나중에 Sentry 같은 서비스로 바꿀 때는 이 인터페이스를 구현한 객체를 꽂으면 된다.
 *
 * 보내는 것: 오류(이름 · 메시지 · 스택) · 화면 경로 · 앱 버전 · **마지막 API 요청의 traceId**(서버 로그에서 같은 값으로 찾는다) · 접힌 횟수.
 * 보내는 일이 앱을 죽이거나 느리게 하지 않는다: 어떤 실패도 삼키고, 같은 오류는 창 안에서 접고, 페이지 하나가 보낼 수 있는 수에 상한이 있다.
 */

export type ErrorReportContext = {
  /** 어디서 잡았나 — `boundary` · `window.onerror` · `unhandledrejection` · 앱이 정한 이름 */
  source?: string
  /** React 가 알려 준 컴포넌트 스택(`ErrorBoundary`) */
  componentStack?: string
}

export interface ErrorReporter {
  report(error: unknown, context?: ErrorReportContext): void
  /** 접어 둔 반복을 지금 보낸다(페이지를 떠날 때). 없어도 된다 */
  flush?(): void
}

/** 서버가 받는 본문 — kotlin-skeleton `docs/alert.md` 「Errors from the user's device」 */
export type ErrorReportPayload = {
  platform: 'web'
  source?: string
  name?: string
  message: string
  stack?: string
  componentStack?: string
  route?: string
  release?: string
  traceId?: string
  count: number
}

export type ErrorReporterOptions = {
  /** 받는 주소 전체 — 보통 `apiClient.endpoint('/client-errors')` */
  endpoint: string
  /** 앱 버전(빌드 식별자). 어느 배포에서 난 오류인지 알아야 몰림 경보를 읽을 수 있다 */
  release?: string
  /** 마지막 API 요청의 traceId — 보통 `apiClient.lastTraceId` */
  getTraceId?: () => string | undefined
  /** 지금 화면 경로. 기본 `location.pathname`(쿼리 · 조각 없이) */
  getRoute?: () => string | undefined
  /** 전송을 바꿔 끼운다(Sentry · 테스트). 기본은 `fetch`(keepalive, 쿠키 · 토큰 없이). 던지거나 거절돼도 앱은 모른다 */
  send?: (url: string, payload: ErrorReportPayload) => void | Promise<unknown>
  /** 같은 오류를 접는 창(기본 60초): 첫 건은 바로 보내고 창 안의 반복은 세어 두었다가 다음 보고에 `count` 로 싣는다 */
  dedupeWindowMs?: number
  /** 페이지 하나(새로 열 때까지)가 보낼 수 있는 보고 수(기본 20) — 렌더 루프가 서버를 두드리지 못하게 */
  maxReports?: number
  now?: () => number
}

export const noopErrorReporter: ErrorReporter = { report: () => undefined }

const LIMITS = { message: 500, stack: 4_000, componentStack: 1_500 }
const MAX_TRACKED = 50

type Seen = { sentAt: number; folded: number; payload: ErrorReportPayload }

export function createErrorReporter(options: ErrorReporterOptions): ErrorReporter {
  const windowMs = options.dedupeWindowMs ?? 60_000
  const budget = options.maxReports ?? 20
  const now = options.now ?? Date.now
  const send = options.send ?? defaultSend
  const seen = new Map<string, Seen>()
  let sentCount = 0

  function deliver(payload: ErrorReportPayload) {
    if (sentCount >= budget) return
    sentCount += 1
    try {
      void Promise.resolve(send(options.endpoint, payload)).catch(() => undefined)
    } catch {
      // 보고가 실패해도 앱은 그대로 — 오프라인 · 거절(429) · 서버 꺼짐은 버린다
    }
  }

  return {
    report(error, context) {
      try {
        const payload = toPayload(error, context, options)
        const key = `${payload.name ?? ''}|${payload.message}|${stackHead(payload.stack)}`
        const at = now()
        const previous = seen.get(key)
        if (previous && at - previous.sentAt < windowMs) {
          previous.folded += 1
          return
        }
        if (seen.size >= MAX_TRACKED) seen.delete(seen.keys().next().value as string)
        seen.delete(key)
        seen.set(key, { sentAt: at, folded: 0, payload })
        deliver({ ...payload, count: 1 + (previous?.folded ?? 0) })
      } catch {
        // 보고하는 코드가 오류를 내도 삼킨다
      }
    },
    flush() {
      try {
        for (const entry of seen.values()) {
          if (entry.folded === 0) continue
          deliver({ ...entry.payload, count: entry.folded })
          entry.folded = 0
        }
      } catch {
        // 위와 같다
      }
    },
  }
}

/**
 * 잡히지 않은 오류와 처리 안 된 Promise 거절을 보고처로 — `window.onerror` 를 덮어쓰지 않고 이벤트로 듣는다(다른 코드의 핸들러가 살아 있다).
 * 페이지를 숨길 때(`pagehide`) 접어 둔 반복을 보낸다. 돌려주는 함수가 끈다. 서버 렌더(window 없음)에서는 아무것도 하지 않는다.
 */
export function installGlobalErrorReporting(
  reporter: ErrorReporter,
  target: EventTarget | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  if (!target) return () => undefined
  const onError = (event: Event) => {
    const { error, message } = event as Event & { error?: unknown; message?: unknown }
    reporter.report(error ?? message ?? 'Unknown error', { source: 'window.onerror' })
  }
  const onRejection = (event: Event) => {
    reporter.report((event as Event & { reason?: unknown }).reason, {
      source: 'unhandledrejection',
    })
  }
  const onHide = () => reporter.flush?.()
  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)
  target.addEventListener('pagehide', onHide)
  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
    target.removeEventListener('pagehide', onHide)
  }
}

function toPayload(
  error: unknown,
  context: ErrorReportContext | undefined,
  options: ErrorReporterOptions,
): ErrorReportPayload {
  const isError = error instanceof Error
  return {
    platform: 'web',
    source: context?.source,
    name: isError ? error.name : undefined,
    // 서버는 빈 message 를 400 으로 거절하고 그래도 한도는 닳는다
    message:
      cut(isError ? error.message : describe(error), LIMITS.message) ||
      (isError ? error.name : '') ||
      'Error',
    stack: isError ? cut(error.stack, LIMITS.stack) : undefined,
    componentStack: cut(context?.componentStack, LIMITS.componentStack),
    route: attempt(options.getRoute) ?? defaultRoute(),
    release: options.release,
    traceId: attempt(options.getTraceId),
    count: 1,
  }
}

function describe(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? String(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

const cut = (text: string | undefined, max: number) => text?.slice(0, max)

/** 값 읽기가 던져도 보고는 간다 */
function attempt(read: (() => string | undefined) | undefined): string | undefined {
  try {
    return read?.()
  } catch {
    return undefined
  }
}

function defaultRoute(): string | undefined {
  return typeof location === 'undefined' ? undefined : location.pathname
}

/** 같은 오류인지 가르는 데 쓰는 스택의 앞부분(첫 두 줄) */
function stackHead(stack: string | undefined): string {
  return stack?.split('\n', 2).join('\n') ?? ''
}

function defaultSend(url: string, payload: ErrorReportPayload): Promise<unknown> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: 'omit',
  })
}
