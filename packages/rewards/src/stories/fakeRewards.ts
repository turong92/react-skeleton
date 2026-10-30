import { ApiRequestError } from '@skeleton/api-client'
import type { BadgeApi } from '../badge/badgeApi'
import type { EarnedBadge, LockedBadge, PublicBadge } from '../badge/types'
import type { RewardsApi } from '../rewardsApi'
import type { Campaign, Coupon, Invitee, PointEntry } from '../types'

/** 스토리 · 시험용 메모리 안의 가짜 보상 API(C-R 꼴). 코드: SPRING 성공 · BAD 맞지 않음 · USED 이미 씀 · EMPTY 소진 */

export const fail = (status: number, code: string, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, data } as never, 'trace', 'span', 'parent')

const attendanceCampaign = (over: Partial<NonNullable<Campaign['attendance']>> = {}): Campaign => ({
  id: 'att',
  kind: 'attendance',
  name: '10월 출석 이벤트',
  startsAt: '2026-10-01T00:00:00Z',
  endsAt: '2026-10-31T14:59:59Z',
  attendance: {
    checkedToday: false,
    total: 6,
    streak: 3,
    nextMilestone: { days: 7, streak: true },
    today: '2026-10-28',
    ...over,
  },
})

const coupon = (over: Partial<Coupon> & Pick<Coupon, 'id' | 'name'>): Coupon => ({
  status: 'AVAILABLE',
  expiresAt: '2026-12-31T14:59:59Z',
  stages: [{ type: 'PERCENT', value: 30, maxDiscount: 5000, periods: 1 }],
  scope: { purposes: [], itemTypes: [], planCodes: [] },
  currency: 'KRW',
  minAmount: null,
  ...over,
})

export const sampleCoupons: Coupon[] = [
  coupon({ id: 'c1', name: '가입 환영 쿠폰' }),
  coupon({
    id: 'c2',
    name: '첫 달 무료 후 반값',
    stages: [
      { type: 'FREE', value: 0, maxDiscount: null, periods: 1 },
      { type: 'PERCENT', value: 50, maxDiscount: null, periods: 3 },
    ],
    expiresAt: null,
  }),
  coupon({
    id: 'c3',
    name: '1만원 이상 천원 할인',
    stages: [{ type: 'FIXED', value: 1000, maxDiscount: null, periods: 1 }],
    minAmount: 10000,
  }),
]

const pastCoupons: Coupon[] = [
  coupon({
    id: 'p1',
    name: '지난 가을 쿠폰',
    status: 'EXPIRED',
    expiresAt: '2026-09-30T14:59:59Z',
  }),
  coupon({ id: 'p2', name: '친구 초대 쿠폰', status: 'USED' }),
]

const history = (count: number): PointEntry[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `h${i}`,
    delta: i % 3 === 2 ? -300 : 100 * (i + 1),
    kind: i % 3 === 2 ? 'SPEND' : 'EARN',
    reason: i % 3 === 2 ? '결제에 사용' : '출석 보상',
    expiresAt: i % 3 === 2 ? null : '2027-10-28T14:59:59Z',
    createdAt: new Date(Date.UTC(2026, 9, 28 - i, 3)).toISOString(),
  }))

/** 초대 현황 — 상태 넷, 가린 이름이 없는(null) 줄 하나. 새것부터 */
export const sampleInvitees: Invitee[] = [
  {
    label: '김수***',
    status: 'REWARDED',
    claimedAt: '2026-10-25T03:00:00Z',
    rewardAt: '2026-10-26T03:00:00Z',
  },
  {
    label: null,
    status: 'PENDING',
    claimedAt: '2026-10-24T03:00:00Z',
    rewardAt: '2026-10-31T03:00:00Z',
  },
  { label: 'lee***', status: 'WAITING', claimedAt: '2026-10-23T03:00:00Z', rewardAt: null },
  { label: 'pa***', status: 'NOT_REWARDED', claimedAt: '2026-10-22T03:00:00Z', rewardAt: null },
  { label: 'ch***', status: 'PENDING', claimedAt: '2026-10-21T03:00:00Z', rewardAt: null },
]

