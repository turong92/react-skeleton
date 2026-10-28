/** 사용자 API 응답 꼴 — 백엔드 modules/campaign · coupon · point 의 사용자 HTTP 계약(C-R) */

export type CampaignKind = 'attendance' | 'referral'

export type Milestone = { days: number; streak: boolean }

export type AttendanceSummary = {
  checkedToday: boolean
  total: number
  streak: number
  nextMilestone: Milestone | null
  /** 서버가 보는 오늘(서비스 시간대의 날짜) */
  today: string
}

export type Campaign = {
  id: string
  kind: CampaignKind
  name: string
  startsAt: string
  /** 끝이 없으면 `null` 이거나 칸이 없다 */
  endsAt?: string | null
  attendance?: AttendanceSummary
}

export type RewardLine = { type: string; label: string }

export type CheckInResult = {
  alreadyChecked: boolean
  total: number
  streak: number
  rewards: RewardLine[]
}

export type AttendanceMonth = { days: string[] }

export type ReferralMe = { code: string; invited: number; rewarded: number }

export type CouponStageType = 'FREE' | 'PERCENT' | 'FIXED'

/** 혜택 단계 — `periods` 가 null 이면 영원히 */
export type CouponStage = {
  type: CouponStageType
  value: number
  maxDiscount: number | null
  periods: number | null
}

export type CouponStatus = 'AVAILABLE' | 'RESERVED' | 'USED' | 'EXPIRED' | 'REVOKED'
/** 목록 탭 — `AVAILABLE` 은 쓸 수 있는 것, `PAST` 는 쓴 · 끝난 것 */
export type CouponTab = 'AVAILABLE' | 'PAST'

export type CouponScope = {
  purposes: string[]
  itemTypes: string[]
  /** 서버가 주는 칸 - 구버전에는 없다 */
  itemRefs?: string[]
  planCodes: string[]
}

export type Coupon = {
  id: string
  name: string
  status: CouponStatus
  expiresAt: string | null
  /** 이 시각 전에는 쓸 수 없다(사용 시작) - 없으면 바로 쓴다. 구버전 서버는 칸이 없다 */
  usableFrom?: string | null
  stages: CouponStage[]
  scope: CouponScope
  currency: string | null
  minAmount: number | null
}

export type PointBalanceValue = {
  balance: number
  expiringSoon: { amount: number; before: string } | null
}

export type PointEntryKind = 'EARN' | 'SPEND' | 'EXPIRE' | 'ADJUST'

export type PointEntry = {
  id: string
  delta: number
  kind: PointEntryKind
  reason: string | null
  expiresAt: string | null
  createdAt: string
}

/** 결제 견적의 앞뒤 금액 — 결제 패키지를 import 하지 않고 앱이 견적 응답에서 이 꼴로 옮겨 준다 */
export type QuotePreview = { originalAmount: number; amount: number; currency: string }
