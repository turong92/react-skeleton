import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
  type Method,
} from 'axios'
import {
  type ApiBasicResponse,
  type ApiCursorResponse,
  type ApiError,
  type ApiHttpResponse,
  ApiRequestError,
  type ApiListResponse,
  type ApiPageResponse,
  type ApiValueResponse,
  type BreakGlassIdentity,
  type DevLoginIdentity,
} from '../../api/types'
import { createTraceContext, type TraceContext } from '../../api/traceContext'

export type SkeletonHttpRetryOptions = {
  attempts: number
  delayMs?: number
  methods?: Method[]
  statuses?: number[]
}

export type SkeletonHttpClientOptions = {
  baseURL: string
  timeoutMs?: number
  retry?: SkeletonHttpRetryOptions
  adapter?: AxiosAdapter
  requestInterceptors?: SkeletonRequestInterceptor[]
  responseInterceptors?: SkeletonResponseInterceptor[]
  errorInterceptors?: SkeletonErrorInterceptor[]
}

export type SkeletonRequestInterceptor = (
  config: AxiosRequestConfig,
) => AxiosRequestConfig | Promise<AxiosRequestConfig>

export type SkeletonResponseInterceptor = (
  response: AxiosResponse,
) => AxiosResponse | Promise<AxiosResponse>

export type SkeletonErrorInterceptor = (error: unknown) => unknown | Promise<unknown>

export type SkeletonHttpRequest = {
  method?: Method
  traceId?: string
  accessToken?: string | null
  idempotencyKey?: string
  devLogin?: DevLoginIdentity
  breakGlass?: BreakGlassIdentity
  headers?: Record<string, string | undefined>
  params?: Record<string, unknown>
  json?: unknown
  data?: unknown
  timeoutMs?: number
  signal?: AbortSignal
}

