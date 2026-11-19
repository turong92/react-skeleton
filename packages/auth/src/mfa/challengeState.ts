import { safeReturnPath } from '../returnTo'
import { MFA_METHODS, type MfaMethod, type MfaRequired } from './types'

/** 두 번째 단계 화면으로 넘기는 라우터 state - `mfaToken` 은 여기에만 있다(주소 · 저장소에는 두지 않는다) */
export type MfaChallengeState = {
  mfa: MfaRequired
  /** 로그인 뒤 갈 곳(같은 출처 경로) - 없으면 도착 화면이 정한다(소셜은 자기 저장소의 「가려던 곳」) */
  target?: string
  /** 로그인 뒤 목적지로 이어 줄 state(설정의 소셜 연결 이어 가기) */
  arrival?: { linkProvider: string }
}

export function mfaChallengeState(
  mfa: MfaRequired,
  target?: string,
  arrival?: { linkProvider: string },
): { mfaChallenge: MfaChallengeState } {
  return { mfaChallenge: { mfa, ...(target ? { target } : {}), ...(arrival ? { arrival } : {}) } }
}

const methodOf = (value: unknown): value is MfaMethod => MFA_METHODS.includes(value as MfaMethod)

/** 라우터 state 에서 읽는다 - 직접 열었거나 토큰이 없으면 null(1단계부터 다시) */
export function mfaChallengeOf(state: unknown): MfaChallengeState | null {
  const raw = (state as { mfaChallenge?: unknown } | null)?.mfaChallenge
  if (typeof raw !== 'object' || raw === null) return null
  const { mfa, target, arrival } = raw as Record<string, unknown>
  const token = (mfa as { mfaToken?: unknown } | null)?.mfaToken
  if (typeof token !== 'string' || token === '') return null
  const found = mfa as { methods?: unknown; expiresAt?: unknown }
  const methods = Array.isArray(found.methods) ? found.methods.filter(methodOf) : []
  const safeTarget = typeof target === 'string' ? safeReturnPath(target, '') : ''
  const provider = (arrival as { linkProvider?: unknown } | null)?.linkProvider
  return {
    mfa: {
      mfaToken: token,
      methods: methods.length > 0 ? methods : [...MFA_METHODS],
      expiresAt: typeof found.expiresAt === 'string' ? found.expiresAt : null,
    },
    target: safeTarget || undefined,
    arrival: typeof provider === 'string' ? { linkProvider: provider } : undefined,
  }
}
