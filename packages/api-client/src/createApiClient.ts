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
} from './types'
import { ClientErrorCodes } from './errorCodes'
import { createTraceContext, type TraceContext } from './traceContext'

export type ApiRetryOptions = {
  attempts: number
  delayMs?: number
  methods?: Method[]
  statuses?: number[]
}

export type HeaderRecord = Record<string, string>

export type ApiClientConfig = {
  /** 예: `/api/v1`, `https://api.example.com/api/v1`. 환경변수 읽기는 앱이 한다(`apiConfigFromEnv`) */
  baseUrl: string
  timeoutMs?: number
  retry?: ApiRetryOptions
  /** 요청마다 불러 인증 헤더를 얻는다(토큰이 바뀌어도 따라간다). 요청의 `headers` 가 이긴다 · `skipAuth` 면 건너뜀 */
  getAuthHeaders?: () => HeaderRecord | undefined | Promise<HeaderRecord | undefined>
  /** `X-Time-Zone` 값. 돌려주지 않으면 헤더를 보내지 않는다 */
  getTimeZone?: () => string | undefined
  /** 모든 응답(에러 포함)의 `Date` 헤더 — 서버 시각 보정(`createServerClock().observeDateHeader`)을 여기에 건다 */
  onResponseDate?: (date: string | undefined) => void
  /** 실패한 요청이 `ApiRequestError` 로 던져지기 직전에 한 번. 401 처리(`@skeleton/auth`)나 로깅을 건다. 여기서 던져도 원래 에러가 나간다 */
  onError?: (error: ApiRequestError) => void
  /**
   * 인증이 붙은 요청이 401 을 받았을 때 한 번 부른다 — true 를 돌려주면 (새 인증 헤더로) 같은 요청을 **한 번만** 다시 보낸다(무한 재시도 없음).
   * false 면 원래 401 이 그대로 나가고, 던지면 던진 에러가 나간다(예: 갱신 중 네트워크 오류). `skipAuth` 요청(로그인 · 갱신 자신)은 부르지 않는다.
   * 토큰 갱신(`@skeleton/auth` 의 `createSessionRefresher`)을 여기에 꽂는다.
   */
  recoverUnauthorized?: (context: UnauthorizedContext) => Promise<boolean>
  /**
   * 인증이 붙은 요청이 403 을 받았을 때 한 번 부른다 — 사용자에게 물어 풀 수 있는 403(법적 문서 재동의 `LEGAL.RECONSENT_REQUIRED`)을 여기서 푼다.
   * true 면 같은 요청을 **한 번만** 다시 보낸다(무한 재시도 없음 — 401 복구를 했던 요청은 다시 복구하지 않는다), false 면 원래 403 이 나간다. 던지면 던진 에러가 나간다.
   * 로그아웃하지 않는다 — 403 은 세션이 끝난 것이 아니다. `skipAuth` 요청은 부르지 않는다.
   */
  recoverForbidden?: (context: ForbiddenContext) => Promise<boolean>
  /** 쿠키를 함께 보낸다(리프레시 토큰이 HttpOnly 쿠키로 오가는 `cookie` 모드 · 다른 origin 의 백엔드) */
  withCredentials?: boolean
  /** true 면 요청마다 콘솔 그룹 로그(보통 `import.meta.env.DEV`) */
  debug?: boolean
  adapter?: AxiosAdapter
  requestInterceptors?: ApiRequestInterceptor[]
  responseInterceptors?: ApiResponseInterceptor[]
  errorInterceptors?: ApiErrorInterceptor[]
}

export type UnauthorizedContext = {
  error: ApiRequestError
  /** 실패한 요청이 보낸 `Authorization` 값 — 그 사이 토큰이 이미 바뀌었는지(다른 요청 · 탭이 갱신했는지) 비교한다 */
  failedAuthorization: string | undefined
}

export type ForbiddenContext = {
  error: ApiRequestError
  /** 실패한 요청의 경로(`baseUrl` 뒤 — 예 `/notes`)와 메서드 — 앱이 「이 경로는 처리하지 않는다」를 가린다 */
  path: string
  method: string
}

export type ApiRequestInterceptor = (
  config: AxiosRequestConfig,
) => AxiosRequestConfig | Promise<AxiosRequestConfig>

export type ApiResponseInterceptor = (
  response: AxiosResponse,
) => AxiosResponse | Promise<AxiosResponse>

export type ApiErrorInterceptor = (error: unknown) => unknown | Promise<unknown>

export type ApiRequest = {
  method?: Method
  traceId?: string
  idempotencyKey?: string
  headers?: Record<string, string | undefined>
  params?: Record<string, unknown>
  json?: unknown
  data?: unknown
  timeoutMs?: number
  signal?: AbortSignal
  /** true 면 `getAuthHeaders` 를 부르지 않는다(로그인 요청 자신 등) */
  skipAuth?: boolean
}

