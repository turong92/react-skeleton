import {
  createAccountApi,
  createAuthApi,
  createAuthSession,
  createMfaApi,
  createWebHandoffApi,
} from '@skeleton/auth'
import { apiClient } from '../api/client'
import { refreshDelivery } from './authConfig'
import { bindAuthApi, refresher } from './refresher'
import { refreshStore, tokenStore } from './tokenStore'

/** 세션 목록에 보일 기기 이름(`X-Device-Name`) — 로그인 · 가입 인증(코드를 맞추면 바로 로그인) 모두 같은 이름 */
const deviceName = typeof navigator === 'undefined' ? undefined : navigator.userAgent.slice(0, 80)

export const authApi = createAuthApi(apiClient, { delivery: refreshDelivery })
bindAuthApi(authApi)
export const accountApi = createAccountApi(apiClient, { deviceName })
/** 2단계 인증 설정(`/auth/mfa`) - 계정 설정의 줄과 「2단계 인증을 켜 주세요」 화면이 같이 쓴다 */
export const mfaApi = createMfaApi(apiClient)
/** 앱의 「웹 결제」로 넘어온 사람의 한 번 쓰는 코드 교환(`#handoff=`) - `AppFrame` 의 문지기가 쓴다 */
export const webHandoffApi = createWebHandoffApi(apiClient)

/** 로그인 · 로그아웃 · 현재 사용자. 화면은 `useAuth()` 로 읽는다 */
export const authSession = createAuthSession({
  api: authApi,
  store: tokenStore,
  refreshStore,
  delivery: refreshDelivery,
  refresher, // restore() 도 갱신 한 줄(single-flight · 탭 락)을 거친다
  deviceName,
})
