import { expiryMillis } from '@skeleton/ui'

/**
 * 인증번호의 「유효 창」 — 언제 만료되고 언제 다시 받을 수 있는가(둘 다 서버 시각 기준 절대 시각, 에포크 ms).
 * `source: 'server'` 는 응답이 준 값, `'estimate'` 는 문서화된 유효 시간으로 **클라이언트가 어림한 값**이다.
 */
export type CodeWindow = {
  expiresAt: number
  resendAvailableAt?: number
  source: 'server' | 'estimate'
}

/**
 * 응답 본문에서 서버가 준 만료 · 재요청 가능 시각을 읽는다. 최신 백엔드는 코드를 보내는 응답에 `expiresAt` · `resendAvailableAt`(ISO-8601)을 준다 —
 * 없으면(옛 서버) null 이고 호출자가 `estimateCodeWindow` 로 문서화된 유효 시간으로 어림한다. 서버 값이 있으면 항상 그것이 이긴다.
 */
export function codeWindowOf(response: unknown): CodeWindow | null {
  if (typeof response !== 'object' || response === null) return null
  const { expiresAt, resendAvailableAt } = response as Record<string, unknown>
  const expires =
    typeof expiresAt === 'string' || typeof expiresAt === 'number' ? expiryMillis(expiresAt) : null
  if (expires === null) return null
  const resend =
    typeof resendAvailableAt === 'string' || typeof resendAvailableAt === 'number'
      ? expiryMillis(resendAvailableAt)
      : null
  return {
    expiresAt: expires,
    ...(resend === null ? {} : { resendAvailableAt: resend }),
    source: 'server',
  }
}

/** 서버가 시각을 안 줄 때의 어림 — `nowMs`(서버 보정 시계)부터 문서화된 유효 시간 · 쿨다운을 센다. 늘 `source: 'estimate'` */
export function estimateCodeWindow(
  nowMs: number,
  { ttlSeconds, cooldownSeconds }: { ttlSeconds: number; cooldownSeconds?: number },
): CodeWindow {
  return {
    expiresAt: nowMs + ttlSeconds * 1000,
    ...(cooldownSeconds === undefined ? {} : { resendAvailableAt: nowMs + cooldownSeconds * 1000 }),
    source: 'estimate',
  }
}
