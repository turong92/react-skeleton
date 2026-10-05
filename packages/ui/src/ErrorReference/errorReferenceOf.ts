import { ApiRequestError } from '@skeleton/api-client'

/** 문의 · 로그 추적에 쓰는 참조 번호(traceId). API 오류가 아니면 undefined */
export function errorReferenceOf(error: unknown): string | undefined {
  if (!(error instanceof ApiRequestError)) return undefined
  return error.apiError.traceId || error.traceId || undefined
}
