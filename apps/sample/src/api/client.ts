import { createAppApiClient } from './createAppApiClient'
import { tokenStore } from '../auth/tokenStore'

/** 앱 전역 API 클라이언트. 훅 · 페이지는 `apiClient.value<T>('/path')` 로 부른다 */
export const apiClient = createAppApiClient({
  env: import.meta.env,
  tokenStore,
  debug: import.meta.env.DEV,
})
