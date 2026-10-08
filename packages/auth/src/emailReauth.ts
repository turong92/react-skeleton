/**
 * 「이메일 등록을 제공자 재동의로 이어 가기」 — 마지막 로그인이 1시간을 넘어 서버가 첫 이메일 등록에 다시 인증(`REAUTH_REQUIRED`)을 요구했을 때,
 * 앱을 덮은 등록 화면에서 계정 설정으로 넘기는 값: 계정 설정이 열리자마자 그 제공자의 동의 화면으로 보낸다(돌아오면 설정의 이메일 구역이 인증번호를 이어 보낸다).
 * **router state 로만** 옮긴다(저장소 · 주소에 넣지 않는다 — 새로고침하면 사라져도 된다).
 */
export type EmailReauth = { provider: string; newEmail: string }

const PROVIDER_CODE = /^[a-z0-9][a-z0-9_-]{0,31}$/i
const MAX_ADDRESS = 254

/** `navigate('/account', { state })` 에 싣는 값 */
export function emailReauthState(provider: string, newEmail: string): { emailReauth: EmailReauth } {
  return { emailReauth: { provider, newEmail } }
}

/** router state 에서 읽는다 — 제공자 코드 모양과 주소 길이가 아니면 없는 것으로 */
export function emailReauthOf(state: unknown): EmailReauth | undefined {
  const value = (state as { emailReauth?: unknown } | null | undefined)?.emailReauth
  if (typeof value !== 'object' || value === null) return undefined
  const { provider, newEmail } = value as Record<string, unknown>
  if (typeof provider !== 'string' || !PROVIDER_CODE.test(provider)) return undefined
  if (typeof newEmail !== 'string' || !newEmail.trim() || newEmail.length > MAX_ADDRESS)
    return undefined
  return { provider, newEmail }
}

/** 「이 계정 지우고 로그인 화면으로」 도 같은 길을 쓴다 - 오래된 세션이라 서버가 `REAUTH_REQUIRED` 를 말했을 때 그 제공자의 동의 화면으로 보내고, 돌아오면 설정이 `discard` 를 이어서 부른다 */
export type DiscardReauth = { provider: string }

export function discardReauthState(provider: string): { discardReauth: DiscardReauth } {
  return { discardReauth: { provider } }
}

export function discardReauthOf(state: unknown): DiscardReauth | undefined {
  const value = (state as { discardReauth?: unknown } | null | undefined)?.discardReauth
  if (typeof value !== 'object' || value === null) return undefined
  const { provider } = value as Record<string, unknown>
  return typeof provider === 'string' && PROVIDER_CODE.test(provider) ? { provider } : undefined
}