export type ApiClient = {
  response<TEnvelope = unknown>(
    path: string,
    request?: ApiRequest,
  ): Promise<ApiHttpResponse<TEnvelope>>
  envelope<TEnvelope>(path: string, request?: ApiRequest): Promise<TEnvelope>
  basic(path: string, request?: ApiRequest): Promise<ApiBasicResponse>
  /** 본문이 없는 성공(204 — 백엔드 `Response.noContent()`: 삭제 · 토글 · 명령 완료). 실패는 그대로 `ApiRequestError` 로 던진다 */
  noContent(path: string, request?: ApiRequest): Promise<void>
  value<T>(path: string, request?: ApiRequest): Promise<T>
  list<T>(path: string, request?: ApiRequest): Promise<T[]>
  page<T>(path: string, request?: ApiRequest): Promise<ApiPageResponse<T>>
  cursor<T>(path: string, request?: ApiRequest): Promise<ApiCursorResponse<T>>
  endpoint(path: string): string
  axios: AxiosInstance
}

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRY: ApiRetryOptions = {
  attempts: 0,
  delayMs: 150,
  methods: ['GET', 'HEAD', 'OPTIONS'],
  statuses: [408, 429, 500, 502, 503, 504],
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const baseURL = normalizeBaseUrl(config.baseUrl)
  const retry = normalizeRetry(config.retry)
  const instance = axios.create({
    adapter: config.adapter,
    baseURL,
    timeout: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    validateStatus: () => true,
  })

  config.requestInterceptors?.forEach((interceptor) => {
    instance.interceptors.request.use(async (axiosConfig) =>
      toInternalConfig(await interceptor(axiosConfig)),
    )
  })
  config.responseInterceptors?.forEach((interceptor) => {
    instance.interceptors.response.use((response) => Promise.resolve(interceptor(response)))
  })
  config.errorInterceptors?.forEach((interceptor) => {
    instance.interceptors.response.use(undefined, (error) => Promise.reject(interceptor(error)))
  })

  function response<TEnvelope = unknown>(
    path: string,
    request: ApiRequest = {},
  ): Promise<ApiHttpResponse<TEnvelope>> {
    return perform<TEnvelope>(path, request, true)
  }

  async function perform<TEnvelope>(
    path: string,
    request: ApiRequest,
    mayRecover: boolean,
  ): Promise<ApiHttpResponse<TEnvelope>> {
    const traceContext = createTraceContext(request.traceId)
    const method = request.method ?? 'GET'
    const providedHeaders = await providerHeaders(config, request)
    const axiosRequest = buildAxiosRequest(
      path,
      method,
      request,
      traceContext,
      providedHeaders,
      config.timeoutMs,
      config.withCredentials,
    )
    const started = nowMs()

    try {
      const axiosResponse = await executeWithRetry(instance, axiosRequest, retry)
      const durationMs = Math.round(nowMs() - started)
      const headers = normalizeHeaders(axiosResponse.headers)
      config.onResponseDate?.(headers.date)
      if (axiosResponse.status >= 400) {
        throw apiRequestErrorFromResponse(axiosResponse, path, traceContext, headers)
      }
      const data = axiosResponse.data as TEnvelope
      if (config.debug) logSuccess(path, method, traceContext, durationMs, data)
      return {
        status: axiosResponse.status,
        headers,
        envelope: data,
        trace: responseTrace(data, headers, traceContext),
      }
    } catch (error) {
      const failure =
        error instanceof ApiRequestError
          ? error
          : apiRequestErrorFromTransport(error, path, traceContext)
      if (
        mayRecover &&
        config.recoverUnauthorized &&
        !request.skipAuth &&
        failure.apiError.status === 401
      ) {
        let recovered: boolean
        try {
          recovered = await config.recoverUnauthorized({
            error: failure,
            failedAuthorization: authorizationOf(axiosRequest),
          })
        } catch (recoveryError) {
          const surfaced =
            recoveryError instanceof ApiRequestError
              ? recoveryError
              : apiRequestErrorFromTransport(recoveryError, path, traceContext)
          notifyError(config.onError, surfaced)
          throw surfaced
        }
        if (recovered) return perform<TEnvelope>(path, request, false)
      }
      if (
        mayRecover &&
        config.recoverForbidden &&
        !request.skipAuth &&
        failure.apiError.status === 403
      ) {
        let recovered: boolean
        try {
          recovered = await config.recoverForbidden({ error: failure, path, method })
        } catch (recoveryError) {
          const surfaced =
            recoveryError instanceof ApiRequestError
              ? recoveryError
              : apiRequestErrorFromTransport(recoveryError, path, traceContext)
          notifyError(config.onError, surfaced)
          throw surfaced
        }
        if (recovered) return perform<TEnvelope>(path, request, false)
      }
      notifyError(config.onError, failure)
      throw failure
    }
  }

  async function envelope<TEnvelope>(path: string, request?: ApiRequest): Promise<TEnvelope> {
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
    noContent: async (path, request) => {
      await response(path, request)
    },
    value: async <T>(path: string, request?: ApiRequest) => {
      const result = await envelope<ApiValueResponse<T>>(path, request)
      assertValue(result, path)
      return result.value
    },
    list: async <T>(path: string, request?: ApiRequest) => {
      const result = await envelope<ApiListResponse<T>>(path, request)
      assertList(result, path)
      return result.values
    },
    page: async <T>(path: string, request?: ApiRequest) => {
      const result = await envelope<ApiPageResponse<T>>(path, request)
      assertPage(result, path)
      return result
    },
    cursor: async <T>(path: string, request?: ApiRequest) => {
      const result = await envelope<ApiCursorResponse<T>>(path, request)
      assertCursor(result, path)
      return result
    },
    endpoint: (path) => `${baseURL}/${path.replace(/^\/+/, '')}`,
    axios: instance,
  }
}

