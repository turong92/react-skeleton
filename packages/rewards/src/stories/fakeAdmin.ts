import type { RewardsAdminApi } from '../admin/adminApi'
import type { AccountChoice } from '../admin/accountLabel'
import type {
  AdminBadge,
  AdminCampaign,
  BadgeAwardEvent,
  CouponDefinition,
  IssuedCoupon,
  RewardGrant,
} from '../admin/types'
import type { CouponStatus } from '../types'
import type { PointEntry } from '../types'
import { fail } from './fakeRewards'

export const fakeAccounts: AccountChoice[] = [
  { id: 'acc_1', email: 'ada@example.com', loginId: 'ada' },
  { id: 'acc_2', email: 'bob@example.com', loginId: null },
  // 쿠폰을 줄 때 건너뛰어지는 계정(한도를 채웠다)
  { id: 'skip_3', email: 'skip@example.com', loginId: null },
]

/** 스토리용 계정 검색 - 이메일 조각 또는 정확한 로그인 아이디 */
export async function fakeSearchAccounts(query: string): Promise<AccountChoice[]> {
  const q = query.toLowerCase()
  return fakeAccounts.filter((a) => a.email?.toLowerCase().includes(q) || a.loginId === q)
}

/** 스토리 · 시험용 메모리 안의 가짜 운영 API(C-ADM 꼴). 계정 `acc_1` 잔액 1,000 · 포인트를 그보다 많이 빼면 409 `POINT.INSUFFICIENT` */
export function createFakeAdmin() {
  let campaigns: AdminCampaign[] = [
    {
      id: 'att',
      kind: 'attendance',
      name: '10월 출석 이벤트',
      enabled: true,
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: null,
      config: {
        daily: [{ type: 'point', params: { amount: '10' } }],
        milestones: [
          { days: 3, streak: false, rewards: [{ type: 'coupon', params: { definitionId: 'd1' } }] },
        ],
      },
    },
    {
      id: 'ref',
      kind: 'referral',
      name: '친구 초대',
      enabled: false,
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-12-31T14:59:59Z',
      config: {
        invitee: [{ type: 'coupon', params: { definitionId: 'd1' } }],
        inviter: [{ type: 'point', params: { amount: '500' } }],
        qualifyOn: 'SIGNAL',
        claimWithinDays: 7,
        inviterCap: null,
      },
    },
  ]
  let definitions: CouponDefinition[] = [
    {
      id: 'd1',
      name: '무료 이용권',
      status: 'ACTIVE',
      stages: [{ type: 'FREE', value: 0, maxDiscount: null, periods: 1 }],
      currency: null,
      minAmount: null,
      scope: { purposes: [], itemTypes: [], planCodes: [] },
      firstPurchaseOnly: false,
      validDays: 30,
      validUntil: null,
      issueLimit: null,
      perAccountLimit: 1,
      issueStartsAt: '2026-10-01T00:00:00Z',
      issueEndsAt: '2026-12-31T14:59:59Z',
      validFrom: '2026-10-15T00:00:00Z',
      issuedCount: 25,
    },
  ]
  // 정의 d1 에서 발급된 쿠폰 25장 - 상태가 돌아가며 섞인다(두 쪽으로 나뉜다)
  const cycle: CouponStatus[] = [
    'AVAILABLE',
    'AVAILABLE',
    'USED',
    'RESERVED',
    'EXPIRED',
    'AVAILABLE',
  ]
  let coupons: IssuedCoupon[] = Array.from({ length: 25 }, (_, i) => {
    const status = cycle[i % cycle.length] as CouponStatus
    return {
      id: `k${i + 1}`,
      accountId: i % 2 === 0 ? 'acc_1' : 'acc_2',
      accountLabel: i % 2 === 0 ? 'mina@example.com' : 'jun@example.com',
      status,
      issuedAt: new Date(Date.UTC(2026, 9, 20, 3, i)).toISOString(),
      expiresAt: '2026-12-31T14:59:59Z',
      usableFrom: '2026-10-15T00:00:00Z',
      usedAt: status === 'USED' ? '2026-10-25T03:00:00Z' : null,
      orderRef: status === 'USED' || status === 'RESERVED' ? `ord_${i + 1}` : null,
    }
  })
  let badges: AdminBadge[] = [
    {
      id: 'b1',
      code: 'early-bird',
      name: '얼리 버드',
      description: '첫 주에 가입했어요',
      imageUrl: null,
      hidden: false,
      sortOrder: 0,
      status: 'ACTIVE',
      holders: 2,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    {
      id: 'b2',
      code: 'night-owl',
      name: '올빼미',
      description: '',
      imageUrl: null,
      hidden: true,
      sortOrder: 1,
      status: 'ARCHIVED',
      holders: 0,
      createdAt: '2026-10-02T00:00:00Z',
      updatedAt: '2026-10-02T00:00:00Z',
    },
  ]
  // 최신순 - w1 은 수여(회수 가능), w2 는 수여 → 회수(단추 없음)
  let badgeEvents: BadgeAwardEvent[] = [
    {
      id: 'ev3',
      awardId: 'w2',
      badgeId: 'b1',
      badgeCode: 'early-bird',
      badgeName: '얼리 버드',
      accountId: 'acc_2',
      accountLabel: 'bob@example.com',
      action: 'REVOKED',
      source: 'ADMIN',
      sourceRef: null,
      actorId: 'op1',
      reason: '잘못 줌',
      createdAt: '2026-10-27T03:00:00Z',
    },
    {
      id: 'ev2',
      awardId: 'w2',
      badgeId: 'b1',
      badgeCode: 'early-bird',
      badgeName: '얼리 버드',
      accountId: 'acc_2',
      accountLabel: 'bob@example.com',
      action: 'AWARDED',
      source: 'ADMIN',
      sourceRef: null,
      actorId: 'op1',
      reason: null,
      createdAt: '2026-10-26T03:00:00Z',
    },
    {
      id: 'ev1',
      awardId: 'w1',
      badgeId: 'b1',
      badgeCode: 'early-bird',
      badgeName: '얼리 버드',
      accountId: 'acc_1',
      accountLabel: 'ada@example.com',
      action: 'AWARDED',
      source: 'APP',
      sourceRef: 'signup',
      actorId: null,
      reason: null,
      createdAt: '2026-10-25T03:00:00Z',
    },
  ]
  const revoked: Array<{ awardId: string; reason: string }> = []
  let balance = 1000
  let entries: PointEntry[] = [
    {
      id: 'e1',
      delta: 1000,
      kind: 'EARN',
      reason: '출석 보상',
      expiresAt: null,
      createdAt: '2026-10-27T03:00:00Z',
    },
  ]
  let grants: RewardGrant[] = [
    {
      id: 'g1',
      accountId: 'acc_1',
      type: 'point',
      label: '100 포인트',
      status: 'FAILED',
      sourceType: 'attendance',
      lastError: 'job dead',
      createdAt: '2026-10-27T03:00:00Z',
      issuedAt: null,
    },
    {
      id: 'g2',
      accountId: 'acc_2',
      type: 'coupon',
      label: '무료 이용권',
      status: 'PENDING',
      sourceType: 'referral',
      lastError: null,
      createdAt: '2026-10-28T03:00:00Z',
      issuedAt: null,
    },
  ]
  const issued: Array<{ id: string; accountIds: string[] }> = []
  let seq = 10

  const api: RewardsAdminApi = {
    listCampaigns: async () => campaigns.map((c) => ({ ...c })),
    createCampaign: async (input) => {
      const created = { ...input, id: `c${seq++}`, enabled: false }
      campaigns = [...campaigns, created]
      return created
    },
    updateCampaign: async (id, input) => {
      campaigns = campaigns.map((c) => (c.id === id ? { ...c, ...input } : c))
      return campaigns.find((c) => c.id === id) as AdminCampaign
    },
    setCampaignEnabled: async (id, enabled) => {
      campaigns = campaigns.map((c) => (c.id === id ? { ...c, enabled } : c))
      return campaigns.find((c) => c.id === id) as AdminCampaign
    },
    listBadges: async () => badges.map((b) => ({ ...b })),
    createBadge: async (input) => {
      if (badges.some((b) => b.code === input.code)) throw fail(409, 'BADGE.CODE_TAKEN')
      const created: AdminBadge = {
        ...input,
        id: `b${seq++}`,
        status: 'ACTIVE',
        holders: 0,
        createdAt: '2026-10-28T09:00:00Z',
        updatedAt: '2026-10-28T09:00:00Z',
      }
      badges = [...badges, created]
      return created
    },
    updateBadge: async (id, input) => {
      badges = badges.map((b) => (b.id === id ? { ...b, ...input } : b))
      return badges.find((b) => b.id === id) as AdminBadge
    },
    setBadgeStatus: async (id, status) => {
      badges = badges.map((b) => (b.id === id ? { ...b, status } : b))
      return badges.find((b) => b.id === id) as AdminBadge
    },
    awardBadge: async (_id, { accountIds }) => ({
      awarded: accountIds.filter((a) => a !== 'acc_1'),
      alreadyHeld: accountIds.filter((a) => a === 'acc_1'),
    }),
    revokeBadgeAward: async (awardId, reason) => {
      revoked.push({ awardId, reason })
      const last = badgeEvents.find((e) => e.awardId === awardId) as BadgeAwardEvent
      badgeEvents = [
        { ...last, id: `ev${seq++}`, action: 'REVOKED', source: 'ADMIN', reason },
        ...badgeEvents,
      ]
      return { awardId }
    },
    listBadgeAwards: async ({ badgeId, accountId, cursor } = {}) => {
      const all = badgeEvents.filter(
        (e) => (!badgeId || e.badgeId === badgeId) && (!accountId || e.accountId === accountId),
      )
      const start = cursor ? Number(cursor) : 0
      const next = start + 2
      return {
        values: all.slice(start, next),
        cursor: { hasNext: next < all.length, nextCursor: next < all.length ? String(next) : null },
        meta: { timestamp: 't' },
      }
    },
    listCouponDefinitions: async () => definitions.map((d) => ({ ...d })),
    createCouponDefinition: async (input) => {
      const created = { ...input, id: `d${seq++}`, status: 'ACTIVE' as const, issuedCount: 0 }
      definitions = [...definitions, created]
      return created
    },
    setCouponDefinitionStatus: async (id, status) => {
      definitions = definitions.map((d) => (d.id === id ? { ...d, status } : d))
      return definitions.find((d) => d.id === id) as CouponDefinition
    },
    issueCoupons: async (id, accountIds) => {
      issued.push({ id, accountIds })
      // 한도 · 이미 가진 계정은 건너뛴다 - 이름이 skip 으로 시작하는 계정이 그렇다
      return {
        issued: accountIds.filter((a) => !a.startsWith('skip')),
        skipped: accountIds.filter((a) => a.startsWith('skip')),
      }
    },
    createCouponCode: async () => ({ code: 'WELCOME' }),
    couponStats: async () => {
      const count = (status: CouponStatus) => coupons.filter((c) => c.status === status).length
      const used = count('USED')
      return {
        issued: coupons.length,
        available: count('AVAILABLE'),
        reserved: count('RESERVED'),
        used,
        expired: count('EXPIRED'),
        revoked: count('REVOKED'),
        discountTotals: used > 0 ? [{ currency: 'KRW', amount: used * 3000 }] : [],
      }
    },
    listDefinitionCoupons: async (_id, { status, cursor, size = 20 } = {}) => {
      const matching = coupons.filter((c) => status === undefined || c.status === status)
      const start = cursor ? Number(cursor) : 0
      const next = start + size
      return {
        values: matching.slice(start, next),
        cursor: {
          hasNext: next < matching.length,
          nextCursor: next < matching.length ? String(next) : null,
        },
        meta: { timestamp: 't' },
      }
    },
    listAccountCoupons: async (accountId) =>
      coupons
        .filter((c) => c.accountId === accountId)
        .slice(0, 3)
        .map((c) => ({
          id: c.id,
          name: '무료 이용권',
          status: c.status,
          expiresAt: c.expiresAt,
          stages: [{ type: 'FREE' as const, value: 0, maxDiscount: null, periods: 1 }],
          scope: { purposes: [], itemTypes: [], planCodes: [] },
          currency: null,
          minAmount: null,
        })),
    revokeCoupon: async (id) => {
      const target = coupons.find((c) => c.id === id)
      if (!target || target.status !== 'AVAILABLE') throw fail(409, 'COUPON.NOT_REVOCABLE')
      coupons = coupons.map((c) => (c.id === id ? { ...c, status: 'REVOKED' } : c))
      return {
        id,
        name: '무료 이용권',
        status: 'REVOKED' as const,
        expiresAt: null,
        stages: [],
        scope: { purposes: [], itemTypes: [], planCodes: [] },
        currency: null,
        minAmount: null,
      }
    },
    accountPoints: async () => ({ balance, entries: [...entries] }),
    adjustPoints: async (_accountId, input) => {
      if (balance + input.delta < 0) throw fail(409, 'POINT.INSUFFICIENT')
      balance += input.delta
      const entry: PointEntry = {
        id: `e${seq++}`,
        delta: input.delta,
        kind: 'ADJUST',
        reason: input.reason,
        expiresAt: null,
        createdAt: '2026-10-28T09:00:00Z',
      }
      entries = [entry, ...entries]
      return entry
    },
    listRewardGrants: async (status) =>
      grants.filter((g) => status === undefined || g.status === status),
    retryRewardGrant: async (id) => {
      grants = grants.map((g) => (g.id === id ? { ...g, status: 'PENDING', lastError: null } : g))
      return grants.find((g) => g.id === id) as RewardGrant
    },
    cancelRewardGrant: async (id) => {
      grants = grants.map((g) => (g.id === id ? { ...g, status: 'CANCELED' } : g))
      return grants.find((g) => g.id === id) as RewardGrant
    },
  }
  return { api, issued, revoked }
}