export type SkeletonHttpClient = {
  response<TEnvelope = unknown>(
    path: string,
    request?: SkeletonHttpRequest,
  ): Promise<ApiHttpResponse<TEnvelope>>
  envelope<TEnvelope>(path: string, request?: SkeletonHttpRequest): Promise<TEnvelope>
  basic(path: string, request?: SkeletonHttpRequest): Promise<ApiBasicResponse>
  value<T>(path: string, request?: SkeletonHttpRequest): Promise<T>
  list<T>(path: string, request?: SkeletonHttpRequest): Promise<T[]>
  page<T>(path: string, request?: SkeletonHttpRequest): Promise<ApiPageResponse<T>>
  cursor<T>(path: string, request?: SkeletonHttpRequest): Promise<ApiCursorResponse<T>>
  endpoint(path: string): string
  axios: AxiosInstance
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRY: SkeletonHttpRetryOptions = {
  attempts: 0,
  delayMs: 150,
  methods: ['GET', 'HEAD', 'OPTIONS'],
  statuses: [408, 429, 500, 502, 503, 504],
}

export function createSkeletonHttpClient(options: SkeletonHttpClientOptions): SkeletonHttpClient {
  const baseURL = normalizeBaseUrl(options.baseURL)
  const retry = normalizeRetry(options.retry)
  const instance = axios.create({
    adapter: options.adapter,
    baseURL,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    validateStatus: () => true,
  })

  options.requestInterceptors?.forEach((interceptor) => {
    instance.interceptors.request.use(async (config) => toInternalConfig(await interceptor(config)))
  })
  options.responseInterceptors?.forEach((interceptor) => {
    instance.interceptors.response.use((response) => Promise.resolve(interceptor(response)))
  })
  options.errorInterceptors?.forEach((interceptor) => {
    instance.interceptors.response.use(undefined, (error) => Promise.reject(interceptor(error)))
  })

  async function response<TEnvelope = unknown>(
    path: string,
    request: SkeletonHttpRequest = {},
  ): Promise<ApiHttpResponse<TEnvelope>> {
    const traceContext = createTraceContext(request.traceId)
    const method = request.method ?? 'GET'
    const axiosRequest = buildAxiosRequest(path, method, request, traceContext, options.timeoutMs)
    const started = nowMs()

    try {
      const axiosResponse = await executeWithRetry(instance, axiosRequest, retry)
      const durationMs = Math.round(nowMs() - started)
      const headers = normalizeHeaders(axiosResponse.headers)
      if (axiosResponse.status >= 400) {
        throw apiRequestErrorFromResponse(axiosResponse, path, traceContext, headers)
      }
      const data = axiosResponse.data as TEnvelope
      logSuccess(path, method, traceContext, durationMs, data)
      return {
        status: axiosResponse.status,
        headers,
        envelope: data,
        trace: responseTrace(data, headers, traceContext),
      }
    } catch (error) {
      if (error instanceof ApiRequestError) throw error
      throw apiRequestErrorFromTransport(error, path, traceContext)
    }
  }

  async function envelope<TEnvelope>(
    path: string,
    request?: SkeletonHttpRequest,
  ): Promise<TEnvelope> {
    const transport = await response<TEnvelope>(path, request)
    return transport.envelope
  }

  return {
    response,
    envelope,
    basic: async (path, request) => {
      const result = await envelope<ApiBasicResponse>(path, request)
      assertBasic(result, path)
      return result
    },
    value: async <T>(path: string, request?: SkeletonHttpRequest) => {
      const result = await envelope<ApiValueResponse<T>>(path, request)
      assertValue(result, path)
      return result.value
    },
    list: async <T>(path: string, request?: SkeletonHttpRequest) => {
      const result = await envelope<ApiListResponse<T>>(path, request)
      assertList(result, path)
      return result.values
    },
    page: async <T>(path: string, request?: SkeletonHttpRequest) => {
      const result = await envelope<ApiPageResponse<T>>(path, request)
      assertPage(result, path)
      return result
    },
    cursor: async <T>(path: string, request?: SkeletonHttpRequest) => {
      const result = await envelope<ApiCursorResponse<T>>(path, request)
      assertCursor(result, path)
      return result
    },
    endpoint: (path) => `${baseURL}/${path.replace(/^\/+/, '')}`,
    axios: instance,
  }
}

function buildAxiosRequest(
  path: string,
  method: Method,
  request: SkeletonHttpRequest,
  traceContext: TraceContext,
  defaultTimeoutMs?: number,
): AxiosRequestConfig {
  const headers = new AxiosHeaders(compactHeaders(request.headers))
  headers.set('traceparent', traceContext.traceparent)
  headers.set('X-Trace-Id', traceContext.traceId)

  if (request.accessToken) {
    headers.set(
      'Authorization',
      request.accessToken.startsWith('Bearer ')
        ? request.accessToken
        : `Bearer ${request.accessToken}`,
    )
  }

  if (request.idempotencyKey) headers.set('Idempotency-Key', request.idempotencyKey)
  if (request.devLogin?.accountId) headers.set('X-Dev-Account-Id', request.devLogin.accountId)
  if (request.devLogin?.username) headers.set('X-Dev-Username', request.devLogin.username)
  if (request.devLogin?.email) headers.set('X-Dev-Email', request.devLogin.email)

  if (request.breakGlass) {
    headers.set('X-Break-Glass-Account-Id', request.breakGlass.accountId)
    headers.set('X-Break-Glass-Reason', request.breakGlass.reason)
    headers.set('X-Break-Glass-Secret', request.breakGlass.secret)
  }

  if (request.json !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return {
    url: path,
    method,
    headers,
    params: request.params,
    data: request.json ?? request.data,
    timeout: request.timeoutMs ?? defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
    signal: request.signal,
  }
}

async function executeWithRetry(
  instance: AxiosInstance,
  request: AxiosRequestConfig,
  retry: SkeletonHttpRetryOptions,
): Promise<AxiosResponse> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retry.attempts; attempt += 1) {
    try {
      const response = await instance.request(request)
      if (attempt < retry.attempts && shouldRetryResponse(response, retry)) {
        await delay(retry.delayMs ?? 0)
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (attempt >= retry.attempts || !shouldRetryError(error, request, retry)) {
        throw error
      }
      await delay(retry.delayMs ?? 0)
    }
  }
  throw lastError
}

function shouldRetryResponse(response: AxiosResponse, retry: SkeletonHttpRetryOptions): boolean {
  return (
    retry.statuses?.includes(response.status) === true &&
    shouldRetryMethod(response.config.method, retry)
  )
}

function shouldRetryError(
  error: unknown,
  request: AxiosRequestConfig,
  retry: SkeletonHttpRetryOptions,
): boolean {
  if (!shouldRetryMethod(request.method, retry)) return false
  if (error instanceof AxiosError && error.response) {
    return retry.statuses?.includes(error.response.status) === true
  }
  return true
}

function shouldRetryMethod(method: string | undefined, retry: SkeletonHttpRetryOptions): boolean {
  const allowed = retry.methods ?? DEFAULT_RETRY.methods
  return (
    allowed?.map((value) => value.toUpperCase()).includes((method ?? 'GET').toUpperCase()) === true
  )
}

function normalizeRetry(retry?: SkeletonHttpRetryOptions): SkeletonHttpRetryOptions {
  return {
    ...DEFAULT_RETRY,
    ...retry,
    attempts: retry?.attempts ?? DEFAULT_RETRY.attempts,
  }
}

function apiRequestErrorFromResponse(
  response: AxiosResponse,
  path: string,
  traceContext: TraceContext,
  headers: Record<string, string>,
): ApiRequestError {
  const apiError = isApiError(response.data)
    ? response.data
    : {
        type: 'about:blank',
        title: response.statusText || 'Request failed',
        status: response.status,
        detail: `Failed to reach ${path}`,
        timestamp: new Date().toISOString(),
      }
  return new ApiRequestError(
    apiError,
    apiError.traceId ?? headers['x-trace-id'] ?? traceContext.traceId,
    apiError.spanId ?? headers['x-span-id'] ?? traceContext.spanId,
    headers.traceparent ?? traceContext.traceparent,
  )
}

function apiRequestErrorFromTransport(
  error: unknown,
  path: string,
  traceContext: TraceContext,
): ApiRequestError {
  const message = error instanceof Error ? error.message : String(error)
  return new ApiRequestError(
    {
      type: 'about:blank',
      title: 'Network error',
      status: 0,
      detail: `Failed to reach ${path}: ${message}`,
      timestamp: new Date().toISOString(),
    },
    traceContext.traceId,
    traceContext.spanId,
    traceContext.traceparent,
  )
}

function responseTrace(data: unknown, headers: Record<string, string>, traceContext: TraceContext) {
  const meta = isRecord(data) && isRecord(data.meta) ? data.meta : undefined
  return {
    traceId: stringOrUndefined(headers['x-trace-id']) ?? stringOrUndefined(meta?.traceId),
    spanId: stringOrUndefined(headers['x-span-id']) ?? stringOrUndefined(meta?.spanId),
    traceparent: stringOrUndefined(headers.traceparent) ?? traceContext.traceparent,
  }
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  const normalized: Record<string, string> = {}
  Object.entries(headers ?? {}).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  })
  return normalized
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function compactHeaders(
  headers?: Record<string, string | undefined>,
): Record<string, string> | undefined {
  if (!headers) return undefined
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

function toInternalConfig(config: AxiosRequestConfig): InternalAxiosRequestConfig {
  return config as InternalAxiosRequestConfig
}

function isApiError(value: unknown): value is ApiError {
  return isRecord(value) && typeof value.title === 'string' && typeof value.status === 'number'
}

function assertBasic(value: ApiBasicResponse, path: string): asserts value is ApiBasicResponse {
  if (!isRecord(value) || !isRecord(value.meta))
    throw new Error(`Expected ApiBasicResponse from ${path}`)
}

function assertValue<T>(
  value: ApiValueResponse<T>,
  path: string,
): asserts value is ApiValueResponse<T> {
  if (!isRecord(value) || !('value' in value) || !isRecord(value.meta)) {
    throw new Error(`Expected ApiValueResponse from ${path}`)
  }
}

function assertList<T>(
  value: ApiListResponse<T>,
  path: string,
): asserts value is ApiListResponse<T> {
  if (!isRecord(value) || !Array.isArray(value.values) || !isRecord(value.meta)) {
    throw new Error(`Expected ApiListResponse from ${path}`)
  }
}

function assertPage<T>(
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

function assertCursor<T>(
  value: ApiCursorResponse<T>,
  path: string,
): asserts value is ApiCursorResponse<T> {
  if (
    !isRecord(value) ||
    !Array.isArray(value.values) ||
    !isRecord(value.cursor) ||
    !isRecord(value.meta)
  ) {
    throw new Error(`Expected ApiCursorResponse from ${path}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function nowMs(): number {
  return performance.now()
}

function logSuccess(
  path: string,
  method: Method,
  traceContext: TraceContext,
  durationMs: number,
  data: unknown,
) {
  if (!import.meta.env.DEV) return
  console.groupCollapsed(
    `%c✓ ${method} ${path} %c${durationMs}ms %c[${traceContext.traceId.slice(0, 8)}:${traceContext.spanId}]`,
    'color: #27ae60; font-weight: bold',
    'color: #888',
    'color: #888; font-weight: normal',
  )
  console.log('response:', data)
  console.log('traceparent:', traceContext.traceparent)
  console.groupEnd()
}