export type FakeRewardsOptions = {
  /** 직접 입력을 받을 수 있는 계정(`canClaim`) — 코드 BAD 계열은 거절: OWN · NOPE · DUP · MUTUAL · OLD · ENDED */
  canClaim?: boolean
  /** 초대 현황이 비어 있다 */
  emptyInvitees?: boolean
  /** 초대 현황 쪽 크기(기본 3) — 전체 5건 */
  inviteePageSize?: number
  /** 출석 이벤트가 이미 오늘 출석한 상태로 시작 */
  checkedToday?: boolean
  /** 출석하면 409 `CAMPAIGN.NOT_ACTIVE` */
  ended?: boolean
  emptyCoupons?: boolean
  emptyPoints?: boolean
  /** 사용 시작 전인 쿠폰 한 장을 더한다 */
  notYetUsable?: boolean
  /** 포인트 내역 쪽 크기(기본 4) — 전체 7건 */
  pageSize?: number
}

export function createFakeRewards({
  checkedToday = false,
  ended = false,
  emptyCoupons = false,
  emptyPoints = false,
  notYetUsable = false,
  pageSize = 4,
  canClaim = false,
  emptyInvitees = false,
  inviteePageSize = 3,
}: FakeRewardsOptions = {}) {
  let claimable = canClaim
  const rejections: Record<string, () => never> = {
    NOPE: () => {
      throw fail(400, 'CAMPAIGN.REFERRAL_INVALID', { reason: 'UNKNOWN_CODE' })
    },
    OWN: () => {
      throw fail(400, 'CAMPAIGN.REFERRAL_INVALID', { reason: 'OWN_CODE' })
    },
    DUP: () => {
      throw fail(400, 'CAMPAIGN.REFERRAL_INVALID', { reason: 'ALREADY_INVITED' })
    },
    MUTUAL: () => {
      throw fail(400, 'CAMPAIGN.REFERRAL_INVALID', { reason: 'MUTUAL' })
    },
    OLD: () => {
      throw fail(400, 'CAMPAIGN.REFERRAL_INVALID', { reason: 'NOT_NEW_ACCOUNT' })
    },
    ENDED: () => {
      throw fail(409, 'CAMPAIGN.NOT_ACTIVE')
    },
  }
  const invitees = emptyInvitees ? [] : sampleInvitees
  let attendance = attendanceCampaign({ checkedToday })
  let available = emptyCoupons
    ? []
    : [
        ...sampleCoupons,
        ...(notYetUsable
          ? [coupon({ id: 'c9', name: '겨울 쿠폰', usableFrom: '2099-12-24T12:00:00Z' })]
          : []),
      ]
  const claims: string[] = []
  const entries = emptyPoints ? [] : history(7)

  const api: RewardsApi = {
    listCampaigns: async () => [
      attendance,
      {
        id: 'ref',
        kind: 'referral',
        name: '친구 초대',
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: null,
      },
    ],
    checkIn: async () => {
      if (ended) throw fail(409, 'CAMPAIGN.NOT_ACTIVE')
      const state = attendance.attendance!
      if (state.checkedToday)
        return { alreadyChecked: true, total: state.total, streak: state.streak, rewards: [] }
      attendance = attendanceCampaign({
        checkedToday: true,
        total: state.total + 1,
        streak: state.streak + 1,
      })
      return {
        alreadyChecked: false,
        total: state.total + 1,
        streak: state.streak + 1,
        rewards: [{ type: 'point', label: '100 포인트' }],
      }
    },
    attendanceMonth: async () => ({ days: ['2026-10-26', '2026-10-27', '2026-10-28'] }),
    myReferral: async () => ({
      code: 'AB12CD34',
      invited: 3,
      rewarded: 2,
      canClaim: claimable,
      claimUntil: claimable ? '2026-11-15T14:59:59Z' : null,
    }),
    myInvitees: async (cursor) => {
      const start = cursor ? Number(cursor) : 0
      const next = start + inviteePageSize
      return {
        values: invitees.slice(start, next),
        cursor: {
          hasNext: next < invitees.length,
          nextCursor: next < invitees.length ? String(next) : null,
        },
        meta: { timestamp: 't' },
      }
    },
    claimReferral: async (code) => {
      rejections[code]?.()
      claims.push(code)
      claimable = false
    },
    listCoupons: async (tab) => (tab === 'AVAILABLE' ? available : emptyCoupons ? [] : pastCoupons),
    redeemCoupon: async (code) => {
      if (code === 'BAD') throw fail(400, 'COUPON.CODE_INVALID')
      if (code === 'USED') throw fail(409, 'COUPON.CODE_USED')
      if (code === 'EMPTY') throw fail(409, 'COUPON.CODE_EXHAUSTED')
      const added = coupon({ id: `r${available.length}`, name: `코드 ${code} 쿠폰` })
      available = [added, ...available]
      return added
    },
    points: async () => ({
      balance: emptyPoints ? 0 : 1200,
      expiringSoon: emptyPoints ? null : { amount: 300, before: '2026-11-30T14:59:59Z' },
    }),
    pointHistory: async (cursor) => {
      const start = cursor ? Number(cursor) : 0
      const values = entries.slice(start, start + pageSize)
      const next = start + pageSize
      return {
        values,
        cursor: {
          hasNext: next < entries.length,
          nextCursor: next < entries.length ? String(next) : null,
        },
        meta: { timestamp: 't' },
      }
    },
  }
  return { api, claims }
}

