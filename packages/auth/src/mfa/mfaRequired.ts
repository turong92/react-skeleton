import { isErrorCode, type ApiRequestError } from '@skeleton/api-client'
import { MFA_CODES } from './codes'
import { MFA_METHODS, type MfaMethod, type MfaRequired } from './types'

/**
 * `error` 가 로그인의 두 번째 단계 응답(`403 AUTH.MFA_REQUIRED`)이면 그 값, 아니면 null - 로그인 수단이 비밀번호 · 링크 · 소셜 · 탈퇴 취소 어느 것이든 같다.
 * 이 화면이 못 하는 방법(예: 훗날의 패스키)은 걸러내고, 서버가 방법을 안 주면 둘 다 쓴다. 토큰이 없으면 이어 갈 것이 없어 null
 */
export function mfaRequiredOf(error: unknown): MfaRequired | null {
  if (!isErrorCode(error, MFA_CODES.REQUIRED)) return null
  const data = (error as ApiRequestError).apiError.data
  const fields = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  if (typeof fields.mfaToken !== 'string' || fields.mfaToken === '') return null
  const offered = Array.isArray(fields.methods)
    ? fields.methods.filter((m): m is MfaMethod => MFA_METHODS.includes(m as MfaMethod))
    : []
  return {
    mfaToken: fields.mfaToken,
    methods: offered.length > 0 ? offered : [...MFA_METHODS],
    expiresAt:
      typeof fields.expiresAt === 'string' && fields.expiresAt !== '' ? fields.expiresAt : null,
  }
}
