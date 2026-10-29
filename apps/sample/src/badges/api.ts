import { createBadgeApi } from '@skeleton/rewards/badge'
import { apiClient } from '../api/client'

/**
 * 배지 호출 - 백엔드 `badge` 모듈이 여는 `/api/v1/badges`. 포인트 · 쿠폰 호출(`rewards/api.ts`)과는 서로 모르는 따로 선 갈래다.
 * 프로필 줄(`/badges/accounts/{id}`)은 로그인 없이 읽는다
 */
export const badgeApi = createBadgeApi(apiClient)
