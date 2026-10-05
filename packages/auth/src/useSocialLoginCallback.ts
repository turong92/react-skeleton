import { useEffect, useState } from 'react'
import type { SocialLoginFlow } from './social'
import type { AuthTokenResponse } from './types'

export type SocialCallbackState =
  | { status: 'pending' }
  | { status: 'success'; provider: string; token: AuthTokenResponse }
  | { status: 'error'; error: unknown }

/**
 * 콜백 페이지(`/auth/callback`)에서 한 번 부른다 — `flow.complete(search)` 를 마운트 때 실행하고 결과를 상태로 돌려준다.
 * 시작 상태가 `pending` 이다(이 훅은 콜백 페이지에서만 쓴다). StrictMode 의 이중 실행에도 로그인은 한 번(`flow` 가 막는다).
 * 성공 뒤 이동은 호출자가(`status === 'success'` 일 때 `navigate`).
 */
export function useSocialLoginCallback(flow: SocialLoginFlow, search: string): SocialCallbackState {
  const [state, setState] = useState<SocialCallbackState>({ status: 'pending' })
  useEffect(() => {
    let active = true
    flow.complete(search).then(
      ({ provider, token }) => active && setState({ status: 'success', provider, token }),
      (error: unknown) => active && setState({ status: 'error', error }),
    )
    return () => {
      active = false
    }
  }, [flow, search])
  return state
}
