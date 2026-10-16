import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PaymentLedgerApi } from './ledgerApi'
import type { Order, OrderStatus } from './ledgerTypes'
import { refund } from './test/fixtures'
import { ApiRequestError } from '@skeleton/api-client'
import { createIntentKeys } from './intentKeys'
import { statusWhileReReading } from './test/refetchGuard'
import {
  abandonOrderMutation,
  CONFIRM_RETRY_LIMIT,
  confirmOrderMutation,
  confirmRetryDelay,
  createOrderMutation,
  ORDER_POLL_MAX_DURATION_MS,
  ORDER_POLL_MAX_MS,
  ORDER_POLL_MIN_MS,
  orderPollInterval,
  orderQuery,
  ordersQuery,
  paymentConfigQuery,
  paymentKeys,
  RefundRequestNotOpenError,
  requestRefundMutation,
  withdrawRefundMutation,
} from './queries'

// TanStack Query 는 모듈을 읽을 때 `window` 가 없으면 서버로 보고 되묻기 타이머를 만들지 않는다 — 읽기 전에 가짜 window 를 세운다
vi.hoisted(() => {
  Object.assign(globalThis, {
    window: { addEventListener: () => undefined, removeEventListener: () => undefined },
  })
})

const order = (status: OrderStatus): Order => ({
  id: 'ord_1',
  status,
  kind: 'ONE_TIME',
  itemType: 'cheer',
  itemRef: 'cheer-3000',
  quantity: 1,
  orderName: '응원하기 3,000원',
  amount: { amount: 3000, currency: 'KRW' },
  refundedAmount: 0,
  refundableAmount: 0,
  refundPending: false,
  openRefundStatus: null,
  method: null,
  card: null,
  testMode: true,
  failureCode: null,
  createdAt: '2026-10-08T00:00:00Z',
  paidAt: null,
  fulfilled: false,
})

function fakeApi() {
  const calls: Array<[string, ...unknown[]]> = []
  const api: PaymentLedgerApi = {
    config: async () => {
      calls.push(['config'])
      return { available: true, testMode: true, refundRequestsEnabled: true }
    },
    createOrder: async (input, options) => {
      calls.push(['createOrder', input, options])
      return { order: order('PENDING'), checkout: {} as never }
    },
    confirmOrder: async (id, body) => {
      calls.push(['confirmOrder', id, body])
      return order('CONFIRMING')
    },
    abandonOrder: async (id) => {
      calls.push(['abandonOrder', id])
      return order('CANCELED')
    },
    getOrder: async (id) => {
      calls.push(['getOrder', id])
      return { order: order('PAID'), refunds: [] }
    },
    listOrders: async (params) => {
      calls.push(['listOrders', params])
      return { values: [order('PAID')], cursor: { hasNext: false }, meta: { timestamp: 't' } }
    },
    requestRefund: async (id, body, options) => {
      calls.push(['requestRefund', id, body, options])
      return refund({ orderId: id }) // 요청이 받아들여지면 줄은 `REQUESTED`
    },
    withdrawRefund: async (id) => {
      calls.push(['withdrawRefund', id])
      return {} as never
    },
  }
  return { api, calls }
}

describe('paymentKeys — one root', () => {
  it('every key starts with the root so one invalidation covers config, orders and each order', () => {
    expect(paymentKeys.all).toEqual(['payment'])
    for (const key of [
      paymentKeys.config(),
      paymentKeys.orders(),
      paymentKeys.orderList({ size: 5 }),
      paymentKeys.order('ord_1'),
    ])
      expect(key.slice(0, 1)).toEqual(['payment'])
    expect(paymentKeys.order('a')).not.toEqual(paymentKeys.order('b'))
  })
})

