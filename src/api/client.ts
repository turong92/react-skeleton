import { ApiRequestError, type ApiError } from './types'
import { createTraceContext, type TraceContext } from './traceContext'

const BASE_URL = '/api/v1'
const IS_DEV = import.meta.env.DEV

export type ApiRequestInit = RequestInit & {
  traceId?: string
}

/**
 * 공통 fetch 래퍼.
 *
 * - 요청마다 W3C `traceparent` 헤더 자동 부착
 * - 응답 실패 시 백엔드 [ApiError] 파싱 후 [ApiRequestError] throw
 * - 개발 모드에선 요청/응답/에러를 `console.group`으로 묶어 출력 (traceId/spanId 포함)
 *
 * TanStack Query `queryFn: () => api<T>('/path')` 형태로 사용.
 * 여러 요청을 같은 작업으로 묶으려면 같은 traceId 를 init.traceId 로 넘긴다.
 */
export async function api<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const { traceId, headers, ...fetchInit } = init ?? {}
  const traceContext = createTraceContext(traceId)
  const url = `${BASE_URL}${path}`
  const started = performance.now()

  const res = await fetch(url, {
    ...fetchInit,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      traceparent: traceContext.traceparent,
    },
  })

  const durationMs = Math.round(performance.now() - started)

  if (!res.ok) {
    const apiError = (await safeReadApiError(res)) ?? fallbackError(res, path)
    logError(url, fetchInit.method ?? 'GET', traceContext, durationMs, apiError)
    throw new ApiRequestError(
      apiError,
      apiError.traceId ?? traceContext.traceId,
      apiError.spanId ?? traceContext.spanId,
      traceContext.traceparent,
    )
  }

  const data = (await res.json()) as T
  if (IS_DEV) logSuccess(url, fetchInit.method ?? 'GET', traceContext, durationMs, data)
  return data
}

async function safeReadApiError(res: Response): Promise<ApiError | null> {
  try {
    return (await res.json()) as ApiError
  } catch {
    return null
  }
}

function fallbackError(res: Response, path: string): ApiError {
  return {
    type: 'about:blank',
    title: res.statusText || 'Network error',
    status: res.status,
    detail: `Failed to reach ${path}`,
    timestamp: new Date().toISOString(),
  }
}

function logSuccess(url: string, method: string, traceContext: TraceContext, durationMs: number, data: unknown) {
  console.groupCollapsed(
    `%c✓ ${method} ${url} %c${durationMs}ms %c[${traceContext.traceId.slice(0, 8)}:${traceContext.spanId}]`,
    'color: #27ae60; font-weight: bold',
    'color: #888',
    'color: #888; font-weight: normal',
  )
  console.log('response:', data)
  console.log('traceparent:', traceContext.traceparent)
  console.groupEnd()
}

function logError(
  url: string,
  method: string,
  traceContext: TraceContext,
  durationMs: number,
  apiError: ApiError,
) {
  const style = 'color: #c0392b; font-weight: bold'
  const group = IS_DEV ? console.group : console.groupCollapsed
  group.call(
    console,
    `%c✗ ${method} ${url} %c${apiError.status} %c${durationMs}ms`,
    style,
    style,
    'color: #888',
  )
  console.log('title :', apiError.title)
  if (apiError.detail) console.log('detail:', apiError.detail)
  if (apiError.traceId) {
    console.log(
      '%ctraceId: %c' + apiError.traceId,
      'color: #888',
      'color: #3498db; font-family: monospace',
    )
    console.log('→ 서버 로그에서 traceId로 전체 흐름 추적 가능')
  }
  if (apiError.spanId) {
    console.log(
      '%cspanId : %c' + apiError.spanId,
      'color: #888',
      'color: #9b59b6; font-family: monospace',
    )
  }
  console.log('traceparent (client):', traceContext.traceparent)
  if (apiError.errors?.length) console.table(apiError.errors)
  console.groupEnd()
}
