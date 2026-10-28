import type { ApiClient } from '@skeleton/api-client'
import { createCampaignApi, type CampaignApi } from './campaign/campaignApi'
import { createCouponApi, type CouponApi } from './coupon/couponApi'
import { createPointApi, type PointApi } from './point/pointApi'

export type RewardsApi = CampaignApi & CouponApi & PointApi

export type RewardsApiPaths = {
  /** 기본 `/campaigns` */
  campaigns?: string
  /** 기본 `/referrals` */
  referrals?: string
  /** 기본 `/coupons` */
  coupons?: string
  /** 기본 `/points` */
  points?: string
}

/**
 * 보상 사용자 HTTP 호출 모음. 경로는 백엔드 modules/campaign · coupon · point 가 여는 것이 기본값이고(`/api/v1` 은 클라이언트의 baseUrl),
 * 일부 모듈만 붙인 앱은 그 갈래의 호출만 쓰면 된다.
 */
export function createRewardsApi(
  client: Pick<ApiClient, 'list' | 'value' | 'noContent' | 'cursor'>,
  paths: RewardsApiPaths = {},
): RewardsApi {
  return {
    ...createCampaignApi(client, { campaigns: paths.campaigns, referrals: paths.referrals }),
    ...createCouponApi(client, { coupons: paths.coupons }),
    ...createPointApi(client, { points: paths.points }),
  }
}