describe('query definitions ask the api for exactly their inputs', () => {
  it('config / order / orders', async () => {
    const { api, calls } = fakeApi()
    await paymentConfigQuery(api).queryFn()
    const q = orderQuery(api, 'ord_1')
    expect(q.queryKey).toEqual(paymentKeys.order('ord_1'))
    await q.queryFn()
    const list = ordersQuery(api, { size: 10 })
    expect(list.queryKey).toEqual(paymentKeys.orderList({ size: 10 }))
    await list.queryFn({ pageParam: 'c1' })
    await list.queryFn({ pageParam: undefined })
    expect(calls).toEqual([
      ['config'],
      ['getOrder', 'ord_1'],
      ['listOrders', { size: 10, cursor: 'c1' }],
      ['listOrders', { size: 10 }],
    ])
  })

  it('the order list continues from the cursor and stops when there is no next page', () => {
    const { api } = fakeApi()
    const { getNextPageParam, initialPageParam } = ordersQuery(api)
    expect(initialPageParam).toBeUndefined()
    const page = (nextCursor: string | null, hasNext: boolean) => ({
      values: [],
      cursor: { nextCursor, hasNext },
      meta: { timestamp: 't' },
    })
    expect(getNextPageParam(page('c2', true))).toBe('c2')
    expect(getNextPageParam(page(null, false))).toBeUndefined()
    expect(getNextPageParam(page('c9', false))).toBeUndefined()
  })
})

describe('orderPollInterval — ask again only while CONFIRMING, with growing gaps', () => {
  it('stops (false) for every state that is not CONFIRMING, and before anything is loaded', () => {
    const others: OrderStatus[] = [
      'PENDING',
      'PAID',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
      'FAILED',
      'EXPIRED',
      'CANCELED',
    ]
    for (const status of others) expect(orderPollInterval(status, 3), status).toBe(false)
    expect(orderPollInterval(undefined, 0)).toBe(false)
    expect(orderPollInterval('CONFIRMING', 0)).toBeGreaterThan(0)
  })

  it('while CONFIRMING the gap grows with each answer and is capped', () => {
    const gaps = [1, 2, 3, 4, 5, 20].map((n) => orderPollInterval('CONFIRMING', n))
    expect(gaps[0]).toBeGreaterThan(0)
    for (let i = 1; i < 5; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1] as number)
    expect(gaps[1]).toBeGreaterThan(gaps[0] as number)
    expect(gaps[5]).toBe(ORDER_POLL_MAX_MS)
  })

  it('wired into the query: refetchInterval reads the loaded data', () => {
    const { api } = fakeApi()
    const interval = orderQuery(api, 'ord_1').refetchInterval
    const query = (status: OrderStatus | null, dataUpdatedAt = Date.now()) => ({
      state: {
        data: status ? { order: order(status), refunds: [] } : undefined,
        dataUpdatedAt,
        errorUpdatedAt: 0,
      },
    })
    expect(interval(query('CONFIRMING') as never)).toBe(ORDER_POLL_MIN_MS)
    expect(interval(query('PAID') as never)).toBe(false)
    expect(interval(query(null, 0) as never)).toBe(false)
  })
})

