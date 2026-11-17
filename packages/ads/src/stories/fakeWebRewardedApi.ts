import type { WebRewardedApi } from '../types'

/** 스토리용 가짜 서버 — 세션을 열고 보상 요청에 포인트 지급을 돌려준다(네트워크 없음) */
export function createFakeWebRewardedApi(): WebRewardedApi {
  return {
    openSession: (purpose) =>
      Promise.resolve({ sessionId: 'wrs_story', purpose, expiresAt: '2026-11-18T03:15:00Z' }),
    grant: (sessionId) =>
      Promise.resolve({
        sessionId,
        purpose: 'unlock-episode',
        grantedAt: '2026-11-18T03:00:31Z',
        reward: { type: 'point', ref: 'pt_story' },
        token: null,
        tokenExpiresAt: null,
      }),
  }
}
