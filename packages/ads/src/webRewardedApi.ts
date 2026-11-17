import type { ApiClient } from '@skeleton/api-client'
import type { WebRewardedApi, WebRewardedGrant, WebRewardedSession } from './types'

export type WebRewardedApiOptions = {
  /** 모듈 경로(기본 `/ads/web-rewarded`, `/api/v1` 은 클라이언트의 baseUrl). 모듈이 막힌 앱이 자기 컨트롤러를 다른 경로로 열었을 때 바꾼다 */
  basePath?: string
}

/** 웹 보상형 광고 세션 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createWebRewardedApi(
  client: Pick<ApiClient, 'value'>,
  { basePath = '/ads/web-rewarded' }: WebRewardedApiOptions = {},
): WebRewardedApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    openSession: (purpose) =>
      client.value<WebRewardedSession>(`${base}/sessions`, { method: 'POST', json: { purpose } }),
    grant: (sessionId) =>
      client.value<WebRewardedGrant>(`${base}/sessions/${encodeURIComponent(sessionId)}/grant`, {
        method: 'POST',
      }),
  }
}
