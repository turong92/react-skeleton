import { createSessionRefresher, type AuthApi, type SessionEndReason } from '@skeleton/auth'
import { authKeys, refreshDelivery } from './authConfig'
import { refreshStore, tokenStore } from './tokenStore'

/** 갱신이 못 되어 로그아웃된 이유 — 앱이 알림으로 말한다(예: `onSessionEnded(reason => toast(...))` 를 `main.tsx` 에서) */
let onEnded: ((reason: SessionEndReason) => void) | undefined
export const onSessionEnded = (listener: (reason: SessionEndReason) => void) => {
  onEnded = listener
}

/** `api` 는 이 훅이 꽂힌 API 클라이언트로 만들어지므로 늦게 잇는다(`session.ts` 가 `bindAuthApi`) */
let authApi: AuthApi | undefined
export const bindAuthApi = (api: AuthApi) => {
  authApi = api
}

/** 401 → 갱신 한 번(single-flight) → 같은 요청 재시도 한 번. 클라이언트의 `recoverUnauthorized` 에 꽂는다 */
export const refresher = createSessionRefresher({
  tokens: tokenStore,
  refreshTokens: refreshStore,
  delivery: refreshDelivery,
  lockName: authKeys.refreshLock,
  refresh: (refreshToken) => {
    if (!authApi) throw new Error('auth api is not bound yet')
    return authApi.refresh(refreshToken)
  },
  onSessionEnded: (reason) => onEnded?.(reason),
})
