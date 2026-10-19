import { ApiRequestError } from '@skeleton/api-client'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { createIntentKeys } from '../intentKeys'
import { paymentKeys } from '../queries'
import { adminRefund as refund } from '../test/fixtures'
import { statusWhileReReading } from '../test/refetchGuard'
import type { PaymentAdminApi } from './adminApi'
import {
  adminKeys,
  adminOrderQuery,
  adminOrdersQuery,
  adminRefundRequestsQuery,
  adminWebhookEventsQuery,
  approveRefundMutation,
  refundOrderMutation,
  rejectRefundMutation,
  retryWebhookEventMutation,
  syncOrderMutation,
} from './adminQueries'
import { RefundNotDoneError } from './refundOutcome'

vi.hoisted(() => {
  Object.assign(globalThis, {
    window: { addEventListener: () => undefined, removeEventListener: () => undefined },
  })
})

function fakeApi() {
  const calls: Array<[string, ...unknown[]]> = []
  const record =
    (name: string, reply: unknown = {}) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args])
      return reply as never
    }
  const page = { values: [], cursor: { hasNext: false }, meta: { timestamp: 't' } }
  const api: PaymentAdminApi = {
    listOrders: record('listOrders', page),
    getOrder: record('getOrder'),
    refundOrder: record('refundOrder'),
    listRefunds: record('listRefunds', page),
    approveRefund: record('approveRefund'),
    rejectRefund: record('rejectRefund'),
    syncOrder: record('syncOrder'),
    closeSubscriptionCharge: record('closeSubscriptionCharge'),
    listWebhookEvents: record('listWebhookEvents', page),
    retryWebhookEvent: record('retryWebhookEvent'),
  }
  return { api, calls }
}

describe('adminKeys — under the payment root, so one invalidation of the root covers both sides', () => {
  it('every operator key starts with the payment root and the admin branch', () => {
    for (const key of [
      adminKeys.orders({ review: true }),
      adminKeys.order('ord_1'),
      adminKeys.refunds({ status: 'REQUESTED' }),
      adminKeys.webhookEvents({}),
    ])
      expect(key.slice(0, 2)).toEqual([...paymentKeys.all, 'admin'])
    expect(adminKeys.order('a')).not.toEqual(adminKeys.order('b'))
    expect(adminKeys.orders({ review: true })).not.toEqual(adminKeys.orders({}))
  })
})

describe('query definitions ask the api for exactly their inputs', () => {
  it('orders / order / refund requests / webhook events, continuing from the cursor', async () => {
    const { api, calls } = fakeApi()
    const list = adminOrdersQuery(api, { review: true, size: 20 })
    expect(list.queryKey).toEqual(adminKeys.orders({ review: true, size: 20 }))
    await list.queryFn({ pageParam: 'c1' })
    await list.queryFn({ pageParam: undefined })
    await adminOrderQuery(api, 'ord_1').queryFn()
    await adminRefundRequestsQuery(api, { size: 10 }).queryFn({ pageParam: 'c2' })
    await adminWebhookEventsQuery(api, { status: 'FAILED' }).queryFn({ pageParam: undefined })
    expect(calls).toEqual([
      ['listOrders', { review: true, size: 20, cursor: 'c1' }],
      ['listOrders', { review: true, size: 20 }],
      ['getOrder', 'ord_1'],
      ['listRefunds', { status: 'REQUESTED', size: 10, cursor: 'c2' }],
      ['listWebhookEvents', { status: 'FAILED' }],
    ])
  })

  it('the refund request list asks for REQUESTED unless told otherwise', async () => {
    const { api, calls } = fakeApi()
    await adminRefundRequestsQuery(api).queryFn({ pageParam: undefined })
    expect(calls).toEqual([['listRefunds', { status: 'REQUESTED' }]])
  })

  it('every list stops when the page says there is no next one', () => {
    const { api } = fakeApi()
    const page = (nextCursor: string | null, hasNext: boolean) => ({
      values: [],
      cursor: { nextCursor, hasNext },
      meta: { timestamp: 't' },
    })
    for (const query of [
      adminOrdersQuery(api),
      adminRefundRequestsQuery(api),
      adminWebhookEventsQuery(api),
    ]) {
      expect(query.initialPageParam).toBeUndefined()
      expect(query.getNextPageParam(page('c2', true))).toBe('c2')
      expect(query.getNextPageParam(page(null, false))).toBeUndefined()
    }
  })
})

