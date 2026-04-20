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
  timestamp: string
  errors?: FieldError[]
}

export type FieldError = {
  field: string
  code: string
  message?: string
}

/**
 * fetch 실패 시 throw되는 에러 래퍼.
 * 콘솔/토스트에 `error.apiError.traceId`를 쓰면 서버 로그에서 이 traceId로 전체 요청 흐름 찾을 수 있음.
 */
export class ApiRequestError extends Error {
  readonly apiError: ApiError
  readonly requestId: string

  constructor(apiError: ApiError, requestId: string) {
    super(`[${apiError.status}] ${apiError.title}${apiError.detail ? ` - ${apiError.detail}` : ''}`)
    this.name = 'ApiRequestError'
    this.apiError = apiError
    this.requestId = requestId
  }
}
