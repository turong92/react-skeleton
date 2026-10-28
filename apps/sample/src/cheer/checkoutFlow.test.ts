import { ApiRequestError } from '@skeleton/api-client'
import { postSignInTarget } from '@skeleton/auth'
import type { Checkout, CreateOrderInput, CreateOrderResult } from '@skeleton/payment'
import { describe, expect, it } from 'vitest'
import {
  checkoutReturnUrls,
  orderFailureOf,
  returnPlanOf,
  reusableOrderOf,
  startCheer,
  unopenedAfter,
  type UnopenedOrder,
} from './checkoutFlow'

const checkout: Checkout = {
  provider: 'toss',
  kind: 'TOSS_PAYMENT_WINDOW',
  clientKey: 'test_ck_x',
  testMode: true,
  orderId: 'ord_1',
  orderName: '응원하기 3,000원',
  amount: { amount: 3000, currency: 'KRW' },
}
const created = { order: { id: 'ord_1' }, checkout } as unknown as CreateOrderResult

/** 호출을 기록하는 가짜 — 실제 주문 · 결제창 없이 순서와 인자를 본다 */
function fakes(over: { open?: () => Promise<void>; abandon?: () => Promise<unknown> } = {}) {
  const log: string[] = []
  const creates: CreateOrderInput[] = []
  const opened: unknown[] = []
  return {
    log,
    creates,
    opened,
    deps: {
      createOrder: async (input: CreateOrderInput) => {
        log.push('create')
        creates.push(input)
        return created
      },
      openCheckout: async (...args: unknown[]) => {
        log.push('open')
        opened.push(args)
        await over.open?.()
      },
      abandonOrder: async (id: string) => {
        log.push(`abandon:${id}`)
        await over.abandon?.()
      },
      urlsFor: (orderId: string) => checkoutReturnUrls('https://app.example', orderId),
    },
  }
}

describe('checkoutReturnUrls', () => {
  it('success and failure both come back to one screen on this origin (it reads which one it was)', () => {
    const urls = checkoutReturnUrls('https://app.example/', 'ord_1')
    expect(urls.successUrl).toBe('https://app.example/payments/return')
    expect(new URL(urls.failUrl).pathname).toBe('/payments/return')
  })

  it('the failure address carries our own order id (the payment window may not say which order it was)', () => {
    const { failUrl } = checkoutReturnUrls('https://app.example', 'ord_a/b c')
    expect(new URL(failUrl).searchParams.get('order')).toBe('ord_a/b c')
  })
})

