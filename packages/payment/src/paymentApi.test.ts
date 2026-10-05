import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { createPaymentApi } from './paymentApi'
import type { PaymentOperationResult } from './types'

type Call = { path: string; request?: ApiRequest }

const result: PaymentOperationResult = {
  provider: 'toss',
  providerPaymentId: 'pay_1',
  status: 'CONFIRMED',
  amount: { amount: 15000, currency: 'KRW' },
  trace: { provider: 'toss' },
  providerOperationId: null,
  rawProviderStatus: 'DONE',
  attributes: {},
}

function fakeClient(reply: unknown) {
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

describe('createPaymentApi (shapes mirror kotlin-skeleton modules/payment PaymentContracts)', () => {
  it('confirm → POST <paths.confirm> with the PaymentConfirmRequest body, returns the PaymentOperationResult', async () => {
    const { client, calls } = fakeClient(result)
    const request = {
      providerPaymentId: 'pay_1',
      amount: { amount: 15000, currency: 'KRW' },
      merchantReferenceId: 'order-1',
      provider: 'toss',
    }
    const out = await createPaymentApi(client, { paths: { confirm: '/payments/confirm' } })
      .confirm!(request)
    expect(out).toBe(result)
    expect(calls).toEqual([
      { path: '/payments/confirm', request: { method: 'POST', json: request } },
    ])
  })

  it('cancel and refund POST their own paths; an idempotency key rides in the Idempotency-Key header', async () => {
    const { client, calls } = fakeClient(result)
    const api = createPaymentApi(client, {
      paths: { cancel: '/payments/cancel', refund: '/payments/refund' },
    })
    await api.cancel!({ providerPaymentId: 'p', reason: 'changed mind' }, { idempotencyKey: 'k-1' })
    await api.refund!({ providerPaymentId: 'p', amount: { amount: 1, currency: 'KRW' } })
    expect(calls).toEqual([
      {
        path: '/payments/cancel',
        request: {
          method: 'POST',
          json: { providerPaymentId: 'p', reason: 'changed mind' },
          idempotencyKey: 'k-1',
        },
      },
      {
        path: '/payments/refund',
        request: {
          method: 'POST',
          json: { providerPaymentId: 'p', amount: { amount: 1, currency: 'KRW' } },
        },
      },
    ])
  })

  it('route → GET <paths.route> with only the given query (the workbench demo endpoint shape)', async () => {
    const route = {
      provider: 'toss',
      requestedProvider: null,
      amount: 15000,
      currency: 'KRW',
      country: 'KR',
      available: true,
      source: 'bean',
    }
    const { client, calls } = fakeClient(route)
    const api = createPaymentApi(client, { paths: { route: '/skeleton/payments/route' } })
    expect(await api.route!({ amount: 15000, currency: 'KRW', country: 'KR' })).toBe(route)
    expect(calls[0]).toEqual({
      path: '/skeleton/payments/route',
      request: { params: { amount: 15000, currency: 'KRW', country: 'KR' } },
    })
  })

  it('only the paths you give exist — the module opens no HTTP, so nothing is assumed', () => {
    const { client } = fakeClient({})
    const api = createPaymentApi(client, { paths: {} })
    expect(api.route).toBeUndefined()
    expect(api.confirm).toBeUndefined()
    expect(api.cancel).toBeUndefined()
    expect(api.refund).toBeUndefined()
  })
})
