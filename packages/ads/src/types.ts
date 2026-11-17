/** `POST …/sessions` 의 200 `value` (스펙 API 계약) */
export type WebRewardedSession = { sessionId: string; purpose: string; expiresAt: string }

/**
 * `POST …/sessions/{id}/grant` 의 200 `value`. `reward-type` 을 정한 서버는 `reward` 만, 정하지 않은 서버(토큰 모드)는
 * `reward: null` + 1회용 `token` · `tokenExpiresAt` 을 준다.
 */
export type WebRewardedGrant = {
  sessionId: string
  purpose: string
  grantedAt: string
  reward: { type: string; ref: string } | null
  token: string | null
  tokenExpiresAt: string | null
}

export type WebRewardedApi = {
  /** `POST {basePath}/sessions` — 광고를 띄우기 전에. 하루 상한이 찼으면 409 `ADS_WEB_REWARDED.DAILY_LIMIT` */
  openSession(purpose: string): Promise<WebRewardedSession>
  /** `POST {basePath}/sessions/{sessionId}/grant` — `rewardedSlotGranted` 뒤에, 세션 하나에 한 번 */
  grant(sessionId: string): Promise<WebRewardedGrant>
}
