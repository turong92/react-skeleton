import type { RewardsAdminApi } from '../admin/adminApi'
import type { AdminCampaign, CouponDefinition, RewardGrant } from '../admin/types'
import type { PointEntry } from '../types'
import { fail } from './fakeRewards'

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
      issuedCount: 4,
    },
  ]
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
    listAccountCoupons: async () => [],
    revokeCoupon: async () => {
      throw fail(404, 'COUPON.NOT_FOUND')
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
  return { api, issued }
}
