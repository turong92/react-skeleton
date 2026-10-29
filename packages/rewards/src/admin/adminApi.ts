import type { ApiClient, ApiCursorResponse } from '@skeleton/api-client'
import type { PointEntry } from '../types'
import type {
  AdminCampaign,
  AdminBadge,
  AdminCoupon,
  BadgeAwardEvent,
  BadgeAwardQuery,
  BadgeAwardResult,
  BadgeDefinitionStatus,
  BadgeInput,
  BadgeUpdate,
  AdminPointAccount,
  CampaignInput,
  CampaignUpdate,
  CouponCode,
  CouponDefinition,
  CouponDefinitionInput,
  CouponDefinitionStatus,
  CouponStats,
  IssueResult,
  IssuedCoupon,
  IssuedCouponQuery,
  PointAdjustment,
  RewardGrant,
  RewardGrantStatus,
} from './types'

export type RewardsAdminApi = {
  /** `GET /admin/campaigns` (`campaign.manage`) */
  listCampaigns(): Promise<AdminCampaign[]>
  createCampaign(input: CampaignInput): Promise<AdminCampaign>
  /** `PUT /admin/campaigns/{id}` - 종류는 못 바꾼다 */
  updateCampaign(id: string, input: CampaignUpdate): Promise<AdminCampaign>
  /** `PATCH /admin/campaigns/{id}/enabled` */
  setCampaignEnabled(id: string, enabled: boolean): Promise<AdminCampaign>
  /** `GET /admin/badges` (`badge.manage`) - 보유자 수 포함 */
  listBadges(): Promise<AdminBadge[]>
  createBadge(input: BadgeInput): Promise<AdminBadge>
  /** `PUT /admin/badges/{id}` - `code` 는 못 바꾼다 */
  updateBadge(id: string, input: BadgeUpdate): Promise<AdminBadge>
  /** `PATCH /admin/badges/{id}/status` - 보관 / 되살리기 */
  setBadgeStatus(id: string, status: BadgeDefinitionStatus): Promise<AdminBadge>
  /** `POST /admin/badges/{id}/awards {accountIds(≤100), reason}` */
  awardBadge(
    id: string,
    input: { accountIds: string[]; reason?: string },
  ): Promise<BadgeAwardResult>
  /** `POST /admin/badge-awards/{awardId}/revoke {reason}` - 사유 필수 */
  revokeBadgeAward(awardId: string, reason: string): Promise<{ awardId: string }>
  /** `GET /admin/badge-awards?badgeId&accountId&cursor&size` - 수여 · 회수 내역(최신순 커서) */
  listBadgeAwards(query?: BadgeAwardQuery): Promise<ApiCursorResponse<BadgeAwardEvent>>
  /** `GET /admin/coupon-definitions` (`coupon.manage`) */
  listCouponDefinitions(): Promise<CouponDefinition[]>
  createCouponDefinition(input: CouponDefinitionInput): Promise<CouponDefinition>
  /** `PATCH /admin/coupon-definitions/{id}/status` */
  setCouponDefinitionStatus(id: string, status: CouponDefinitionStatus): Promise<CouponDefinition>
  /** `GET /admin/coupon-definitions/{id}/stats` - 현황 */
  couponStats(id: string): Promise<CouponStats>
  /** `GET /admin/coupon-definitions/{id}/coupons?status&cursor&size` - 이 정의로 발급된 쿠폰(커서) */
  listDefinitionCoupons(
    id: string,
    query?: IssuedCouponQuery,
  ): Promise<ApiCursorResponse<IssuedCoupon>>
  /** `POST /admin/coupon-definitions/{id}/issue {accountIds}` */
  issueCoupons(id: string, accountIds: string[]): Promise<IssueResult>
  /** `POST /admin/coupon-definitions/{id}/codes` - 공용 코드 */
  createCouponCode(id: string): Promise<CouponCode>
  /** `GET /admin/coupons?accountId` */
  listAccountCoupons(accountId: string): Promise<AdminCoupon[]>
  /** `POST /admin/coupons/{id}/revoke` - 쓸 수 있는(AVAILABLE) 쿠폰만 */
  revokeCoupon(id: string): Promise<AdminCoupon>
  /** `GET /admin/points/{accountId}` (`point.manage`) - 잔액과 내역 */
  accountPoints(accountId: string): Promise<AdminPointAccount>
  /** `POST /admin/points/{accountId}/adjustments` → 201 내역 줄 · 409 `POINT.INSUFFICIENT` */
  adjustPoints(accountId: string, input: PointAdjustment): Promise<PointEntry>
  /** `GET /admin/reward-grants?status` (`reward.operate`) */
  listRewardGrants(status?: RewardGrantStatus): Promise<RewardGrant[]>
  /** `POST /admin/reward-grants/{id}/retry` - 실패한 지급 건을 다시 */
  retryRewardGrant(id: string): Promise<RewardGrant>
  /** `POST /admin/reward-grants/{id}/cancel` - 지급 전(PENDING)만 */
  cancelRewardGrant(id: string): Promise<RewardGrant>
}