describe('polling a CONFIRMING order over time (real QueryObserver, fake timers)', () => {
  afterEach(() => vi.useRealTimers())

  function watch(statuses: OrderStatus[], options?: { maxPollMs?: number }) {
    vi.useFakeTimers()
    const { api } = fakeApi()
    let asked = 0
    api.getOrder = async () => ({
      order: order(statuses[Math.min(asked++, statuses.length - 1)] as OrderStatus),
      refunds: [],
    })
    const client = new QueryClient()
    const observer = new QueryObserver(client, orderQuery(api, 'ord_1', options) as never)
    const stop = observer.subscribe(() => undefined)
    return { client, asked: () => asked, stop }
  }

  it('CONFIRMING, CONFIRMING, PAID: asks after 1 s, then 2 s, and never again once PAID', async () => {
    const w = watch(['CONFIRMING', 'CONFIRMING', 'PAID'])
    await vi.advanceTimersByTimeAsync(0)
    expect(w.asked()).toBe(1)
    await vi.advanceTimersByTimeAsync(ORDER_POLL_MIN_MS - 1)
    expect(w.asked()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(w.asked()).toBe(2)
    await vi.advanceTimersByTimeAsync(2 * ORDER_POLL_MIN_MS - 1)
    expect(w.asked()).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(w.asked()).toBe(3)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(w.asked()).toBe(3)
    w.stop()
  })

  it('an earlier PENDING answer (or an invalidation) does not shorten the first gap', async () => {
    const w = watch(['PENDING', 'CONFIRMING', 'CONFIRMING'])
    await vi.advanceTimersByTimeAsync(0)
    expect(w.asked()).toBe(1)
    await vi.advanceTimersByTimeAsync(60_000) // PENDING is not polled
    expect(w.asked()).toBe(1)
    void w.client.invalidateQueries({ queryKey: paymentKeys.all })
    await vi.advanceTimersByTimeAsync(0)
    expect(w.asked()).toBe(2) // CONFIRMING arrives
    await vi.advanceTimersByTimeAsync(ORDER_POLL_MIN_MS - 1)
    expect(w.asked()).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(w.asked()).toBe(3)
    w.stop()
  })

  it('stops after maxPollMs of CONFIRMING (default 5 minutes) instead of asking forever', async () => {
    expect(ORDER_POLL_MAX_DURATION_MS).toBe(5 * 60_000)
    const w = watch(['CONFIRMING'], { maxPollMs: 5_000 })
    await vi.advanceTimersByTimeAsync(60_000)
    const settled = w.asked()
    expect(settled).toBeGreaterThan(2)
    expect(settled).toBeLessThan(8) // 1 s, 2 s, 4 s gaps: answers at 0, 1, 3, 7 s
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(w.asked()).toBe(settled)
    w.stop()
  })
})

describe('mutations — a change invalidates the single root', () => {
  async function run<V, R>(
    build: (api: PaymentLedgerApi, client: QueryClient) => unknown,
    vars: V,
  ): Promise<{ invalidated: unknown[]; calls: Array<[string, ...unknown[]]>; result: R }> {
    const { api, calls } = fakeApi()
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const observer = new MutationObserver(client, build(api, client) as never)
    const result = (await observer.mutate(vars as never)) as R
    return { invalidated: spy.mock.calls.map(([filters]) => filters?.queryKey), calls, result }
  }

  it('createOrder passes the idempotency key apart from the item and leaves the caches alone (a PENDING attempt is in no list)', async () => {
    const { invalidated, calls } = await run(createOrderMutation, {
      itemType: 'cheer',
      itemRef: 'cheer-3000',
      idempotencyKey: 'k-1',
    })
    expect(calls).toEqual([
      ['createOrder', { itemType: 'cheer', itemRef: 'cheer-3000' }, { idempotencyKey: 'k-1' }],
    ])
    expect(invalidated).toEqual([])
  })

  it('confirmOrder / abandonOrder / requestRefund / withdrawRefund call the api and invalidate the root', async () => {
    const confirm = await run(confirmOrderMutation, {
      orderId: 'ord_1',
      providerPaymentId: 'pay_1',
      amount: 3000,
    })
    expect(confirm.calls).toEqual([
      ['confirmOrder', 'ord_1', { providerPaymentId: 'pay_1', amount: 3000 }],
    ])
    expect(confirm.invalidated).toEqual([paymentKeys.all])

    const abandon = await run(abandonOrderMutation, 'ord_1')
    expect(abandon.calls).toEqual([['abandonOrder', 'ord_1']])
    expect(abandon.invalidated).toEqual([paymentKeys.all])

    const refund = await run(requestRefundMutation, {
      orderId: 'ord_1',
      reasonCode: 'CUSTOMER_REQUEST',
      idempotencyKey: 'k-2',
    })
    expect(refund.calls).toEqual([
      ['requestRefund', 'ord_1', { reasonCode: 'CUSTOMER_REQUEST' }, { idempotencyKey: 'k-2' }],
    ])
    expect(refund.invalidated).toEqual([paymentKeys.all])

    const withdraw = await run(withdrawRefundMutation, 'rfd_1')
    expect(withdraw.calls).toEqual([['withdrawRefund', 'rfd_1']])
    expect(withdraw.invalidated).toEqual([paymentKeys.all])
  })

  async function failing(
    build: (api: PaymentLedgerApi, client: QueryClient) => unknown,
    method: 'confirmOrder' | 'abandonOrder' | 'requestRefund' | 'withdrawRefund' | 'createOrder',
    vars: unknown,
    error: Error = new Error('boom'),
  ) {
    const { api } = fakeApi()
    api[method] = async () => {
      throw error
    }
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const observer = new MutationObserver(client, build(api, client) as never)
    await expect(observer.mutate(vars as never)).rejects.toThrow(error.message)
    return spy.mock.calls.map(([filters]) => filters?.queryKey)
  }

  it('a failed confirm or abandon still invalidates: the answer was lost or a 402, the server may have moved on', async () => {
    // a 402 is a confirmed answer, so the call is not sent again (an unknown result is: see below)
    const confirm = await failing(
      confirmOrderMutation,
      'confirmOrder',
      { orderId: 'o', providerPaymentId: 'p', amount: 1 },
      new ApiRequestError(
        { code: 'PAYMENT.DECLINED', title: 'declined', status: 402, timestamp: 't' },
        'tr',
        'sp',
        'tp',
      ),
    )
    expect(confirm).toEqual([paymentKeys.all])
    expect(await failing(abandonOrderMutation, 'abandonOrder', 'o')).toEqual([paymentKeys.all])
  })

  it('a failed withdraw still invalidates: a 409/404 means the request was already decided, and the screen must read it again', async () => {
    expect(await failing(withdrawRefundMutation, 'withdrawRefund', 'r')).toEqual([paymentKeys.all])
  })

  it('a failed refund request still invalidates (a 409 / 400 says the screen was stale; the answer may also have been lost), a failed order creation leaves the caches alone', async () => {
    expect(
      await failing(requestRefundMutation, 'requestRefund', {
        orderId: 'o',
        reasonCode: 'DUPLICATE',
      }),
    ).toEqual([paymentKeys.all])
    expect(
      await failing(createOrderMutation, 'createOrder', { itemType: 'a', itemRef: 'b' }),
    ).toEqual([])
  })
})

describe('requestRefundMutation — an answer whose line was closed without a refund is not a request that went through (R2-m4, R3-I1)', () => {
  const input = { orderId: 'ord_1', reasonCode: 'CUSTOMER_REQUEST' as const }

  it.each(['FAILED', 'REJECTED', 'WITHDRAWN'] as const)(
    'a 2xx answer with a %s line (a held key replayed after the line was closed) fails instead of closing the window as a success',
    async (status) => {
      const { api } = fakeApi()
      api.requestRefund = async () => refund({ status })
      const client = new QueryClient()
      const observer = new MutationObserver(
        client,
        requestRefundMutation(api, client, createIntentKeys()) as never,
      )
      await expect(observer.mutate(input as never)).rejects.toBeInstanceOf(
        RefundRequestNotOpenError,
      )
    },
  )

  // 운영자가 이미 환불했거나(SUCCEEDED) 나가는 중(PENDING)인 줄은 닫힌 요청이 아니다 - 창이 닫히고 다시 읽은 화면이 사실을 말한다
  it.each(['SUCCEEDED', 'PENDING'] as const)(
    'a 2xx answer with a %s line (the request went on to be refunded) is the success it looks like: the window closes and the re-read list tells the money',
    async (status) => {
      const { api } = fakeApi()
      api.requestRefund = async () => refund({ status })
      const client = new QueryClient()
      const observer = new MutationObserver(
        client,
        requestRefundMutation(api, client, createIntentKeys()) as never,
      )
      await expect(observer.mutate(input as never)).resolves.toMatchObject({ status })
    },
  )

  it('the failure releases the held key: pressing again is a new request with a new key, not the same closed line again', async () => {
    const { api, calls } = fakeApi()
    let answer: 'CLOSED' | 'OPEN' = 'CLOSED'
    api.requestRefund = async (_id, _body, options) => {
      calls.push(['requestRefund', options])
      return refund({ status: answer === 'CLOSED' ? 'REJECTED' : 'REQUESTED' })
    }
    const client = new QueryClient()
    const observer = new MutationObserver(
      client,
      requestRefundMutation(api, client, createIntentKeys()) as never,
    )
    await expect(observer.mutate({ ...input } as never)).rejects.toBeInstanceOf(
      RefundRequestNotOpenError,
    )
    answer = 'OPEN'
    await observer.mutate({ ...input } as never)
    const [first, second] = calls.map(
      ([, options]) => (options as { idempotencyKey: string }).idempotencyKey,
    )
    expect(second).not.toBe(first)
  })

  it('a waiting line is the success it always was', async () => {
    const { api } = fakeApi()
    api.requestRefund = async () => refund({ status: 'REQUESTED' })
    const client = new QueryClient()
    const observer = new MutationObserver(client, requestRefundMutation(api, client) as never)
    await expect(observer.mutate(input as never)).resolves.toMatchObject({ status: 'REQUESTED' })
  })
})

describe('confirmOrderMutation — a result we do not know is sent again, a verdict is not', () => {
  const answered = (status: number, code: string) =>
    new ApiRequestError({ code, title: 't', status, timestamp: 't' }, 'tr', 'sp', 'tp')
  const lostAnswer = () => answered(0, 'CLIENT.NETWORK_ERROR')
  const confirm = { orderId: 'ord_1', providerPaymentId: 'pay_1', amount: 3000 }

  it('the retry rule: unknown results up to the limit, never a confirmed "no"', () => {
    const { api } = fakeApi()
    const { retry } = confirmOrderMutation(api, new QueryClient())
    expect(retry(0, lostAnswer())).toBe(true)
    expect(retry(0, answered(502, 'PAYMENT.PROVIDER_ERROR'))).toBe(true)
    expect(retry(0, answered(401, 'AUTH.UNAUTHORIZED'))).toBe(true)
    expect(retry(CONFIRM_RETRY_LIMIT - 1, lostAnswer())).toBe(true)
    expect(retry(CONFIRM_RETRY_LIMIT, lostAnswer())).toBe(false)
    for (const verdict of [
      answered(402, 'PAYMENT.DECLINED'),
      answered(400, 'PAYMENT.AMOUNT_MISMATCH'),
      answered(409, 'PAYMENT.MODE_MISMATCH'),
      answered(409, 'PAYMENT.ORDER_NOT_PAYABLE'),
      answered(404, 'PAYMENT.ORDER_NOT_FOUND'),
    ])
      expect(retry(0, verdict), verdict.apiError.code).toBe(false)
  })

  it('the gap doubles from one second and stops at ten seconds', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(confirmRetryDelay)).toEqual([
      1_000, 2_000, 4_000, 8_000, 10_000, 10_000, 10_000,
    ])
  })

  describe('over time (real MutationObserver, fake timers)', () => {
    afterEach(() => vi.useRealTimers())

    function run(outcomes: Array<'lost' | 'ok' | Error>) {
      vi.useFakeTimers()
      const { api } = fakeApi()
      let sent = 0
      api.confirmOrder = async () => {
        const outcome = outcomes[Math.min(sent++, outcomes.length - 1)]
        if (outcome === 'ok') return order('PAID')
        throw outcome === 'lost' ? lostAnswer() : outcome
      }
      const client = new QueryClient()
      const invalidate = vi.spyOn(client, 'invalidateQueries')
      const observer = new MutationObserver(client, confirmOrderMutation(api, client) as never)
      const settled = observer.mutate(confirm as never).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      )
      return { observer, settled, sent: () => sent, invalidate }
    }

    it('lost, lost, then the server answers: three requests, resolved, pending the whole time, invalidated once at the end', async () => {
      const r = run(['lost', 'lost', 'ok'])
      await vi.advanceTimersByTimeAsync(0)
      expect(r.sent()).toBe(1)
      expect(r.observer.getCurrentResult().status).toBe('pending')
      await vi.advanceTimersByTimeAsync(999)
      expect(r.sent()).toBe(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(r.sent()).toBe(2)
      await vi.advanceTimersByTimeAsync(2_000)
      expect(r.sent()).toBe(3)
      expect(await r.settled).toMatchObject({ value: { status: 'PAID' } })
      expect(r.invalidate).toHaveBeenCalledTimes(1)
    })

    it('never answered: sends once plus the retry limit, then fails with the last unknown error', async () => {
      const r = run(['lost'])
      await vi.advanceTimersByTimeAsync(5 * 60_000)
      expect(r.sent()).toBe(1 + CONFIRM_RETRY_LIMIT)
      const done = (await r.settled) as { error: unknown }
      expect(done.error).toBeInstanceOf(ApiRequestError)
      expect(r.observer.getCurrentResult().status).toBe('error')
      expect(r.invalidate).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['402 DECLINED', answered(402, 'PAYMENT.DECLINED')],
      ['400 AMOUNT_MISMATCH', answered(400, 'PAYMENT.AMOUNT_MISMATCH')],
      ['409 MODE_MISMATCH', answered(409, 'PAYMENT.MODE_MISMATCH')],
      ['409 ORDER_NOT_PAYABLE', answered(409, 'PAYMENT.ORDER_NOT_PAYABLE')],
      ['404 ORDER_NOT_FOUND', answered(404, 'PAYMENT.ORDER_NOT_FOUND')],
    ])('%s is sent once and fails at once', async (_name, verdict) => {
      const r = run([verdict])
      await vi.advanceTimersByTimeAsync(60_000)
      expect(r.sent()).toBe(1)
      expect((await r.settled) as { error: unknown }).toMatchObject({ error: verdict })
    })
  })
})

