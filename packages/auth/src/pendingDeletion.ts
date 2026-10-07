import { ErrorCodes, isErrorCode, type ApiRequestError } from '@skeleton/api-client'

/**
 * 탈퇴 유예 중인 계정의 로그인 응답(`403 AUTH.ACCOUNT_DELETION_PENDING`) — 로그인 수단이 비밀번호 · 링크 · 소셜 어느 것이든 같다.
 * `restoreToken` 은 서버가 self-restore 를 켰을 때만 온다(없으면 화면은 안내만 한다). **메모리에만 둔다** — 저장소 · 주소에 넣지 않는다(새로고침하면 다시 로그인)
 */
export type DeletionPending = {
  /** 이 시각에 계정 데이터가 지워진다(ISO-8601) — 서버가 안 주면 null */
  purgeAfter: string | null
  restoreToken?: string
  restoreTokenExpiresAt?: string
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

/** `error` 가 탈퇴 대기 응답이면 그 값, 아니면 null */
export function deletionPendingOf(error: unknown): DeletionPending | null {
  if (!isErrorCode(error, ErrorCodes.AUTH_ACCOUNT_DELETION_PENDING)) return null
  const data = (error as ApiRequestError).apiError.data
  const fields = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  const restoreToken = text(fields.restoreToken)
  const restoreTokenExpiresAt = text(fields.restoreTokenExpiresAt)
  return {
    purgeAfter: text(fields.purgeAfter) ?? null,
    ...(restoreToken ? { restoreToken } : {}),
    ...(restoreToken && restoreTokenExpiresAt ? { restoreTokenExpiresAt } : {}),
  }
}
