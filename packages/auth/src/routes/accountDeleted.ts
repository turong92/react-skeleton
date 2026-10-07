/**
 * `/account-deleted` 는 열린 라우트라 아무나 열 수 있다 — 탈퇴 흐름이 넘긴 `state.purgeAfter` 가 있을 때만 안내를 보이고 로컬 세션을 지운다.
 * 외부 링크 · 즐겨찾기로 열었으면 로그인한 사람은 홈으로(로그아웃시키지 않는다), 아닌 사람은 로그인 화면으로 보낸다
 */
export function accountDeletedDestination(
  state: unknown,
  authenticated: boolean,
): 'landing' | 'home' | 'signIn' {
  const purgeAfter = (state as { purgeAfter?: unknown } | null | undefined)?.purgeAfter
  if (typeof purgeAfter === 'string') return 'landing'
  return authenticated ? 'home' : 'signIn'
}
