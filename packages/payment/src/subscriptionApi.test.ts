import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { CONFIRM_TIMEOUT_MS } from './ledgerApi'
import { createSubscriptionApi } from './subscriptionApi'

type Call = { path: string; request?: ApiRequest }

function fakeClient(reply: unknown = {}) {
  const calls: Call[] = []
  return {
    calls,
    client: {
      value: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ path, request })
        return reply as T
      },
    },
  }
}

describe('createSubscriptionApi (paths and bodies mirror the backend HTTP contract §12)', () => {
  it('plans → GET /payments/subscriptions/plans, unwrapped to the list', async () => {
    const { client, calls } = fakeClient({ plans: [{ code: 'basic' }] })
    await expect(createSubscriptionApi(client).plans()).resolves.toEqual([{ code: 'basic' }])
    expect(calls).toEqual([{ path: '/payments/subscriptions/plans', request: undefined }])
  })

  it('basePath is configurable and trailing slashes are dropped', async () => {
    const { client, calls } = fakeClient({ plans: [] })
    await createSubscriptionApi(client, { basePath: '/pay/' }).plans()
    expect(calls[0]?.path).toBe('/pay/subscriptions/plans')
  })

  it('start → POST /subscriptions with { planCode } and the Idempotency-Key', async () => {
    const { client, calls } = fakeClient()
    await createSubscriptionApi(client).start({ planCode: 'basic' }, { idempotencyKey: 'k-1' })
    expect(calls[0]).toEqual({
      path: '/payments/subscriptions',
      request: { method: 'POST', json: { planCode: 'basic' }, idempotencyKey: 'k-1' },
    })
  })

  it('start makes a fresh key per call when none is given (never sends without one)', async () => {
    const { client, calls } = fakeClient()
    const api = createSubscriptionApi(client)
    await api.start({ planCode: 'basic' })
    await api.start({ planCode: 'basic' })
    const keys = calls.map((call) => call.request?.idempotencyKey)
    expect(keys[0]).toMatch(/^fe-/)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('activate → POST /subscriptions/{id}/activate with { providerPayload: { authKey } } and the long confirm timeout', async () => {
    const { client, calls } = fakeClient()
    await createSubscriptionApi(client).activate('sub_1', { providerPayload: { authKey: 'bk_1' } })
    expect(calls[0]).toEqual({
      path: '/payments/subscriptions/sub_1/activate',
      request: {
        method: 'POST',
        json: { providerPayload: { authKey: 'bk_1' } },
        timeoutMs: CONFIRM_TIMEOUT_MS,
      },
    })
    expect(calls[0]?.request?.idempotencyKey).toBeUndefined()
  })

  it('me → GET /subscriptions/me and cancel → POST /subscriptions/{id}/cancel (ids are encoded)', async () => {
    const { client, calls } = fakeClient()
    const api = createSubscriptionApi(client)
    await api.me()
    await api.cancel('sub/1')
    expect(calls).toEqual([
      { path: '/payments/subscriptions/me', request: undefined },
      { path: '/payments/subscriptions/sub%2F1/cancel', request: { method: 'POST' } },
    ])
  })

  it('start posts the plan, cancelPreview → GET …/cancel-preview and cancelNow → POST …/cancel-now with the long timeout', async () => {
    const { client, calls } = fakeClient()
    const api = createSubscriptionApi(client)
    await api.start({ planCode: 'basic' }, { idempotencyKey: 'k-1' })
    await api.cancelPreview('sub/1')
    await api.cancelNow('sub/1')
    expect(calls).toEqual([
      {
        path: '/payments/subscriptions',
        request: {
          method: 'POST',
          json: { planCode: 'basic' },
          idempotencyKey: 'k-1',
        },
      },
      { path: '/payments/subscriptions/sub%2F1/cancel-preview', request: undefined },
      {
        path: '/payments/subscriptions/sub%2F1/cancel-now',
        request: { method: 'POST', timeoutMs: CONFIRM_TIMEOUT_MS },
      },
    ])
  })

  it('changePreview → GET …/change-preview?planCode and changePlan → POST …/change with the Idempotency-Key and the long timeout', async () => {
    const { client, calls } = fakeClient()
    const api = createSubscriptionApi(client)
    await api.changePreview('sub/1', 'pro')
    await api.changePlan(
      'sub/1',
      { planCode: 'pro', expectedCharge: 1500 },
      { idempotencyKey: 'k1' },
    )
    expect(calls).toEqual([
      {
        path: '/payments/subscriptions/sub%2F1/change-preview',
        request: { params: { planCode: 'pro' } },
      },
      {
        path: '/payments/subscriptions/sub%2F1/change',
        request: {
          method: 'POST',
          json: { planCode: 'pro', expectedCharge: 1500 },
          idempotencyKey: 'k1',
          timeoutMs: CONFIRM_TIMEOUT_MS,
        },
      },
    ])
  })

  it('cancelScheduledChange → DELETE /subscriptions/{id}/scheduled-change', async () => {
    const { client, calls } = fakeClient()
    await createSubscriptionApi(client).cancelScheduledChange('sub/1')
    expect(calls[0]).toEqual({
      path: '/payments/subscriptions/sub%2F1/scheduled-change',
      request: { method: 'DELETE' },
    })
  })
})
