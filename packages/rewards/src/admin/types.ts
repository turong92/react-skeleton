import type { Coupon, CouponScope, CouponStage, CouponStatus, PointEntry } from '../types'

/** 보상 한 줄 - `type` 은 지급기 이름(`point` · `coupon`), `params` 는 지급기마다 다른 문자열 값 */
export type RewardConfig = { type: string; params: Record<string, string> }

export type AttendanceMilestoneConfig = { days: number; streak: boolean; rewards: RewardConfig[] }

/** 업적 한 단계 - 수치가 `value` 에 닿으면 `rewards` 를 모두 준다 */
export type AchievementStepConfig = { value: number; rewards: RewardConfig[] }

/** 이벤트 설정 - 종류별 칸(C-ADM). 칸이 없으면 화면이 빈 값으로 읽는다 */
export type CampaignConfig = {
  rewards?: RewardConfig[]
  daily?: RewardConfig[]
  /** 출석은 `AttendanceMilestoneConfig`, 업적(`achievement`)은 `AchievementStepConfig` - 종류가 정한다(와이어 키가 같다) */
  milestones?: Array<AttendanceMilestoneConfig | AchievementStepConfig>
  /** 업적: 앱이 `CampaignSignals.report` 로 보고하는 수치 이름(`[a-z0-9._-]{1,64}`) */
  metric?: string
  invitee?: RewardConfig[]
  inviter?: RewardConfig[]
  qualifyOn?: 'CLAIM' | 'SIGNAL'
  /** 초대: 이 이름의 신호만 먹는다(`qualifyOn: SIGNAL` 일 때만, `[a-z0-9._-]{1,64}`) - 없으면 아무 신호나 */
  qualifyEvent?: string
  /** 초대: 신호 뒤 보상까지 붙잡아 두는 일수(0~90, 없으면 0) */
  holdDays?: number
  /** 초대: 초대자와 같은 네트워크에서 가입했으면 운영자 확인을 거친다(없으면 false) */
  reviewSameNetwork?: boolean
  claimWithinDays?: number
  inviterCap?: number | null
}

export type AdminCampaign = {
  id: string
  kind: 'attendance' | 'referral' | 'achievement'
  name: string
  enabled: boolean
  startsAt: string
  /** 끝이 없으면 `null` 이거나 칸이 없다 */
  endsAt?: string | null
  config: CampaignConfig
}

export type CampaignInput = {
  kind: AdminCampaign['kind']
  name: string
  startsAt: string
  endsAt: string | null
  config: CampaignConfig
}
export type CampaignUpdate = Omit<CampaignInput, 'kind'>

export type CouponDefinitionStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

export type CouponDefinition = {
  id: string
  name: string
  status: CouponDefinitionStatus
  stages: CouponStage[]
  currency: string | null
  minAmount: number | null
  scope: CouponScope
  firstPurchaseOnly: boolean
  validDays: number | null
  validUntil: string | null
  /** 사용 시작 - 이 시각 전에는 결제에 쓸 수 없다. `validUntil` 보다 앞이어야 한다 */
  validFrom?: string | null
  /** 발행 기간 - 밖이면 운영자 발급 · 코드 등록 · 보상 지급이 `COUPON.ISSUE_CLOSED`(409). 시작이 끝보다 앞이어야 한다 */
  issueStartsAt?: string | null
  issueEndsAt?: string | null
  issueLimit: number | null
  perAccountLimit: number
  issuedCount: number
}

export type CouponDefinitionInput = Omit<CouponDefinition, 'id' | 'status' | 'issuedCount'>

/** 쿠폰 정의 하나의 현황(`GET /admin/coupon-definitions/{id}/stats`) - 발급한 쿠폰의 상태별 수와, 쓴(USED) 쿠폰이 실제로 깎은 금액 합(통화마다) */
export type CouponStats = {
  issued: number
  available: number
  reserved: number
  used: number
  expired: number
  revoked: number
  discountTotals: Array<{ currency: string; amount: number }>
}

/** 정의 하나에서 발급된 쿠폰 한 장(`GET /admin/coupon-definitions/{id}/coupons`) */
export type IssuedCoupon = {
  id: string
  accountId: string
  /** 사람이 알아볼 계정 이름(이메일, 없으면 아이디). 서버가 낼 수 없으면 없다 - 화면은 `accountId` 를 보인다 */
  accountLabel?: string | null
  status: CouponStatus
  issuedAt: string
  expiresAt: string | null
  usableFrom: string | null
  usedAt: string | null
  /** 이 쿠폰을 쥔(쓴) 주문 */
  orderRef: string | null
}

