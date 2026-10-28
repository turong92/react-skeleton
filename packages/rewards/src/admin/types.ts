import type { Coupon, CouponScope, CouponStage, PointEntry } from '../types'

/** 보상 한 줄 - `type` 은 지급기 이름(`point` · `coupon`), `params` 는 지급기마다 다른 문자열 값 */
export type RewardConfig = { type: string; params: Record<string, string> }

export type AttendanceMilestoneConfig = { days: number; streak: boolean; rewards: RewardConfig[] }

/** 이벤트 설정 - 종류별 칸(C-ADM). 칸이 없으면 화면이 빈 값으로 읽는다 */
export type CampaignConfig = {
  rewards?: RewardConfig[]
  daily?: RewardConfig[]
  milestones?: AttendanceMilestoneConfig[]
  invitee?: RewardConfig[]
  inviter?: RewardConfig[]
  qualifyOn?: 'CLAIM' | 'SIGNAL'
  claimWithinDays?: number
  inviterCap?: number | null
}

export type AdminCampaign = {
  id: string
  kind: 'attendance' | 'referral'
  name: string
  enabled: boolean
  startsAt: string
  endsAt: string | null
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
  issueLimit: number | null
  perAccountLimit: number
  issuedCount: number
}

export type CouponDefinitionInput = Omit<CouponDefinition, 'id' | 'status' | 'issuedCount'>

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
