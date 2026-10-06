import { createAccountApi, createAuthApi, createAuthSession } from '@skeleton/auth'
import { apiClient } from '../api/client'
import { refreshDelivery } from './authConfig'
import { bindAuthApi, refresher } from './refresher'
import { refreshStore, tokenStore } from './tokenStore'

/** 세션 목록에 보일 기기 이름(`X-Device-Name`) — 로그인 · 가입 인증(코드를 맞추면 바로 로그인) 모두 같은 이름 */
const deviceName = typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 80)

export const authApi = createAuthApi(apiClient, { delivery: refreshDelivery })
bindAuthApi(authApi)
export const accountApi = createAccountApi(apiClient, { deviceName })

/** 로그인 · 로그아웃 · 현재 사용자. 화면은 `useAuth()` 로 읽는다 */
export const authSession = createAuthSession({
  api: authApi,
  store: tokenStore,
  refreshStore,
  delivery: refreshDelivery,
  refresher, // restore() 도 갱신 한 줄(single-flight · 탭 락)을 거친다
  deviceName,
})
