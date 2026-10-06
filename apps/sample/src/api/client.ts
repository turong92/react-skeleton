import { createAppApiClient } from './createAppApiClient'
import { refreshDelivery } from '../auth/authConfig'
import { refresher } from '../auth/refresher'
import { reconsent } from './reconsent'
import { refreshStore, tokenStore } from '../auth/tokenStore'

/** 앱 전역 API 클라이언트. 훅 · 페이지는 `apiClient.value<T>('/path')` 로 부른다 */
export const apiClient = createAppApiClient({
  env: import.meta.env,
  tokenStore,
  refreshStore,
  recoverUnauthorized: refresher.recover,
  recoverForbidden: reconsent.recover, // 403 LEGAL.RECONSENT_REQUIRED → 동의 화면 → 막힌 호출을 다시 보낸다
  withCredentials: refreshDelivery === 'cookie',
  debug: import.meta.env.DEV,
})
