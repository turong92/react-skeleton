import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { CONFIRM_TIMEOUT_MS, createPaymentLedgerApi } from './ledgerApi'

type Call = { kind: 'value' | 'cursor'; path: string; request?: ApiRequest }

function fakeClient(reply: unknown = {}) {
  const calls: Call[] = []
  return {
    calls,
    client: {
      value: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ kind: 'value', path, request })
        return reply as T
      },
      cursor: async <T>(path: string, request?: ApiRequest) => {
        calls.push({ kind: 'cursor', path, request })
        return reply as T
      },
    },
  }
}

describe('createPaymentLedgerApi (paths and bodies mirror the backend HTTP contract, user routes only)', () => {
  it('config → GET /payments/config', async () => {
    const { client, calls } = fakeClient({ available: true })
    const api = createPaymentLedgerApi(client)
    await expect(api.config()).resolves.toEqual({ available: true })
    expect(calls).toEqual([{ kind: 'value', path: '/payments/config', request: undefined }])
  })

  it('basePath is configurable and trailing slashes are dropped', async () => {
    const { client, calls } = fakeClient()
    await createPaymentLedgerApi(client, { basePath: '/pay/' }).config()
    expect(calls[0]?.path).toBe('/pay/config')
  })

  it('createOrder → POST /orders with the item as body and an Idempotency-Key', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentLedgerApi(client)
    await api.createOrder({ itemType: 'cheer', itemRef: 'cheer-3000' }, { idempotencyKey: 'k-1' })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/payments/orders',
      request: {
        method: 'POST',
        json: { itemType: 'cheer', itemRef: 'cheer-3000' },
        idempotencyKey: 'k-1',
      },
    })
  })

  it('createOrder makes a fresh key per call when none is given (never sends without one)', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentLedgerApi(client)
    await api.createOrder({ itemType: 'cheer', itemRef: 'cheer-1000' })
    await api.createOrder({ itemType: 'cheer', itemRef: 'cheer-1000' })
    const keys = calls.map((call) => call.request?.idempotencyKey)
    expect(keys[0]).toMatch(/^fe-/)
    expect(keys[1]).toMatch(/^fe-/)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('confirmOrder → POST /orders/{id}/confirm with { providerPaymentId, amount } and no Idempotency-Key', async () => {
    const { client, calls } = fakeClient()
    await createPaymentLedgerApi(client).confirmOrder('ord_1', {
      providerPaymentId: 'pay_9',
      amount: 3000,
    })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/payments/orders/ord_1/confirm',
      request: {
        method: 'POST',
        json: { providerPaymentId: 'pay_9', amount: 3000 },
        timeoutMs: CONFIRM_TIMEOUT_MS,
      },
    })
  })

  it('confirmOrder waits longer than the client default (15 s): the backend holds the call for the provider, up to 30 s', async () => {
    expect(CONFIRM_TIMEOUT_MS).toBe(45_000)
    const { client, calls } = fakeClient()
    await createPaymentLedgerApi(client, { confirmTimeoutMs: 60_000 }).confirmOrder('ord_1', {
      providerPaymentId: 'p',
      amount: 1,
    })
    expect(calls[0]?.request?.timeoutMs).toBe(60_000)
  })

  it('only confirmOrder gets the long timeout', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentLedgerApi(client)
    await api.abandonOrder('o')
    await api.withdrawRefund('r')
    await api.createOrder({ itemType: 'a', itemRef: 'b' })
    for (const call of calls) expect(call.request?.timeoutMs).toBeUndefined()
  })

  it('abandonOrder → POST /orders/{id}/abandon', async () => {
    const { client, calls } = fakeClient()
    await createPaymentLedgerApi(client).abandonOrder('ord_1')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/payments/orders/ord_1/abandon',
      request: { method: 'POST' },
    })
  })

  it('getOrder → GET /orders/{id}; ids are path-encoded', async () => {
    const { client, calls } = fakeClient()
    await createPaymentLedgerApi(client).getOrder('a/b c')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/payments/orders/a%2Fb%20c',
      request: undefined,
    })
  })

  it('listOrders → cursor GET /orders with only the params given', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentLedgerApi(client)
    await api.listOrders()
    await api.listOrders({ cursor: 'c1', size: 5 })
    expect(calls[0]).toEqual({ kind: 'cursor', path: '/payments/orders', request: { params: {} } })
    expect(calls[1]).toEqual({
      kind: 'cursor',
      path: '/payments/orders',
      request: { params: { cursor: 'c1', size: 5 } },
    })
  })

  it('requestRefund → POST /orders/{id}/refund-requests with body and an Idempotency-Key', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentLedgerApi(client)
    await api.requestRefund(
      'ord_1',
      { reasonCode: 'CUSTOMER_REQUEST', amount: 1000 },
      { idempotencyKey: 'k-2' },
    )
    await api.requestRefund('ord_1', { reasonCode: 'DUPLICATE' })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/payments/orders/ord_1/refund-requests',
      request: {
        method: 'POST',
        json: { reasonCode: 'CUSTOMER_REQUEST', amount: 1000 },
        idempotencyKey: 'k-2',
      },
    })
    expect(calls[1]?.request?.json).toEqual({ reasonCode: 'DUPLICATE' })
    expect(calls[1]?.request?.idempotencyKey).toMatch(/^fe-/)
  })

  it('withdrawRefund → POST /refunds/{id}/withdraw', async () => {
    const { client, calls } = fakeClient()
    await createPaymentLedgerApi(client).withdrawRefund('rfd_1')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/payments/refunds/rfd_1/withdraw',
      request: { method: 'POST' },
    })
  })

  it('quote → POST /quote with the item and discounts; createOrder carries discounts in its body', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentLedgerApi(client)
    const discounts = [{ type: 'coupon' as const, ref: 'c1' }]
    await api.quote({ itemType: 'cheer', itemRef: 'cheer-3000', quantity: 2, discounts })
    await api.createOrder(
      { itemType: 'cheer', itemRef: 'cheer-3000', discounts },
      { idempotencyKey: 'k' },
    )
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/payments/quote',
      request: {
        method: 'POST',
        json: { itemType: 'cheer', itemRef: 'cheer-3000', quantity: 2, discounts },
      },
    })
    expect(calls[1]?.request).toMatchObject({ json: { discounts } })
  })
})