export type FakeBadgesOptions = {
  /** 받은 것 없이 아직인 것만 */
  noneEarned?: boolean
  /** 받은 것도 아직인 것도 없음 */
  empty?: boolean
  /** 프로필 줄 — 공개 응답 */
  profile?: PublicBadge[]
}

const earnedBadge = (
  over: Partial<EarnedBadge> & Pick<EarnedBadge, 'awardId' | 'code' | 'name'>,
): EarnedBadge => ({
  description: '',
  imageUrl: null,
  hidden: false,
  archived: false,
  visible: true,
  awardedAt: '2026-10-28T03:00:00Z',
  ...over,
})

export const sampleProfileBadges: PublicBadge[] = [
  { code: 'early-bird', name: '얼리 버드', description: '첫 주에 가입했어요', imageUrl: null },
  {
    code: 'writer-10',
    name: '열 번째 노트',
    description: '노트를 열 개 만들었어요',
    imageUrl: null,
  },
]

/** 스토리 · 시험용 메모리 안의 가짜 배지 API. 스위치는 메모리에서 바로 바뀐다 */
export function createFakeBadges({
  noneEarned = false,
  empty = false,
  profile = sampleProfileBadges,
}: FakeBadgesOptions = {}) {
  let earned: EarnedBadge[] =
    empty || noneEarned
      ? []
      : [
          earnedBadge({
            awardId: 'a1',
            code: 'early-bird',
            name: '얼리 버드',
            description: '첫 주에 가입했어요',
          }),
          earnedBadge({
            awardId: 'a2',
            code: 'writer-10',
            name: '열 번째 노트',
            description: '노트를 열 개 만들었어요',
            visible: false,
          }),
        ]
  const locked: LockedBadge[] = empty
    ? []
    : [
        {
          hidden: false,
          code: 'writer-100',
          name: '백 번째 노트',
          description: '노트를 백 개 만들면 받아요',
          imageUrl: null,
        },
        { hidden: true, code: null, name: null, description: null, imageUrl: null },
      ]
  const calls: { awardId: string; visible: boolean }[] = []
  const api: BadgeApi = {
    myBadges: async () => ({ earned, locked }),
    setBadgeVisible: async (awardId, visible) => {
      calls.push({ awardId, visible })
      earned = earned.map((b) => (b.awardId === awardId ? { ...b, visible } : b))
      return { awardId, visible }
    },
    profileBadges: async () => profile,
  }
  return { api, calls }
}
