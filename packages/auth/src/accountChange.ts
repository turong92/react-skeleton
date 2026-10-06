import type { AuthSession } from './session'
import type { AuthState } from './types'

export type AccountChange = {
  /** 떠난(바뀐) 계정 id */
  from: string
  /** 새 계정 id. 로그아웃이면 null */
  to: string | null
}

/** 로그인한 계정의 열쇠 — 익명이면 null, principal 을 못 읽는 불투명 토큰이면 고정 표식(토큰이 갱신돼도 같은 계정으로 본다) */
export function accountKeyOf(state: AuthState): string | null {
  if (state.status !== 'authenticated') return null
  return state.principal?.accountId ?? '(unknown)'
}

/**
 * 로그인한 계정이 **사라지거나 다른 계정으로 바뀔 때마다** 부른다(`A → 없음` 로그아웃 · 다른 탭의 로그아웃 · 401 처리기 · `A → B` 다른 계정의 링크 · 소셜 로그인).
 * 처음 로그인(없음 → A)과 같은 계정의 토큰 갱신은 부르지 않는다. 앱은 여기서 서버 상태 캐시를 비운다:
 * `onAccountChange(session, () => queryClient.clear())` — 다음 사람에게 이전 사람의 데이터가 보이지 않게. 해제 함수를 돌려준다.
 */
export function onAccountChange(
  session: Pick<AuthSession, 'getState' | 'subscribe'>,
  listener: (change: AccountChange) => void,
): () => void {
  let current = accountKeyOf(session.getState())
  return session.subscribe(() => {
    const next = accountKeyOf(session.getState())
    if (next === current) return
    const from = current
    current = next
    if (from !== null) listener({ from, to: next })
  })
}