async function run<V>(
  options: { mutationFn: (v: V) => Promise<unknown>; [k: string]: unknown },
  client: QueryClient,
  variables: V,
) {
  const observer = new MutationObserver(client, options as never)
  await observer.mutate(variables as never).catch(() => undefined)
}

describe('mutations change the ledger, so they refresh the whole payment root (the person who asked sees it too)', () => {
  it('approve / reject / sync / retry call their route and invalidate the root when they succeed', async () => {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await run(approveRefundMutation(api, client), client, 'rfd_1')
    await run(approveRefundMutation(api, client), client, { id: 'rfd_3', amount: 1500 })
    await run(rejectRefundMutation(api, client), client, 'rfd_2')
    await run(syncOrderMutation(api, client), client, 'ord_1')
    await run(retryWebhookEventMutation(api, client), client, 7)
    expect(calls).toEqual([
      ['approveRefund', 'rfd_1'],
      ['approveRefund', 'rfd_3', 1500],
      ['rejectRefund', 'rfd_2'],
      ['syncOrder', 'ord_1'],
      ['retryWebhookEvent', 7],
    ])
    expect(spy).toHaveBeenCalledTimes(5)
    for (const call of spy.mock.calls) expect(call[0]).toEqual({ queryKey: paymentKeys.all })
  })

  it('an approval that fails still refreshes (a 402 or a lost answer may have moved the refund)', async () => {
    const { api } = fakeApi()
    api.approveRefund = async () => {
      throw new Error('402')
    }
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await run(approveRefundMutation(api, client), client, 'rfd_1')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('a direct refund sends the same Idempotency-Key for the same intent until it succeeds, a new one for a different amount', async () => {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    let n = 0
    const keys = createIntentKeys({ make: () => `k-${++n}` })
    const options = refundOrderMutation(api, client, keys)
    const input = { orderId: 'ord_1', reasonCode: 'OPERATOR' as const, amount: 1000 }
    api.refundOrder = async (...args) => {
      calls.push(['refundOrder', ...args])
      throw new Error('lost')
    }
    await run(options, client, { ...input })
    await run(options, client, { ...input })
    await run(options, client, { ...input, amount: 500 })
    const sent = calls.map((c) => [(c[3] as { idempotencyKey: string }).idempotencyKey, c[2]])
    expect(sent).toEqual([
      ['k-1', { reasonCode: 'OPERATOR', amount: 1000 }],
      ['k-1', { reasonCode: 'OPERATOR', amount: 1000 }],
      ['k-2', { reasonCode: 'OPERATOR', amount: 500 }],
    ])
  })

  it('turning "end the subscription too" off is another intent - the server refuses the same key with another choice', async () => {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    let n = 0
    const options = refundOrderMutation(api, client, createIntentKeys({ make: () => `k-${++n}` }))
    const input = { orderId: 'ord_1', reasonCode: 'OPERATOR' as const, amount: 1000 }
    api.refundOrder = async (...args) => {
      calls.push(['refundOrder', ...args])
      throw new Error('lost')
    }
    await run(options, client, { ...input })
    await run(options, client, { ...input, endSubscription: false })
    await run(options, client, { ...input, endSubscription: false })
    expect(calls.map((c) => (c[3] as { idempotencyKey: string }).idempotencyKey)).toEqual([
      'k-1',
      'k-2',
      'k-2',
    ])
    expect(calls[1]?.[2]).toEqual({ reasonCode: 'OPERATOR', amount: 1000, endSubscription: false })
  })

  it('an approval with the choice off sends it, and one without sends nothing extra', async () => {
    const { api } = fakeApi()
    const seen: unknown[][] = []
    api.approveRefund = async (...args) => {
      seen.push(args)
      return refund({ status: 'SUCCEEDED' }) as never
    }
    const client = new QueryClient()
    await run(approveRefundMutation(api, client), client, { id: 'rfd_1', endSubscription: false })
    await run(approveRefundMutation(api, client), client, { id: 'rfd_2', amount: 500 })
    await run(approveRefundMutation(api, client), client, 'rfd_3')
    expect(seen).toEqual([['rfd_1', undefined, false], ['rfd_2', 500], ['rfd_3']])
  })

  it('a succeeded direct refund lets go of its key (the next one is a new intent) and refreshes the root', async () => {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    let n = 0
    const options = refundOrderMutation(api, client, createIntentKeys({ make: () => `k-${++n}` }))
    const input = { orderId: 'ord_1', reasonCode: 'OPERATOR' as const, amount: 1000 }
    await run(options, client, { ...input })
    await run(options, client, { ...input })
    expect(calls.map((c) => (c[3] as { idempotencyKey: string }).idempotencyKey)).toEqual([
      'k-1',
      'k-2',
    ])
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

const answered = (status: number, code: string) =>
  new ApiRequestError({ code, title: 't', status, timestamp: 't', traceId: 'tr' }, 'tr', 'sp', 'tp')

/** 같은 입력을 두 번 누르고, 두 번째에 쓰인 키가 첫 번째와 같은지(= 키를 든 채였는지) 본다 */
async function pressTwice(first: () => Promise<unknown>) {
  const { api, calls } = fakeApi()
  const client = new QueryClient()
  let n = 0
  const options = refundOrderMutation(api, client, createIntentKeys({ make: () => `k-${++n}` }))
  const input = { orderId: 'ord_1', reasonCode: 'OPERATOR' as const, amount: 1000 }
  let attempt = 0
  api.refundOrder = async (...args) => {
    calls.push(['refundOrder', ...args])
    if (++attempt === 1) return (await first()) as never
    return refund({ status: 'SUCCEEDED' })
  }
  await run(options, client, { ...input })
  await run(options, client, { ...input })
  return calls.map((c) => (c[3] as { idempotencyKey: string }).idempotencyKey)
}

describe('a direct refund keeps its key only while the outcome is unknown (review I3)', () => {
  it('after an answer that settles it - 402 declined, 400, 409, 503 unavailable - pressing again is a new refund line with a new key', async () => {
    for (const [status, code] of [
      [402, 'PAYMENT.REFUND_DECLINED'],
      [400, 'PAYMENT.REFUND_AMOUNT_EXCEEDED'],
      [409, 'PAYMENT.REFUND_NOT_ALLOWED'],
      [409, 'PAYMENT.REFUND_IN_PROGRESS'],
      [503, 'PAYMENT.UNAVAILABLE'],
    ] as const) {
      const keys = await pressTwice(async () => {
        throw answered(status, code)
      })
      expect(keys, code).toEqual(['k-1', 'k-2'])
    }
  })

  it('after a lost answer - network, timeout, 5xx - the same key goes out again, so a refund the server already made is returned, not repeated', async () => {
    for (const error of [
      new TypeError('network'),
      answered(500, 'COMMON.INTERNAL'),
      answered(504, 'COMMON.TIMEOUT'),
      answered(502, 'PAYMENT.PROVIDER_ERROR'),
    ])
      expect(
        await pressTwice(async () => {
          throw error
        }),
        String(error),
      ).toEqual(['k-1', 'k-1'])
  })

  it('a 200 that returns the refund line FAILED or REJECTED (the same key sent again) is a failure, not a success - and the key is let go', async () => {
    for (const status of ['FAILED', 'REJECTED'] as const) {
      const { api } = fakeApi()
      api.refundOrder = async () => refund({ status })
      const client = new QueryClient()
      const options = refundOrderMutation(api, client, createIntentKeys())
      await expect(
        options.mutationFn({ orderId: 'ord_1', reasonCode: 'OPERATOR', amount: 1000 }),
      ).rejects.toBeInstanceOf(RefundNotDoneError)
      const keys = await pressTwice(async () => refund({ status }))
      expect(keys, status).toEqual(['k-1', 'k-2'])
    }
  })

  it('SUCCEEDED and PENDING lines are a success (PENDING reads 환불 중 on the screen)', async () => {
    for (const status of ['SUCCEEDED', 'PENDING'] as const) {
      const { api } = fakeApi()
      api.refundOrder = async () => refund({ status })
      const options = refundOrderMutation(api, new QueryClient(), createIntentKeys())
      await expect(
        options.mutationFn({ orderId: 'ord_1', reasonCode: 'OPERATOR', amount: 1000 }),
      ).resolves.toMatchObject({ status })
    }
  })
})

describe('an unknown result keeps its key past the 10 minute age limit (review I-2, third path)', () => {
  async function pressAfter(waitMs: number, first: () => Promise<unknown>) {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    let n = 0
    let clock = 0
    const keys = createIntentKeys({ make: () => `k-${++n}`, now: () => clock })
    const options = refundOrderMutation(api, client, keys)
    const input = { orderId: 'ord_1', reasonCode: 'OPERATOR' as const, amount: 1000 }
    let attempt = 0
    api.refundOrder = async (...args) => {
      calls.push(['refundOrder', ...args])
      if (++attempt === 1) return (await first()) as never
      return refund({ status: 'SUCCEEDED' })
    }
    await run(options, client, { ...input })
    clock += waitMs
    await run(options, client, { ...input })
    return calls.map((c) => (c[3] as { idempotencyKey: string }).idempotencyKey)
  }

  it('after a lost answer, the same input an hour later still goes out with the first key - the server may have made that refund', async () => {
    expect(
      await pressAfter(60 * 60_000, async () => {
        throw new TypeError('network')
      }),
    ).toEqual(['k-1', 'k-1'])
  })

  it('a key that was not unknown is not held: it is gone as soon as the verdict came', async () => {
    expect(
      await pressAfter(60 * 60_000, async () => {
        throw answered(503, 'PAYMENT.UNAVAILABLE')
      }),
    ).toEqual(['k-1', 'k-2'])
  })
})

describe('approving a request reads the returned line the same way', () => {
  it('a line that is not refunded (FAILED, REJECTED) is a failure; SUCCEEDED and PENDING pass', async () => {
    for (const status of ['FAILED', 'REJECTED'] as const) {
      const { api } = fakeApi()
      api.approveRefund = async () => refund({ status })
      await expect(
        approveRefundMutation(api, new QueryClient()).mutationFn('rfd_1'),
      ).rejects.toBeInstanceOf(RefundNotDoneError)
    }
    for (const status of ['SUCCEEDED', 'PENDING'] as const) {
      const { api } = fakeApi()
      api.approveRefund = async () => refund({ status })
      await expect(
        approveRefundMutation(api, new QueryClient()).mutationFn('rfd_1'),
      ).resolves.toMatchObject({ status })
    }
  })
})

describe('a change stays pending until the re-read it started has finished (a refund that went out must not be repeatable from the stale screen)', () => {
  it.each([
    ['refundOrder', refundOrderMutation, { orderId: 'o', reasonCode: 'OPERATOR', amount: 1000 }],
    ['approveRefund', approveRefundMutation, 'rfd_1'],
    ['rejectRefund', rejectRefundMutation, 'rfd_1'],
    ['syncOrder', syncOrderMutation, 'o'],
    ['retryWebhookEvent', retryWebhookEventMutation, 7],
  ] as const)(
    '%s is pending while the root is re-read, and done once it is',
    async (_name, build, variables) => {
      const { api } = fakeApi()
      const client = new QueryClient()
      const states = await statusWhileReReading(
        client,
        build(api, client) as never,
        variables as never,
      )
      expect(states).toEqual({ whileReading: 'pending', after: 'success' })
    },
  )
})
