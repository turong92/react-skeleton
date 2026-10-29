import type { ApiClient } from '@skeleton/api-client'
import type { MyBadges, PublicBadge } from './types'

export type BadgeApi = {
  /** `GET {badges}/me` — 받은 것 · 아직인 것(로그인) */
  myBadges(): Promise<MyBadges>
  /** `PATCH {badges}/me/{awardId} {visible}` — 프로필에 보일지(본인만) */
  setBadgeVisible(awardId: string, visible: boolean): Promise<{ awardId: string; visible: boolean }>
  /** `GET {badges}/accounts/{accountId}` — 로그인 없이 읽는 공개 프로필 배지. 없는 계정도 빈 목록 */
  profileBadges(accountId: string): Promise<PublicBadge[]>
}

/** 배지 사용자 HTTP. 포인트 · 쿠폰 호출과 섞이지 않는 따로 선 갈래다(앱이 필요한 것만 조립한다) */
export function createBadgeApi(
  client: Pick<ApiClient, 'value'>,
  { badges = '/badges' }: { badges?: string } = {},
): BadgeApi {
  const base = badges.replace(/\/+$/, '')
  return {
    myBadges: () => client.value<MyBadges>(`${base}/me`),
    setBadgeVisible: (awardId, visible) =>
      client.value(`${base}/me/${encodeURIComponent(awardId)}`, {
        method: 'PATCH',
        json: { visible },
      }),
    profileBadges: async (accountId) =>
      (
        await client.value<{ badges: PublicBadge[] }>(
          `${base}/accounts/${encodeURIComponent(accountId)}`,
          // 공개 경로 — 만료된 토큰이 갱신 소동을 일으키지 않게 인증 헤더를 붙이지 않는다
          { skipAuth: true },
        )
      ).badges,
  }
}
