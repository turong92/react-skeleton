/**
 * 백엔드 `ApiError` (RFC 7807 Problem Details 변형) 과 1:1 매칭.
 *
 * 에러 응답 body 예:
 * ```json
 * {
 *   "type": "about:blank",
 *   "title": "Validation failed",
 *   "status": 400,
 *   "detail": "email format invalid",
 *   "traceId": "7a8b9c...",
 *   "spanId": "0f1e2d3c4b5a6978",
 *   "timestamp": "2026-04-20T...",
 *   "errors": [{"field": "email", "code": "INVALID_FORMAT"}]
 * }
 * ```
 */
export type ApiError = {
  type: string
  title: string
  status: number
  detail?: string
  traceId?: string
  spanId?: string
  timestamp: string
  errors?: FieldError[]
}

export type FieldError = {
  field: string
  code: string
  message?: string
}

export type ApiMeta = {
  traceId?: string
  spanId?: string
  timestamp: string
}

export type ApiBasicResponse = {
  meta: ApiMeta
}

export type ApiValueResponse<T> = {
  value: T
  meta: ApiMeta
}

export type ApiListResponse<T> = {
  values: T[]
  meta: ApiMeta
}

export type ApiPageResponse<T> = {
  values: T[]
  pagination: PaginationMeta
  meta: ApiMeta
}

export type ApiCursorResponse<T> = {
  values: T[]
  cursor: CursorMeta
  meta: ApiMeta
}

export type ApiEnvelope<T> =
  | ApiBasicResponse
  | ApiValueResponse<T>
  | ApiListResponse<T>
  | ApiPageResponse<T>
  | ApiCursorResponse<T>

export type PaginationMeta = {
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export type CursorMeta = {
  nextCursor?: string | null
  hasNext: boolean
}

export type ApiTransportTrace = {
  traceId?: string
  spanId?: string
  traceparent?: string
}

export type ApiHttpResponse<TEnvelope> = {
  status: number
  headers: Record<string, string>
  envelope: TEnvelope
  trace: ApiTransportTrace
}

export type DevLoginIdentity = {
  accountId?: string
  username?: string
  email?: string
}

export type BreakGlassIdentity = {
  accountId: string
  reason: string
  secret: string
}

export type AuthPrincipal = {
  accountId: string
  username: string
  email: string
  roles: string[]
}

export type AuthTokenResponse = {
  accessToken: string
  tokenType: string
  expiresAt: string
  principal: AuthPrincipal
}

/**
 * fetch 실패 시 throw되는 에러 래퍼.
 * 콘솔/토스트에 traceId/spanId를 쓰면 서버 로그에서 전체 플로우와 특정 요청 단계를 찾을 수 있음.
 */
export class ApiRequestError extends Error {
  readonly apiError: ApiError
  readonly requestId: string
  readonly traceId: string
  readonly spanId: string
  readonly traceparent: string

  constructor(apiError: ApiError, traceId: string, spanId: string, traceparent: string) {
    super(`[${apiError.status}] ${apiError.title}${apiError.detail ? ` - ${apiError.detail}` : ''}`)
    this.name = 'ApiRequestError'
    this.apiError = apiError
    this.requestId = traceId
    this.traceId = traceId
    this.spanId = spanId
    this.traceparent = traceparent
  }
}
