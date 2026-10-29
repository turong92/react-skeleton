/** 백엔드 모듈이 선언한 운영 권한(기본 역할 없음 - 전권만) */
export const REWARDS_PERMISSIONS = {
  badge: 'badge.manage',
  campaign: 'campaign.manage',
  coupon: 'coupon.manage',
  point: 'point.manage',
  reward: 'reward.operate',
} as const

/** 부품이 받는 권한 질문 - 주지 않으면 모두 true. 서버가 다시 판정하니 화면은 단추를 숨길 뿐이다 */
export type CanFn = (key: string) => boolean
export const allowAll: CanFn = () => true
