/**
 * 「소셜 연결을 이어서 하려던」 의도 — 같은 이메일의 계정이 있어 소셜 로그인이 거절됐을 때(`409 ACCOUNT.SOCIAL_EMAIL_CONFLICT`)
 * 로그인 화면 → 계정 설정의 로그인 수단 구역으로 넘기는 값. **router state 로만** 옮긴다(저장소 · 주소 쿼리에 넣지 않는다 — 새로고침하면 사라져도 된다).
 * 돌아갈 곳은 로그인 화면이 이미 읽는 `state.from` 관례를 그대로 쓰므로 `postSignInTarget` 의 같은 출처 검사를 거친다(열린 리다이렉트 없음).
 */
export type LinkIntent = { provider: string }

/** 화면에 그리거나 비교하는 값이므로 제공자 코드 모양(`google` · `acme-sso`)만 믿는다 */
const PROVIDER_CODE = /^[a-z0-9][a-z0-9_-]{0,31}$/i

/** 로그인 화면으로 보낼 state — `from` 은 로그인 뒤 갈 구역, `linkProvider` 는 어느 제공자를 연결하려 했는지(모르면 없다) */
export function linkIntentState(
  provider: string | undefined,
  from: { pathname: string; hash?: string },
): { from: { pathname: string; hash?: string }; linkProvider?: string } {
  return { from, ...(provider ? { linkProvider: provider } : {}) }
}

/** router state 에서 의도를 읽는다 — 제공자 코드 모양이 아니면 없는 것으로 */
export function linkIntentOf(state: unknown): LinkIntent | undefined {
  const value = (state as { linkProvider?: unknown } | null | undefined)?.linkProvider
  return typeof value === 'string' && PROVIDER_CODE.test(value) ? { provider: value } : undefined
}
