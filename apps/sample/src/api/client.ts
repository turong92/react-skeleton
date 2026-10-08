import { chainForbiddenRecovery } from '@skeleton/api-client'
import { createAppApiClient } from './createAppApiClient'
import { refreshDelivery } from '../auth/authConfig'
import { refresher } from '../auth/refresher'
import { emailRequired } from './emailRequired'
import { reconsent } from './reconsent'
import { refreshStore, tokenStore } from '../auth/tokenStore'

/** 앱 전역 API 클라이언트. 훅 · 페이지는 `apiClient.value<T>('/path')` 로 부른다 */
export const apiClient = createAppApiClient({
  env: import.meta.env,
  tokenStore,
  refreshStore,
  recoverUnauthorized: refresher.recover,
  // 막힌 403 은 사용자에게 물어 푼다 → 풀리면 같은 호출을 다시 보낸다. 순서는 서버와 같다: 이메일 등록(ACCOUNT.EMAIL_REQUIRED) → 약관 동의(LEGAL.RECONSENT_REQUIRED)
  recoverForbidden: chainForbiddenRecovery(emailRequired.recover, reconsent.recover),
  withCredentials: refreshDelivery === 'cookie',
  debug: import.meta.env.DEV,
})