describe('intent keys through the mutations (several calls in flight)', () => {
  const cheer3 = { itemType: 'cheer', itemRef: 'cheer-3000' }
  const cheer5 = { itemType: 'cheer', itemRef: 'cheer-5000' }

  function flight() {
    const sent: Array<{ key: string | undefined; release: () => void; fail: () => void }> = []
    const { api } = fakeApi()
    api.createOrder = (_input, options) =>
      new Promise((resolve, reject) => {
        sent.push({
          key: options?.idempotencyKey,
          release: () => resolve({ order: order('PENDING'), checkout: {} as never }),
          fail: () => reject(new Error('network')),
        })
      })
    const client = new QueryClient()
    const keys = createIntentKeys()
    const observer = new MutationObserver(client, createOrderMutation(api, client, keys) as never)
    const press = (input: object) => observer.mutate(input as never).catch(() => undefined)
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
    return { sent, press, flush }
  }

  it('two presses of the same item before the first answer carry the same key', async () => {
    const f = flight()
    void f.press(cheer3)
    void f.press(cheer3)
    await f.flush()
    expect(f.sent).toHaveLength(2)
    expect(f.sent[1]?.key).toBe(f.sent[0]?.key)
    expect(f.sent[0]?.key).toMatch(/^fe-/)
  })

  it('an earlier call finishing late does not throw away the key of the intent the user has moved on to', async () => {
    const f = flight()
    const a = f.press(cheer3)
    await f.flush()
    void f.press(cheer5) // the user picked another amount while A was in flight
    await f.flush()
    f.sent[0]?.release() // A succeeds late
    await a
    f.sent[1]?.fail() // B's answer is lost …
    await f.flush()
    void f.press(cheer5) // … and the user presses B again
    await f.flush()
    expect(f.sent[2]?.key).toBe(f.sent[1]?.key)
  })

  it('the same item with another provider is another intent - a KakaoPay press never replays the Toss order of the same amount', async () => {
    const f = flight()
    void f.press({ ...cheer3, provider: 'toss' })
    void f.press({ ...cheer3, provider: 'kakaopay' })
    await f.flush()
    expect(f.sent).toHaveLength(2)
    expect(f.sent[1]?.key).not.toBe(f.sent[0]?.key)
  })

  it('an omitted quantity and an explicit 1 are two intents — the key does not guess what the server defaults to', async () => {
    const f = flight()
    void f.press(cheer3)
    void f.press({ ...cheer3, quantity: 1 })
    await f.flush()
    expect(f.sent[1]?.key).not.toBe(f.sent[0]?.key)
  })
})

describe('a change stays pending until the re-read it started has finished (the guard against a second action from a stale screen)', () => {
  it.each([
    ['confirmOrder', confirmOrderMutation, { orderId: 'o', providerPaymentId: 'p', amount: 1 }],
    ['abandonOrder', abandonOrderMutation, 'o'],
    ['requestRefund', requestRefundMutation, { orderId: 'o', reasonCode: 'DUPLICATE' }],
    ['withdrawRefund', withdrawRefundMutation, 'r'],
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
