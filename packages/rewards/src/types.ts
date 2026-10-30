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

export type ReferralMe = {
  code: string
  invited: number
  rewarded: number
  /** 아직 초대받지 않았고 진행 중인 초대 이벤트의 기간 안이라 코드를 직접 입력할 수 있다. 구버전 서버는 칸이 없다 */
  canClaim?: boolean
  /** 직접 입력할 수 있는 마지막 시각 — 정해진 기한이 없으면 null. 구버전 서버는 칸이 없다 */
  claimUntil?: string | null
}

/** 내가 초대한 사람의 상태 — 대기(가입만 함) · 확인 중(보류 · 운영자 확인) · 보상 지급 · 보상 없음(상한 · 취소) */
export type InviteeStatus = 'WAITING' | 'PENDING' | 'REWARDED' | 'NOT_REWARDED'

export type Invitee = {
  /** 가린 이름(`김수***`). 서버에 이름 구현이 없으면 null */
  label: string | null
  status: InviteeStatus
  claimedAt: string
  /** `PENDING` 이면 보상 예정 시각(보류 중일 때만 있다), `REWARDED` 면 보상을 받은 때 */
  rewardAt: string | null
}

/** `POST /referrals/claim` 이 거절된 이유(`data.reason`) + 이벤트 끝남(`CLOSED`) · 그 밖(`OTHER`) */
export type ReferralRejection =
  | 'UNKNOWN_CODE'
  | 'OWN_CODE'
  | 'ALREADY_INVITED'
  | 'MUTUAL'
  | 'NOT_NEW_ACCOUNT'
  | 'CLOSED'
  | 'OTHER'

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