/** 기본 헤더(시간대 · 인증) — 요청의 `headers` 가 덮어쓴다 */
async function providerHeaders(
  config: ApiClientConfig,
  request: ApiRequest,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  const zone = config.getTimeZone?.()
  if (zone) headers['X-Time-Zone'] = zone
  if (!request.skipAuth) Object.assign(headers, await config.getAuthHeaders?.())
  return headers
}

function notifyError(handler: ApiClientConfig['onError'], error: ApiRequestError) {
  try {
    handler?.(error)
  } catch {
    // 훅이 던져도 호출자는 원래 에러를 받는다
  }
}

function buildAxiosRequest(
  path: string,
  method: Method,
  request: ApiRequest,
  traceContext: TraceContext,
  providedHeaders: Record<string, string>,
  defaultTimeoutMs?: number,
  withCredentials?: boolean,
): AxiosRequestConfig {
  const headers = new AxiosHeaders({ ...providedHeaders, ...compactHeaders(request.headers) })
  headers.set('traceparent', traceContext.traceparent)
  headers.set('X-Trace-Id', traceContext.traceId)
  if (request.idempotencyKey) headers.set('Idempotency-Key', request.idempotencyKey)
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
    ...(withCredentials ? { withCredentials: true } : {}),
  }
}

function authorizationOf(request: AxiosRequestConfig): string | undefined {
  const value = AxiosHeaders.from(request.headers as AxiosHeaders).get('Authorization')
  return typeof value === 'string' ? value : undefined
}

async function executeWithRetry(
  instance: AxiosInstance,
  request: AxiosRequestConfig,
  retry: ApiRetryOptions,
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

function shouldRetryResponse(response: AxiosResponse, retry: ApiRetryOptions): boolean {
  return (
    retry.statuses?.includes(response.status) === true &&
    shouldRetryMethod(response.config.method, retry)
  )
}

function shouldRetryError(
  error: unknown,
  request: AxiosRequestConfig,
  retry: ApiRetryOptions,
): boolean {
  if (!shouldRetryMethod(request.method, retry)) return false
  if (error instanceof AxiosError && error.response) {
    return retry.statuses?.includes(error.response.status) === true
  }
  return true
}

function shouldRetryMethod(method: string | undefined, retry: ApiRetryOptions): boolean {
  const allowed = retry.methods ?? DEFAULT_RETRY.methods
  return (
    allowed?.map((value) => value.toUpperCase()).includes((method ?? 'GET').toUpperCase()) === true
  )
}

function normalizeRetry(retry?: ApiRetryOptions): ApiRetryOptions {
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
        code: ClientErrorCodes.HTTP_ERROR,
        title: response.statusText || 'Request failed',
        status: response.status,
        detail: `Failed to reach ${path}`,
        timestamp: new Date().toISOString(),
      }
  const failure = new ApiRequestError(
    apiError,
    apiError.traceId ?? headers['x-trace-id'] ?? traceContext.traceId,
    apiError.spanId ?? headers['x-span-id'] ?? traceContext.spanId,
    headers.traceparent ?? traceContext.traceparent,
  )
  const retryAfter = Number(headers['retry-after'])
  if (Number.isFinite(retryAfter) && retryAfter >= 0) failure.retryAfterHeader = retryAfter
  return failure
}

function apiRequestErrorFromTransport(
  error: unknown,
  path: string,
  traceContext: TraceContext,
): ApiRequestError {
  const message = error instanceof Error ? error.message : String(error)
  return new ApiRequestError(
    {
      code: ClientErrorCodes.NETWORK_ERROR,
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
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'number'
  )
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
  return new Promise((resolve) => setTimeout(resolve, ms))
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
