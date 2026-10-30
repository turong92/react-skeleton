import { describe, expect, it } from 'vitest'
import { recordingClient } from '../test/recordingClient'
import { createRewardsAdminApi } from './adminApi'

const run = async (body: (api: ReturnType<typeof createRewardsAdminApi>) => Promise<unknown>) => {
  const { client, calls } = recordingClient([])
  await body(createRewardsAdminApi(client))
  return calls
}

describe('createRewardsAdminApi (contract C-ADM, spec §8)', () => {
  it('campaigns: list / create / update / enabled switch', async () => {
    const config = { rewards: [] }
    const calls = await run(async (api) => {
      await api.listCampaigns()
      await api.createCampaign({
        kind: 'attendance',
        name: 'A',
        startsAt: 's',
        endsAt: null,
        config,
      })
      await api.updateCampaign('c/1', { name: 'B', startsAt: 's', endsAt: null, config })
      await api.setCampaignEnabled('c/1', false)
    })
    expect(calls).toEqual([
      { kind: 'list', path: '/admin/campaigns', request: undefined },
      {
        kind: 'value',
        path: '/admin/campaigns',
        request: {
          method: 'POST',
          json: { kind: 'attendance', name: 'A', startsAt: 's', endsAt: null, config },
        },
      },
      {
        kind: 'value',
        path: '/admin/campaigns/c%2F1',
        request: { method: 'PUT', json: { name: 'B', startsAt: 's', endsAt: null, config } },
      },
      {
        kind: 'value',
        path: '/admin/campaigns/c%2F1/enabled',
        request: { method: 'PATCH', json: { enabled: false } },
      },
    ])
  })

  it('coupon definitions: list / create / status / issue / code; coupons by account / revoke', async () => {
    const def = {
      name: 'N',
      stages: [],
      currency: null,
      minAmount: null,
      scope: { purposes: [], itemTypes: [], planCodes: [] },
      firstPurchaseOnly: false,
      validDays: null,
      validUntil: null,
      issueLimit: null,
      perAccountLimit: 1,
    }
    const calls = await run(async (api) => {
      await api.listCouponDefinitions()
      await api.createCouponDefinition(def)
      await api.setCouponDefinitionStatus('d1', 'PAUSED')
      await api.issueCoupons('d1', ['a1', 'a2'])
      await api.createCouponCode('d1')
      await api.listAccountCoupons('a1')
      await api.revokeCoupon('k1')
    })
    expect(
      calls.map((c) => [c.kind, c.path, (c.request as { method?: string } | undefined)?.method]),
    ).toEqual([
      ['list', '/admin/coupon-definitions', undefined],
      ['value', '/admin/coupon-definitions', 'POST'],
      ['value', '/admin/coupon-definitions/d1/status', 'PATCH'],
      ['value', '/admin/coupon-definitions/d1/issue', 'POST'],
      ['value', '/admin/coupon-definitions/d1/codes', 'POST'],
      ['list', '/admin/coupons', undefined],
      ['value', '/admin/coupons/k1/revoke', 'POST'],
    ])
    expect(calls[2]?.request).toMatchObject({ json: { status: 'PAUSED' } })
    expect(calls[3]?.request).toMatchObject({ json: { accountIds: ['a1', 'a2'] } })
    expect(calls[5]?.request).toEqual({ params: { accountId: 'a1' } })
  })

  it('points: read an account, adjust it', async () => {
    const calls = await run(async (api) => {
      await api.accountPoints('a/1')
      await api.adjustPoints('a/1', { delta: -5, reason: 'fix', expiresInDays: null })
    })
    expect(calls).toEqual([
      { kind: 'value', path: '/admin/points/a%2F1', request: undefined },
      {
        kind: 'value',
        path: '/admin/points/a%2F1/adjustments',
        request: { method: 'POST', json: { delta: -5, reason: 'fix', expiresInDays: null } },
      },
    ])
  })

  it('reward grants: list by status, retry, cancel', async () => {
    const calls = await run(async (api) => {
      await api.listRewardGrants('FAILED')
      await api.listRewardGrants()
      await api.retryRewardGrant('g1')
      await api.cancelRewardGrant('g1')
    })
    expect(calls).toEqual([
      { kind: 'list', path: '/admin/reward-grants', request: { params: { status: 'FAILED' } } },
      { kind: 'list', path: '/admin/reward-grants', request: { params: {} } },
      { kind: 'value', path: '/admin/reward-grants/g1/retry', request: { method: 'POST' } },
      { kind: 'value', path: '/admin/reward-grants/g1/cancel', request: { method: 'POST' } },
    ])
  })
})

