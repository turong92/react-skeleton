import { createRewardsApi } from '@skeleton/rewards'
import { createRewardsAdminApi } from '@skeleton/rewards/admin'
import { apiClient } from '../api/client'

/**
 * 보상 사용자 호출 - 백엔드 `campaign` · `coupon` · `point` 모듈이 여는 `/api/v1/campaigns` · `/referrals` · `/coupons` · `/points`.
 * 붙인 모듈만 열린다(안 붙인 갈래는 그 카드만 「불러오지 못했어요」)
 */
export const rewardsApi = createRewardsApi(apiClient)

/** 운영 호출 - 각 모듈의 `skeleton.<module>.admin.enabled=true`(이 앱은 켠다) + 권한 `campaign.manage` · `coupon.manage` · `point.manage` · `reward.operate`, 경로 `/api/v1/admin/...` */
export const rewardsAdminApi = createRewardsAdminApi(apiClient)