describe('startCheer', () => {
  it('tells the server which origin the checkout started from, so a redirect-style provider returns to it', async () => {
    const { deps, creates } = fakes()
    await startCheer({ ...deps, returnOrigin: 'http://localhost:5173' }, 'cheer-3000')
    expect(creates).toEqual([
      { itemType: 'cheer', itemRef: 'cheer-3000', returnOrigin: 'http://localhost:5173' },
    ])
  })

  it('sends no origin field when the screen does not know one', async () => {
    const { deps, creates } = fakes()
    await startCheer(deps, 'cheer-3000')
    expect(creates[0]).not.toHaveProperty('returnOrigin')
  })

  it('without an easy pay the payment window is opened with the return addresses only - exactly as before', async () => {
    const { deps, opened } = fakes()
    await startCheer(deps, 'cheer-3000')
    expect(opened).toEqual([[checkout, checkoutReturnUrls('https://app.example', 'ord_1')]])
  })

  it('with an easy pay the chosen app is handed to the payment window', async () => {
    const { deps, opened } = fakes()
    await expect(startCheer(deps, 'cheer-3000', undefined, 'NAVERPAY')).resolves.toEqual({
      kind: 'opened',
    })
    expect(opened).toEqual([
      [checkout, { ...checkoutReturnUrls('https://app.example', 'ord_1'), easyPay: 'NAVERPAY' }],
    ])
  })

  it("creates a cheer order for the chosen server amount, then opens the payment window with this app's return addresses", async () => {
    const { deps, log, creates, opened } = fakes()
    await expect(startCheer(deps, 'cheer-3000')).resolves.toEqual({ kind: 'opened' })
    expect(log).toEqual(['create', 'open'])
    expect(creates).toEqual([{ itemType: 'cheer', itemRef: 'cheer-3000' }])
    expect(opened[0]).toEqual([checkout, checkoutReturnUrls('https://app.example', 'ord_1')])
  })

  it('a window the person closed gives the order back (abandon) and says so, instead of an error', async () => {
    const { deps, log } = fakes({
      open: async () => {
        throw Object.assign(new Error('closed'), { code: 'USER_CANCEL' })
      },
    })
    await expect(startCheer(deps, 'cheer-1000')).resolves.toEqual({ kind: 'canceled' })
    expect(log).toEqual(['create', 'open', 'abandon:ord_1'])
  })

  it('a window that could not open keeps the order and hands it back with the error (nothing is abandoned)', async () => {
    const boom = new Error('script blocked')
    const { deps, log } = fakes({
      open: async () => {
        throw boom
      },
    })
    await expect(startCheer(deps, 'cheer-1000')).resolves.toEqual({
      kind: 'window-failed',
      error: boom,
      created,
    })
    expect(log).toEqual(['create', 'open'])
  })

  it('pressing again with the order it handed back only opens the window again — no second order is made', async () => {
    let blocked = true
    const { deps, log, opened } = fakes({
      open: async () => {
        if (blocked) throw new Error('script blocked')
      },
    })
    const first = await startCheer(deps, 'cheer-3000')
    if (first.kind !== 'window-failed') throw new Error(`expected window-failed, got ${first.kind}`)
    blocked = false
    await expect(startCheer(deps, 'cheer-3000', first.created)).resolves.toEqual({
      kind: 'opened',
    })
    expect(log).toEqual(['create', 'open', 'open']) // one create, two windows
    expect(opened[1]).toEqual([checkout, checkoutReturnUrls('https://app.example', 'ord_1')])
  })

  it('an order the server refused never reaches the window', async () => {
    const refused = new Error('422')
    const { deps, log } = fakes()
    deps.createOrder = async () => {
      log.push('create')
      throw refused
    }
    await expect(startCheer(deps, 'cheer-9')).resolves.toEqual({
      kind: 'order-failed',
      error: refused,
    })
    expect(log).toEqual(['create'])
  })

  it('an order that comes back without a payment window (the same key sent again after the order left PENDING — the backend answers 200 with checkout null) is an order failure: no window, nothing abandoned', async () => {
    const { deps, log } = fakes()
    deps.createOrder = async () => {
      log.push('create')
      return {
        order: { id: 'ord_1', status: 'CANCELED' },
        checkout: null,
      } as unknown as CreateOrderResult
    }
    const result = await startCheer(deps, 'cheer-9')
    expect(result.kind).toBe('order-failed')
    expect(log).toEqual(['create'])
  })

  it('the same key sent again for an order that is already paid or being confirmed (checkout null) sends the person to that order, not to a failure', async () => {
    for (const status of ['PAID', 'CONFIRMING', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const) {
      const { deps, log } = fakes()
      deps.createOrder = async () => {
        log.push('create')
        return { order: { id: 'ord_7', status }, checkout: null } as unknown as CreateOrderResult
      }
      await expect(startCheer(deps, 'cheer-9'), status).resolves.toEqual({
        kind: 'settled',
        orderId: 'ord_7',
      })
      expect(log, status).toEqual(['create']) // no window, nothing abandoned
    }
  })

  it('a coupon travels with the order as discounts, and only when one is chosen', async () => {
    const withCoupon = fakes()
    await startCheer(withCoupon.deps, 'cheer-3000', undefined, undefined, undefined, 'c1')
    expect(withCoupon.creates[0]).toMatchObject({ discounts: [{ type: 'coupon', ref: 'c1' }] })
    const without = fakes()
    await startCheer(without.deps, 'cheer-3000')
    expect(without.creates[0]).not.toHaveProperty('discounts')
  })

  it('a free order (coupon took it to 0) or an exempt one has no window even if the server sent one: the person goes to that order', async () => {
    for (const settlement of ['FREE', 'EXEMPT']) {
      const { deps, log } = fakes()
      deps.createOrder = async () => {
        log.push('create')
        return {
          order: { id: 'ord_f', status: 'PAID', settlement },
          checkout,
        } as unknown as CreateOrderResult
      }
      await expect(
        startCheer(deps, 'cheer-3000', undefined, undefined, undefined, 'c1'),
      ).resolves.toEqual({
        kind: 'settled',
        orderId: 'ord_f',
      })
      expect(log, settlement).toEqual(['create'])
    }
  })

  it('an order with no checkout that is not open and not paid (closed or never payable) stays an order failure', async () => {
    for (const status of ['PENDING', 'FAILED', 'EXPIRED', 'CANCELED'] as const) {
      const { deps } = fakes()
      deps.createOrder = async () =>
        ({ order: { id: 'ord_7', status }, checkout: null }) as unknown as CreateOrderResult
      expect((await startCheer(deps, 'cheer-9')).kind, status).toBe('order-failed')
    }
  })

  it('a missing checkout field (undefined) is read like null — never opens a window with nothing', async () => {
    const { deps, log } = fakes()
    deps.createOrder = async () =>
      ({ order: { id: 'ord_7', status: 'PAID' } }) as unknown as CreateOrderResult
    await expect(startCheer(deps, 'cheer-9')).resolves.toEqual({
      kind: 'settled',
      orderId: 'ord_7',
    })
    expect(log).not.toContain('open')
  })

  it('a server without a client key (clientKey null) cannot take payments: the order is given back and the person is told payments are unavailable — pressing again would not help', async () => {
    const { deps, log } = fakes()
    deps.createOrder = async () => {
      log.push('create')
      return { order: { id: 'ord_1' }, checkout: { ...checkout, clientKey: null } } as never
    }
    await expect(startCheer(deps, 'cheer-3000')).resolves.toEqual({ kind: 'unavailable' })
    expect(log).toEqual(['create', 'abandon:ord_1']) // the window is never opened
  })

  it('giving the order back can fail without changing what the person is told', async () => {
    const { deps } = fakes({
      abandon: async () => {
        throw new Error('network')
      },
    })
    deps.createOrder = async () =>
      ({ order: { id: 'ord_1' }, checkout: { ...checkout, clientKey: null } }) as never
    await expect(startCheer(deps, 'cheer-3000')).resolves.toEqual({ kind: 'unavailable' })
  })

  it('a held order (window failed earlier) whose checkout has no client key is also unavailable', async () => {
    const { deps, log } = fakes()
    const held = { order: { id: 'ord_1' }, checkout: { ...checkout, clientKey: null } } as never
    await expect(startCheer(deps, 'cheer-3000', held)).resolves.toEqual({ kind: 'unavailable' })
    expect(log).toEqual(['abandon:ord_1'])
  })

  it('a failed give-back (abandon) does not hide that the person closed the window', async () => {
    const { deps } = fakes({
      open: async () => {
        throw Object.assign(new Error('closed'), { code: 'PAY_PROCESS_CANCELED' })
      },
      abandon: async () => {
        throw new Error('network')
      },
    })
    await expect(startCheer(deps, 'cheer-1000')).resolves.toEqual({ kind: 'canceled' })
  })
})

describe('returnPlanOf — what the screen the payment window sends people back to should do', () => {
  it('a success address becomes one confirm of the same order, with the amount as written in the address (the server compares it)', () => {
    expect(returnPlanOf('?paymentKey=pk_1&orderId=ord_1&amount=3000')).toEqual({
      kind: 'confirm',
      orderId: 'ord_1',
      providerPaymentId: 'pk_1',
      amount: 3000,
    })
  })

  it('a failure address says which order it was and whether the person only closed the window', () => {
    expect(returnPlanOf('?code=PAY_PROCESS_CANCELED&message=x&orderId=ord_1')).toEqual({
      kind: 'left',
      orderId: 'ord_1',
      canceled: true,
    })
    expect(returnPlanOf('?code=REJECT_CARD_COMPANY&message=x&orderId=ord_1')).toEqual({
      kind: 'left',
      orderId: 'ord_1',
      canceled: false,
    })
    expect(returnPlanOf('?code=PAY_PROCESS_CANCELED')).toEqual({
      kind: 'left',
      orderId: null,
      canceled: true,
    })
  })

  it("a failure address that carries our own order id knows the order even when the window's own orderId is missing", () => {
    expect(returnPlanOf('?order=ord_1&code=PAY_PROCESS_CANCELED&message=x')).toEqual({
      kind: 'left',
      orderId: 'ord_1',
      canceled: true,
    })
  })

  it('anything else (typed by hand, cut short) is invalid — nothing is sent', () => {
    expect(returnPlanOf('')).toEqual({ kind: 'invalid' })
    expect(returnPlanOf('?paymentKey=pk_1&orderId=ord_1&amount=3.5')).toEqual({ kind: 'invalid' })
    expect(returnPlanOf('?paymentKey=pk_1&amount=3000')).toEqual({ kind: 'invalid' })
  })
})

describe('the order whose window never opened — when pressing again may reuse it', () => {
  const TTL = 10 * 60_000
  const held: UnopenedOrder = { itemRef: 'cheer-3000', created, since: 1_000 }

  it('the same amount reuses it', () => {
    expect(reusableOrderOf(held, 'cheer-3000', 1_000 + 5_000)).toBe(created)
  })

  it('another amount starts a new order', () => {
    expect(reusableOrderOf(held, 'cheer-5000', 1_000 + 5_000)).toBeUndefined()
  })

  it('another payment method starts a new order - the held order opens another provider window', () => {
    const heldKakao: UnopenedOrder = { ...held, provider: 'kakaopay' }
    expect(reusableOrderOf(heldKakao, 'cheer-3000', 2_000, 'kakaopay')).toBe(created)
    expect(reusableOrderOf(heldKakao, 'cheer-3000', 2_000, 'toss')).toBeUndefined()
    expect(reusableOrderOf(held, 'cheer-3000', 2_000, 'kakaopay')).toBeUndefined()
    const failed = { kind: 'window-failed', error: new Error('x'), created } as const
    expect(unopenedAfter(failed, 'cheer-3000', 7, null, 'kakaopay')).toEqual({
      itemRef: 'cheer-3000',
      created,
      since: 7,
      provider: 'kakaopay',
    })
  })

  it('another coupon (or none) starts a new order - the held order was priced with the first one', () => {
    const heldCoupon: UnopenedOrder = { ...held, couponRef: 'c1' }
    expect(reusableOrderOf(heldCoupon, 'cheer-3000', 2_000, undefined, 'c1')).toBe(created)
    expect(reusableOrderOf(heldCoupon, 'cheer-3000', 2_000, undefined, 'c2')).toBeUndefined()
    expect(reusableOrderOf(heldCoupon, 'cheer-3000', 2_000)).toBeUndefined()
    expect(reusableOrderOf(held, 'cheer-3000', 2_000, undefined, 'c1')).toBeUndefined()
    const failed = { kind: 'window-failed', error: new Error('x'), created } as const
    expect(unopenedAfter(failed, 'cheer-3000', 7, null, undefined, 'c1')).toMatchObject({
      couponRef: 'c1',
    })
  })

  it('nothing held reuses nothing', () => {
    expect(reusableOrderOf(null, 'cheer-3000', 0)).toBeUndefined()
  })

  it('past the key lifetime it is dropped, even for the same amount (the server may have closed that order)', () => {
    expect(reusableOrderOf(held, 'cheer-3000', 1_000 + TTL - 1)).toBe(created)
    expect(reusableOrderOf(held, 'cheer-3000', 1_000 + TTL)).toBeUndefined()
  })

  it('only a window that failed to open keeps an order; every other outcome clears it', () => {
    const failed = { kind: 'window-failed', error: new Error('x'), created } as const
    expect(unopenedAfter(failed, 'cheer-3000', 7, null)).toEqual({
      itemRef: 'cheer-3000',
      created,
      since: 7,
    })
    for (const result of [
      { kind: 'opened' },
      { kind: 'canceled' },
      { kind: 'order-failed', error: new Error('x') },
    ] as const)
      expect(unopenedAfter(result, 'cheer-3000', 7, held)).toBeNull()
  })

  it('failing to open the same order again does not make it younger', () => {
    const failed = { kind: 'window-failed', error: new Error('x'), created } as const
    expect(unopenedAfter(failed, 'cheer-3000', 9_000, held)?.since).toBe(1_000)
  })
})

const answered = (status: number, code: string, data?: unknown) =>
  new ApiRequestError(
    { code, title: 't', status, timestamp: 't', traceId: 'tr', ...(data ? { data } : {}) },
    'tr',
    'sp',
    'tp',
  )

describe('orderFailureOf — what a refused order says (and whether pressing again can help)', () => {
  it('a 429 is its own case: it will keep answering 429 until the window ends, so it says when that is (a point in time, never a count that would not shrink) and holds the button until then', () => {
    expect(
      orderFailureOf(answered(429, 'COMMON.TOO_MANY_REQUESTS', { retryAfterSeconds: 540 }), 1_000),
    ).toEqual({ kind: 'rateLimited', until: 1_000 + 540_000 })
    expect(
      orderFailureOf(answered(429, 'COMMON.TOO_MANY_REQUESTS', { retryAfterSeconds: 61 }), 0),
    ).toEqual({ kind: 'rateLimited', until: 61_000 })
  })

  it('a short wait is a time too', () => {
    expect(
      orderFailureOf(answered(429, 'COMMON.TOO_MANY_REQUESTS', { retryAfterSeconds: 5 }), 0),
    ).toEqual({ kind: 'rateLimited', until: 5_000 })
  })

  it('a 429 that does not say how long says "in a moment" and does not hold the button (there is no time to hold it for)', () => {
    expect(orderFailureOf(answered(429, 'COMMON.TOO_MANY_REQUESTS'), 0)).toEqual({
      kind: 'rateLimited',
      until: null,
    })
  })

  it('an amount the server does not offer is told apart from a plain failure', () => {
    expect(orderFailureOf(answered(422, 'PAYMENT.ITEM_NOT_PURCHASABLE'), 0)).toEqual({
      kind: 'notOffered',
    })
    expect(orderFailureOf(answered(500, 'COMMON.INTERNAL_SERVER_ERROR'), 0)).toEqual({
      kind: 'orderFailed',
    })
    expect(orderFailureOf(new Error('x'), 0)).toEqual({ kind: 'orderFailed' })
  })

  it('a 503 PAYMENT.UNAVAILABLE (no payment provider to open a window) is the same blockage as a missing client key - pressing again would answer the same and spend the rate limit', () => {
    expect(orderFailureOf(answered(503, 'PAYMENT.UNAVAILABLE'), 0)).toEqual({
      kind: 'unavailable',
    })
  })
})

describe('paddle (the result comes by webhook)', () => {
  it('sends no provider with the order - the server decides - and comes back the way of the provider the server used', async () => {
    const f = fakes()
    await startCheer(f.deps, 'cheer-3000')
    expect(f.creates).toEqual([{ itemType: 'cheer', itemRef: 'cheer-3000' }])
  })

  it('comes back to the same page with the order id, and the page only watches the order', () => {
    const urls = checkoutReturnUrls('https://app.example', 'ord_1', 'paddle')
    expect(urls.successUrl).toBe('https://app.example/payments/return?provider=paddle&order=ord_1')
    expect(returnPlanOf('?provider=paddle&order=ord_1')).toEqual({
      kind: 'watch',
      orderId: 'ord_1',
    })
    expect(returnPlanOf('?provider=paddle')).toEqual({ kind: 'invalid' })
  })
})

describe('kakaopay (the server called ready; the buyer comes back with a pg_token)', () => {
  const kakao: Checkout = {
    provider: 'kakaopay',
    kind: 'KAKAOPAY_REDIRECT',
    clientKey: null,
    testMode: true,
    orderId: 'ord_1',
    orderName: '응원하기 3,000원',
    amount: { amount: 3000, currency: 'KRW' },
    attributes: { pcUrl: 'https://pay.example/pc', mobileUrl: 'https://pay.example/m' },
  }
  const kakaoCreated = { order: { id: 'ord_1' }, checkout: kakao } as unknown as CreateOrderResult

  it('a checkout with no client key is normal for KakaoPay - the window opens, nothing is abandoned', async () => {
    const f = fakes()
    f.deps.createOrder = async () => kakaoCreated
    await expect(
      startCheer(f.deps, 'cheer-3000', undefined, undefined, 'kakaopay'),
    ).resolves.toEqual({ kind: 'opened' })
    expect(f.log).toEqual(['open'])
  })

  it('a KakaoPay checkout without its window addresses cannot be opened: the order is given back and payments are unavailable', async () => {
    const f = fakes()
    f.deps.createOrder = async () => {
      f.log.push('create')
      return { order: { id: 'ord_1' }, checkout: { ...kakao, attributes: {} } } as never
    }
    await expect(
      startCheer(f.deps, 'cheer-3000', undefined, undefined, 'kakaopay'),
    ).resolves.toEqual({ kind: 'unavailable' })
    expect(f.log).toEqual(['create', 'abandon:ord_1'])
  })

  it('the chosen provider travels with the order, and only when the person chose one', async () => {
    const f = fakes()
    await startCheer(f.deps, 'cheer-3000', undefined, undefined, 'kakaopay')
    expect(f.creates).toEqual([{ itemType: 'cheer', itemRef: 'cheer-3000', provider: 'kakaopay' }])
    const g = fakes()
    await startCheer(g.deps, 'cheer-3000')
    expect(g.creates).toEqual([{ itemType: 'cheer', itemRef: 'cheer-3000' }])
  })

  it('the return address of the server carries the order, the result and the token - success becomes one approve of that order, with no amount from the address', () => {
    expect(
      returnPlanOf(
        '?kind=KAKAOPAY_REDIRECT&provider=kakaopay&order=ord_1&result=success&pg_token=tok_1',
      ),
    ).toEqual({
      kind: 'approve',
      orderId: 'ord_1',
      approvalToken: 'tok_1',
    })
  })

  it('cancel and fail leave the order the way the Toss failure address does; a success without its token is invalid', () => {
    expect(
      returnPlanOf('?kind=KAKAOPAY_REDIRECT&provider=kakaopay&order=ord_1&result=cancel'),
    ).toEqual({
      kind: 'left',
      orderId: 'ord_1',
      canceled: true,
    })
    expect(
      returnPlanOf('?kind=KAKAOPAY_REDIRECT&provider=kakaopay&order=ord_1&result=fail'),
    ).toEqual({
      kind: 'left',
      orderId: 'ord_1',
      canceled: false,
    })
    expect(
      returnPlanOf('?kind=KAKAOPAY_REDIRECT&provider=kakaopay&order=ord_1&result=success'),
    ).toEqual({
      kind: 'invalid',
    })
    expect(returnPlanOf('?kind=KAKAOPAY_REDIRECT&provider=kakaopay')).toEqual({ kind: 'invalid' })
  })
})

describe('naverpay (the server reserved the window; the buyer comes back with a paymentId)', () => {
  const naver: Checkout = {
    provider: 'naverpay',
    kind: 'NAVERPAY_REDIRECT',
    clientKey: null,
    testMode: true,
    orderId: 'ord_1',
    orderName: '응원하기 3,000원',
    amount: { amount: 3000, currency: 'KRW' },
    attributes: { windowUrl: 'https://test-m.pay.naver.com/payments/RSV1' },
  }
  const naverCreated = { order: { id: 'ord_1' }, checkout: naver } as unknown as CreateOrderResult

  it('a NaverPay checkout with its window address is opened; one without cannot be: the order is given back and payments are unavailable', async () => {
    const f = fakes()
    f.deps.createOrder = async () => naverCreated
    await expect(
      startCheer(f.deps, 'cheer-3000', undefined, undefined, 'naverpay'),
    ).resolves.toEqual({ kind: 'opened' })
    expect(f.log).toEqual(['open'])

    const g = fakes()
    g.deps.createOrder = async () => {
      g.log.push('create')
      return { order: { id: 'ord_1' }, checkout: { ...naver, attributes: {} } } as never
    }
    await expect(
      startCheer(g.deps, 'cheer-3000', undefined, undefined, 'naverpay'),
    ).resolves.toEqual({ kind: 'unavailable' })
    expect(g.log).toEqual(['create', 'abandon:ord_1'])
  })

  it('the return address of the server carries the order and the payment id - success becomes one confirm of that order with the payment id and no amount from the address', () => {
    expect(
      returnPlanOf(
        '?kind=NAVERPAY_REDIRECT&provider=naverpay&order=ord_1&resultCode=Success&paymentId=20261017NP0001',
      ),
    ).toEqual({ kind: 'confirm-held', orderId: 'ord_1', providerPaymentId: '20261017NP0001' })
  })

  it('UserCancel and any other result code leave the order the way the Toss failure address does; a success without its payment id is invalid', () => {
    expect(
      returnPlanOf('?kind=NAVERPAY_REDIRECT&provider=naverpay&order=ord_1&resultCode=UserCancel'),
    ).toEqual({ kind: 'left', orderId: 'ord_1', canceled: true })
    expect(
      returnPlanOf(
        '?kind=NAVERPAY_REDIRECT&provider=naverpay&order=ord_1&resultCode=TimeExpired&resultMessage=x&reserveId=r',
      ),
    ).toEqual({ kind: 'left', orderId: 'ord_1', canceled: false })
    expect(
      returnPlanOf('?kind=NAVERPAY_REDIRECT&provider=naverpay&order=ord_1&resultCode=Success'),
    ).toEqual({ kind: 'invalid' })
    expect(returnPlanOf('?kind=NAVERPAY_REDIRECT&provider=naverpay')).toEqual({ kind: 'invalid' })
  })
})

describe('coming back from a provider without a session', () => {
  it('after sign-in the visitor is sent to the same return address, query included, and it reads as the same approval', () => {
    const search =
      '?kind=KAKAOPAY_REDIRECT&provider=kakaopay&order=ord_1&result=success&pg_token=pg%2Btok_1'
    // `RequireAuth` 가 로그인 화면으로 보낼 때 담는 `state.from`
    const target = postSignInTarget({ from: { pathname: '/payments/return', search, hash: '' } })
    expect(target).toBe(`/payments/return${search}`)
    expect(returnPlanOf(new URL(target, 'https://app.example').search)).toEqual(
      returnPlanOf(search),
    )
    expect(returnPlanOf(search)).toEqual({
      kind: 'approve',
      orderId: 'ord_1',
      approvalToken: 'pg+tok_1',
    })
  })
})
