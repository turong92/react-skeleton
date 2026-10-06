import { ErrorCodes, isErrorCode } from '@skeleton/api-client'

/**
 * 운영자 호출이 403 으로 거절됐다 — 백엔드는 매 호출마다 저장된 계정이 아직 활성 관리자인지 다시 본다(정지 · 강등된 관리자는 토큰이 살아 있어도 거절).
 * 세션 문제가 아니라 권한 문제이므로 로그아웃하지 않고(`401` 만 갱신 · 로그아웃) 「접근 차단」 안내를 보인다.
 */
export function adminBlocked(error: unknown): boolean {
  return isErrorCode(error, ErrorCodes.COMMON_FORBIDDEN)
}