/** 운영 화면이 부르는 호출 모음. 각 모듈이 `skeleton.<module>.admin.enabled=true` 일 때만 열린다(꺼져 있으면 404) */
export function createRewardsAdminApi(
  client: Pick<ApiClient, 'list' | 'value' | 'cursor'>,
  { basePath = '/admin' }: { basePath?: string } = {},
): RewardsAdminApi {
  const base = basePath.replace(/\/+$/, '')
  const enc = encodeURIComponent
  const post = <T>(path: string, json?: unknown) =>
    client.value<T>(path, { method: 'POST', ...(json !== undefined ? { json } : {}) })
  return {
    listCampaigns: () => client.list<AdminCampaign>(`${base}/campaigns`),
    createCampaign: (input) => post<AdminCampaign>(`${base}/campaigns`, input),
    updateCampaign: (id, input) =>
      client.value<AdminCampaign>(`${base}/campaigns/${enc(id)}`, { method: 'PUT', json: input }),
    setCampaignEnabled: (id, enabled) =>
      client.value<AdminCampaign>(`${base}/campaigns/${enc(id)}/enabled`, {
        method: 'PATCH',
        json: { enabled },
      }),
    listBadges: () => client.list<AdminBadge>(`${base}/badges`),
    createBadge: (input) => post<AdminBadge>(`${base}/badges`, input),
    updateBadge: (id, input) =>
      client.value<AdminBadge>(`${base}/badges/${enc(id)}`, { method: 'PUT', json: input }),
    setBadgeStatus: (id, status) =>
      client.value<AdminBadge>(`${base}/badges/${enc(id)}/status`, {
        method: 'PATCH',
        json: { status },
      }),
    awardBadge: (id, input) => post<BadgeAwardResult>(`${base}/badges/${enc(id)}/awards`, input),
    revokeBadgeAward: (awardId, reason) =>
      post<{ awardId: string }>(`${base}/badge-awards/${enc(awardId)}/revoke`, { reason }),
    listBadgeAwards: ({ badgeId, accountId, cursor, size } = {}) =>
      client.cursor<BadgeAwardEvent>(`${base}/badge-awards`, {
        params: {
          ...(badgeId !== undefined ? { badgeId } : {}),
          ...(accountId !== undefined ? { accountId } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      }),
    listCouponDefinitions: () => client.list<CouponDefinition>(`${base}/coupon-definitions`),
    createCouponDefinition: (input) => post<CouponDefinition>(`${base}/coupon-definitions`, input),
    setCouponDefinitionStatus: (id, status) =>
      client.value<CouponDefinition>(`${base}/coupon-definitions/${enc(id)}/status`, {
        method: 'PATCH',
        json: { status },
      }),
    couponStats: (id) => client.value<CouponStats>(`${base}/coupon-definitions/${enc(id)}/stats`),
    listDefinitionCoupons: (id, { status, cursor, size } = {}) =>
      client.cursor<IssuedCoupon>(`${base}/coupon-definitions/${enc(id)}/coupons`, {
        params: {
          ...(status !== undefined ? { status } : {}),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      }),
    issueCoupons: (id, accountIds) =>
      post<IssueResult>(`${base}/coupon-definitions/${enc(id)}/issue`, { accountIds }),
    createCouponCode: (id) => post<CouponCode>(`${base}/coupon-definitions/${enc(id)}/codes`),
    listAccountCoupons: (accountId) =>
      client.list<AdminCoupon>(`${base}/coupons`, { params: { accountId } }),
    revokeCoupon: (id) => post<AdminCoupon>(`${base}/coupons/${enc(id)}/revoke`),
    accountPoints: (accountId) =>
      client.value<AdminPointAccount>(`${base}/points/${enc(accountId)}`),
    adjustPoints: (accountId, input) =>
      post<PointEntry>(`${base}/points/${enc(accountId)}/adjustments`, input),
    listRewardGrants: (status) =>
      client.list<RewardGrant>(`${base}/reward-grants`, {
        params: status === undefined ? {} : { status },
      }),
    retryRewardGrant: (id) => post<RewardGrant>(`${base}/reward-grants/${enc(id)}/retry`),
    cancelRewardGrant: (id) => post<RewardGrant>(`${base}/reward-grants/${enc(id)}/cancel`),
  }
}
