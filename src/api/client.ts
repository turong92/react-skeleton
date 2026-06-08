import {
  ApiRequestError,
  type ApiError,
  type ApiListResponse,
  type ApiPageResponse,
  type ApiValueResponse,
} from './types'
import { createTraceContext, type TraceContext } from './traceContext'

const DEFAULT_BASE_URL = '/api/v1'
export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
const IS_DEV = import.meta.env.DEV

export type ApiRequestInit = RequestInit & {
  traceId?: string
}

/**
 * 공통 fetch 래퍼.
 *
 * - 요청마다 W3C `traceparent` 헤더 자동 부착
 * - 응답 성공 시 백엔드 표준 envelope(`value`, `values`, `pagination`, `meta`) 파싱
 * - 응답 실패 시 백엔드 [ApiError] 파싱 후 [ApiRequestError] throw
 * - 개발 모드에선 요청/응답/에러를 `console.group`으로 묶어 출력 (traceId/spanId 포함)
 *
 * TanStack Query `queryFn: () => api<T>('/path')` 형태로 사용.
 * 여러 요청을 같은 작업으로 묶으려면 같은 traceId 를 init.traceId 로 넘긴다.
 */
export async function api<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiValue<T>(path, init)
}

export async function apiValue<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const envelope = await apiEnvelope<ApiValueResponse<T>>(path, init)
  assertApiValueResponse(envelope, path)
  return envelope.value
}

export async function apiList<T>(path: string, init?: ApiRequestInit): Promise<T[]> {
  const envelope = await apiEnvelope<ApiListResponse<T>>(path, init)
  assertApiListResponse(envelope, path)
  return envelope.values
}

export async function apiPage<T>(path: string, init?: ApiRequestInit): Promise<ApiPageResponse<T>> {
  const envelope = await apiEnvelope<ApiPageResponse<T>>(path, init)
  assertApiPageResponse(envelope, path)
  return envelope
}

export async function apiEnvelope<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const { traceId, headers, ...fetchInit } = init ?? {}
  const traceContext = createTraceContext(traceId)
  const url = apiUrl(path)
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

  const data = await readJson<T>(res)
  if (IS_DEV) logSuccess(url, fetchInit.method ?? 'GET', traceContext, durationMs, data)
  return data
}

function normalizeBaseUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function apiUrl(path: string): string {
  return `${API_BASE_URL}/${path.replace(/^\/+/, '')}`
}

function assertApiValueResponse<T>(
  value: ApiValueResponse<T>,
  path: string,
): asserts value is ApiValueResponse<T> {
  if (!isRecord(value) || !('value' in value) || !isRecord(value.meta)) {
    throw new Error(`Expected ApiValueResponse from ${path}`)
  }
}

function assertApiListResponse<T>(
  value: ApiListResponse<T>,
  path: string,
): asserts value is ApiListResponse<T> {
  if (!isRecord(value) || !Array.isArray(value.values) || !isRecord(value.meta)) {
    throw new Error(`Expected ApiListResponse from ${path}`)
  }
}

function assertApiPageResponse<T>(
  value: ApiPageResponse<T>,
  path: string,
): asserts value is ApiPageResponse<T> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.values) ||
    !isRecord(value.pagination) ||
    !isRecord(value.meta)
  ) {
    throw new Error(`Expected ApiPageResponse from ${path}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function safeReadApiError(res: Response): Promise<ApiError | null> {
  try {
    return await readJson<ApiError>(res)
  } catch {
    return null
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
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

function logSuccess(
  url: string,
  method: string,
  traceContext: TraceContext,
  durationMs: number,
  data: unknown,
) {
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
