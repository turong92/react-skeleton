import { ApiRequestError, type ApiError } from './types'

const BASE_URL = '/api/v1'
const IS_DEV = import.meta.env.DEV

/**
 * 공통 fetch 래퍼.
 *
 * - 요청마다 UUID 기반 `X-Request-Id` 헤더 자동 부착
 * - 응답 실패 시 백엔드 [ApiError] 파싱 후 [ApiRequestError] throw
 * - 개발 모드에선 요청/응답/에러를 `console.group`으로 묶어 출력 (traceId 포함)
 *
 * TanStack Query `queryFn: () => api<T>('/path')` 형태로 사용.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const requestId = crypto.randomUUID()
  const url = `${BASE_URL}${path}`
  const started = performance.now()

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
      ...init?.headers,
    },
  })

  const durationMs = Math.round(performance.now() - started)

  if (!res.ok) {
    const apiError = (await safeReadApiError(res)) ?? fallbackError(res, path)
    logError(url, init?.method ?? 'GET', requestId, durationMs, apiError)
    throw new ApiRequestError(apiError, requestId)
  }

  const data = (await res.json()) as T
  if (IS_DEV) logSuccess(url, init?.method ?? 'GET', requestId, durationMs, data)
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

function logSuccess(url: string, method: string, requestId: string, durationMs: number, data: unknown) {
  console.groupCollapsed(
    `%c✓ ${method} ${url} %c${durationMs}ms %c[${requestId.slice(0, 8)}]`,
    'color: #27ae60; font-weight: bold',
    'color: #888',
    'color: #888; font-weight: normal',
  )
  console.log('response:', data)
  console.groupEnd()
}

function logError(
  url: string,
  method: string,
  requestId: string,
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
  console.log('requestId (client):', requestId)
  if (apiError.errors?.length) console.table(apiError.errors)
  console.groupEnd()
}