export type IssuedCouponQuery = { status?: CouponStatus; cursor?: string; size?: number }

/** 계정에 쿠폰 주기의 답 - 줬거나(`issued`) 건너뛴(`skipped`: 한도 · 이미 가짐 …) 계정 id */
export type IssueResult = { issued: string[]; skipped: string[] }

/** 공용 코드 만들기의 답 - 사용자가 「쿠폰 코드」 칸에 넣는 글자 */
export type CouponCode = { code: string }

/** 계정 하나의 포인트 - 잔액과 내역(최신순) */
export type AdminPointAccount = { balance: number; entries: PointEntry[] }

export type PointAdjustment = { delta: number; reason: string; expiresInDays: number | null }

export type RewardGrantStatus = 'PENDING' | 'ISSUED' | 'FAILED' | 'CANCELED'

export type RewardGrant = {
  id: string
  accountId: string
  type: string
  label: string
  status: RewardGrantStatus
  sourceType: string
  lastError: string | null
  createdAt: string
  issuedAt: string | null
}

export type AdminCoupon = Coupon & { accountId?: string }

export type BadgeDefinitionStatus = 'ACTIVE' | 'ARCHIVED'

/** 배지 정의 한 개(운영) - `code` 는 만든 뒤 바꾸지 않는다. `holders` 는 지금 가진 사람 수 */
export type AdminBadge = {
  id: string
  code: string
  name: string
  description: string
  imageUrl: string | null
  hidden: boolean
  sortOrder: number
  status: BadgeDefinitionStatus
  holders: number
  createdAt: string
  updatedAt: string
}

export type BadgeUpdate = {
  name: string
  description: string
  imageUrl: string | null
  hidden: boolean
  sortOrder: number
}
export type BadgeInput = BadgeUpdate & { code: string }

/** 수동 수여의 답 - 새로 준 계정 · 이미 가진 계정 · 없는 계정(수여 안 함) id */
export type BadgeAwardResult = {
  awarded: string[]
  alreadyHeld: string[]
  unknownAccountIds: string[]
}

export type BadgeAwardAction = 'AWARDED' | 'REVOKED'
export type BadgeAwardSource = 'APP' | 'ADMIN' | 'GRANT'

/** 수여 · 회수 내역 한 줄(최신순). 같은 보유 줄(`awardId`)이 회수 뒤 다시 수여되면 같은 `awardId` 가 다시 나온다 */
export type BadgeAwardEvent = {
  id: string
  awardId: string
  badgeId: string
  badgeCode: string | null
  badgeName: string | null
  accountId: string
  /** 사람이 알아볼 계정 이름 - 서버가 낼 수 없으면 없다(화면은 `accountId`) */
  accountLabel?: string | null
  action: BadgeAwardAction
  source: BadgeAwardSource
  sourceRef: string | null
  actorId: string | null
  reason: string | null
  createdAt: string
}

export type BadgeAwardQuery = {
  badgeId?: string
  accountId?: string
  cursor?: string
  size?: number
}

/** 초대 관계의 상태 - 가입함 · 확인 필요 · 보류 중 · 보상 지급 시작 · 상한 초과 · 취소 */
export type ReferralStatus = 'CLAIMED' | 'REVIEW' | 'HELD' | 'QUALIFIED' | 'CAPPED' | 'CANCELED'
/** 판정 때 붙는 표시 - 1차는 `SAME_NETWORK`(초대자와 같은 네트워크) 하나 */
export type ReferralFlag = 'SAME_NETWORK'

/** 운영자가 보는 초대 내역(`GET /admin/referrals`). 이름은 `account.read` 가 없으면 null - 화면은 id 를 보인다 */
export type AdminReferral = {
  inviteeId: string
  inviterId: string
  inviteeLabel: string | null
  inviterLabel: string | null
  campaignId: string
  status: ReferralStatus
  flags: ReferralFlag[]
  qualifyEvent: string | null
  claimedAt: string
  qualifiedAt: string | null
  /** 보류가 풀리는 시각 */
  releaseAt: string | null
  settledAt: string | null
  /** 끝낸 쪽 - 운영자 id · `app` · 자동이면 null */
  settledBy: string | null
  cancelReason: string | null
}

export type AdminReferralQuery = {
  status?: ReferralStatus
  inviterId?: string
  inviteeId?: string
  campaignId?: string
  flag?: ReferralFlag
  cursor?: string
  size?: number
}
