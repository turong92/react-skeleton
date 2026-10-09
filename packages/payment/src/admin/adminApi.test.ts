import type { ApiRequest } from '@skeleton/api-client'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { createPaymentAdminApi, OPERATOR_REFUND_TIMEOUT_MS, type PaymentAdminApi } from './adminApi'
import type { AdminRefund } from './types'

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

describe('createPaymentAdminApi (paths and bodies mirror spec 7, operator routes)', () => {
  it('the default base path is /admin/payments; a custom one drops trailing slashes', async () => {
    const a = fakeClient()
    await createPaymentAdminApi(a.client).getOrder('ord_1')
    expect(a.calls[0]?.path).toBe('/admin/payments/orders/ord_1')
    const b = fakeClient()
    await createPaymentAdminApi(b.client, { basePath: '/ops/pay/' }).getOrder('ord_1')
    expect(b.calls[0]?.path).toBe('/ops/pay/orders/ord_1')
  })

  it('listOrders → cursor GET /orders with only the filters given (empty text and false are not sent)', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentAdminApi(client)
    await api.listOrders()
    await api.listOrders({ status: 'PAID', q: '  ord_1 ', review: true, accountId: 'acc_1' })
    await api.listOrders({ q: '', review: false, cursor: 'c1', size: 20 })
    expect(calls[0]).toEqual({
      kind: 'cursor',
      path: '/admin/payments/orders',
      request: { params: {} },
    })
    expect(calls[1]?.request).toEqual({
      params: { status: 'PAID', q: 'ord_1', review: true, accountId: 'acc_1' },
    })
    expect(calls[2]?.request).toEqual({ params: { cursor: 'c1', size: 20 } })
  })

  it('includeErased=true is sent only when on (the server hides erased accounts by default; false is the default and is not sent)', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentAdminApi(client)
    await api.listOrders({ includeErased: true, status: 'PAID' })
    await api.listOrders({ includeErased: false })
    expect(calls[0]?.request).toEqual({ params: { includeErased: true, status: 'PAID' } })
    expect(calls[1]?.request).toEqual({ params: {} })
  })

  it('getOrder → GET /orders/{id}; ids are path-encoded', async () => {
    const { client, calls } = fakeClient()
    await createPaymentAdminApi(client).getOrder('a/b c')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/admin/payments/orders/a%2Fb%20c',
      request: undefined,
    })
  })

  it('refundOrder → POST /orders/{id}/refunds with { reasonCode, amount } and an Idempotency-Key (a fresh one per call when none is given)', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentAdminApi(client)
    await api.refundOrder(
      'ord_1',
      { reasonCode: 'OPERATOR', amount: 1000 },
      { idempotencyKey: 'k-1' },
    )
    await api.refundOrder('ord_1', { reasonCode: 'DUPLICATE' })
    await api.refundOrder('ord_1', { reasonCode: 'DUPLICATE' })
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/admin/payments/orders/ord_1/refunds',
      request: {
        method: 'POST',
        json: { reasonCode: 'OPERATOR', amount: 1000 },
        idempotencyKey: 'k-1',
        timeoutMs: OPERATOR_REFUND_TIMEOUT_MS,
      },
    })
    expect(calls[1]?.request?.json).toEqual({ reasonCode: 'DUPLICATE' })
    expect(calls[1]?.request?.idempotencyKey).toMatch(/^fe-/)
    expect(calls[2]?.request?.idempotencyKey).not.toBe(calls[1]?.request?.idempotencyKey)
  })

  it('a refund and an approval wait 45 s, not the client default 15 s: the server looks the payment up and then refunds (contract 6); a custom wait wins', async () => {
    expect(OPERATOR_REFUND_TIMEOUT_MS).toBe(45_000)
    const { client, calls } = fakeClient()
    const api = createPaymentAdminApi(client, { refundTimeoutMs: 60_000 })
    await api.refundOrder('ord_1', { reasonCode: 'OPERATOR', amount: 1 })
    await api.approveRefund('rfd_1')
    await api.rejectRefund('rfd_1') // declining moves no money - the default wait
    expect(calls.map((c) => c.request?.timeoutMs)).toEqual([60_000, 60_000, undefined])
  })

  it('listRefunds → cursor GET /refunds with the status given', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentAdminApi(client)
    await api.listRefunds({ status: 'REQUESTED', cursor: 'c1' })
    await api.listRefunds()
    expect(calls[0]).toEqual({
      kind: 'cursor',
      path: '/admin/payments/refunds',
      request: { params: { status: 'REQUESTED', cursor: 'c1' } },
    })
    expect(calls[1]?.request).toEqual({ params: {} })
  })

  it('approveRefund / rejectRefund → POST /refunds/{id}/approve | reject, no body, no Idempotency-Key', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentAdminApi(client)
    await api.approveRefund('rfd_1')
    await api.rejectRefund('rfd_1')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/admin/payments/refunds/rfd_1/approve',
      request: { method: 'POST', timeoutMs: OPERATOR_REFUND_TIMEOUT_MS },
    })
    expect(calls[1]).toEqual({
      kind: 'value',
      path: '/admin/payments/refunds/rfd_1/reject',
      request: { method: 'POST' },
    })
  })

  it('syncOrder → POST /orders/{id}/sync', async () => {
    const { client, calls } = fakeClient()
    await createPaymentAdminApi(client).syncOrder('ord_1')
    expect(calls[0]).toEqual({
      kind: 'value',
      path: '/admin/payments/orders/ord_1/sync',
      request: { method: 'POST' },
    })
  })

  it('listWebhookEvents → cursor GET /webhook-events; retryWebhookEvent → POST /webhook-events/{id}/retry (numeric ids too)', async () => {
    const { client, calls } = fakeClient()
    const api = createPaymentAdminApi(client)
    await api.listWebhookEvents({ status: 'FAILED', size: 10 })
    await api.retryWebhookEvent(42)
    expect(calls[0]).toEqual({
      kind: 'cursor',
      path: '/admin/payments/webhook-events',
      request: { params: { status: 'FAILED', size: 10 } },
    })
    expect(calls[1]).toEqual({
      kind: 'value',
      path: '/admin/payments/webhook-events/42/retry',
      request: { method: 'POST' },
    })
  })
})

describe('what the operator calls answer with (the operator routes send the operator form of a refund line)', () => {
  it('a refund, an approval and a rejection answer with the AdminRefund line (failureCode, requestedBy, decidedBy ...), not the user form; an inbox id is a number', () => {
    expectTypeOf<ReturnType<PaymentAdminApi['refundOrder']>>().toEqualTypeOf<Promise<AdminRefund>>()
    expectTypeOf<ReturnType<PaymentAdminApi['approveRefund']>>().toEqualTypeOf<
      Promise<AdminRefund>
    >()
    expectTypeOf<ReturnType<PaymentAdminApi['rejectRefund']>>().toEqualTypeOf<
      Promise<AdminRefund>
    >()
    expectTypeOf<Parameters<PaymentAdminApi['retryWebhookEvent']>[0]>().toEqualTypeOf<number>()
  })
})
