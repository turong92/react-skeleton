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