describe('coupon definition status and issued coupons (coupon-admin contract)', () => {
  it('stats → GET /admin/coupon-definitions/{id}/stats', async () => {
    const calls = await run((api) => api.couponStats('d/1'))
    expect(calls).toEqual([
      { kind: 'value', path: '/admin/coupon-definitions/d%2F1/stats', request: undefined },
    ])
  })

  it('issued coupons → GET …/coupons with only the params given (cursor page)', async () => {
    const calls = await run(async (api) => {
      await api.listDefinitionCoupons('d1')
      await api.listDefinitionCoupons('d1', { status: 'USED', cursor: 'c2', size: 20 })
    })
    expect(calls).toEqual([
      { kind: 'cursor', path: '/admin/coupon-definitions/d1/coupons', request: { params: {} } },
      {
        kind: 'cursor',
        path: '/admin/coupon-definitions/d1/coupons',
        request: { params: { status: 'USED', cursor: 'c2', size: 20 } },
      },
    ])
  })
  it('badges: list / create / update (no code) / status', async () => {
    const input = { name: 'N', description: '', imageUrl: null, hidden: false, sortOrder: 0 }
    const calls = await run(async (api) => {
      await api.listBadges()
      await api.createBadge({ code: 'early', ...input })
      await api.updateBadge('b/1', input)
      await api.setBadgeStatus('b/1', 'ARCHIVED')
    })
    expect(calls).toEqual([
      { kind: 'list', path: '/admin/badges', request: undefined },
      {
        kind: 'value',
        path: '/admin/badges',
        request: { method: 'POST', json: { code: 'early', ...input } },
      },
      { kind: 'value', path: '/admin/badges/b%2F1', request: { method: 'PUT', json: input } },
      {
        kind: 'value',
        path: '/admin/badges/b%2F1/status',
        request: { method: 'PATCH', json: { status: 'ARCHIVED' } },
      },
    ])
  })

  it('badge award: a reply from an older server without unknownAccountIds reads as empty', async () => {
    const { client } = recordingClient({ awarded: ['a1'], alreadyHeld: [] })
    const result = await createRewardsAdminApi(client).awardBadge('b1', { accountIds: ['a1'] })
    expect(result.unknownAccountIds).toEqual([])
  })

  it('badge awards: manual award, revoke with a reason, history by cursor with only the filters given', async () => {
    const calls = await run(async (api) => {
      await api.awardBadge('b1', { accountIds: ['a1'], reason: '행사' })
      await api.revokeBadgeAward('w/1', '잘못 줌')
      await api.listBadgeAwards()
      await api.listBadgeAwards({ badgeId: 'b1', accountId: 'a1', cursor: 'c2' })
    })
    expect(calls).toEqual([
      {
        kind: 'value',
        path: '/admin/badges/b1/awards',
        request: { method: 'POST', json: { accountIds: ['a1'], reason: '행사' } },
      },
      {
        kind: 'value',
        path: '/admin/badge-awards/w%2F1/revoke',
        request: { method: 'POST', json: { reason: '잘못 줌' } },
      },
      { kind: 'cursor', path: '/admin/badge-awards', request: { params: {} } },
      {
        kind: 'cursor',
        path: '/admin/badge-awards',
        request: { params: { badgeId: 'b1', accountId: 'a1', cursor: 'c2' } },
      },
    ])
  })

  it('achievement campaigns carry {metric, milestones:[{value, rewards}]} in config unchanged', async () => {
    const config = {
      metric: 'notes.created',
      milestones: [{ value: 10, rewards: [{ type: 'badge', params: { code: 'writer' } }] }],
    }
    const calls = await run((api) =>
      api.createCampaign({ kind: 'achievement', name: 'A', startsAt: 's', endsAt: null, config }),
    )
    expect(calls[0].request).toEqual({
      method: 'POST',
      json: { kind: 'achievement', name: 'A', startsAt: 's', endsAt: null, config },
    })
  })
})
