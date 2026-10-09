import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FAKE_TOSS,
  authorizeAtFakeToss,
  fakeSdkScript,
  startFakeToss,
  tossControl,
  type FakeToss,
} from './fakeToss'

/*
 * 가짜 토스가 **진짜 토스처럼 엄격한지** — e2e 가 이 서버 위에서 돈다. 응답 모양은 백엔드의 가짜(`FakeTossServer.kt` · `TossFixtures`)와 맞춘다.
 */
let fake: FakeToss
let control: ReturnType<typeof tossControl>
beforeAll(async () => {
  fake = await startFakeToss()
  control = tossControl(fake.url)
})
afterAll(async () => {
  await fake?.close()
})

const basic = (key = FAKE_TOSS.secretKey) => `Basic ${Buffer.from(`${key}:`).toString('base64')}`
const toss = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(`${fake.url}${path}`, {
    method,
    headers: { Authorization: basic(), 'Content-Type': 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const confirm = (
  body: { paymentKey: string; orderId: string; amount: number },
  key = `confirm-${body.orderId}`,
) => toss('POST', '/v1/payments/confirm', body, { 'Idempotency-Key': key })
let n = 0
async function pay(amount = 3000) {
  const orderId = `ord_test${++n}`
  const { paymentKey } = await authorizeAtFakeToss(fake.url, { orderId, amount })
  return { orderId, paymentKey, amount }
}

describe('keys', () => {
  it('a wrong secret key is 401 UNAUTHORIZED_KEY (like the real one)', async () => {
    const response = await fetch(`${fake.url}/v1/payments/pk_x`, {
      headers: { Authorization: basic('test_sk_wrong') },
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED_KEY' })
  })
})

describe('confirm', () => {
  it('approves an authorized payment with a Toss-shaped payment object (card issuer code, masked number, amounts)', async () => {
    const { orderId, paymentKey } = await pay(3000)
    const response = await confirm({ paymentKey, orderId, amount: 3000 })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      paymentKey,
      orderId,
      status: 'DONE',
      currency: 'KRW',
      totalAmount: 3000,
      balanceAmount: 3000,
      method: '카드',
      card: { issuerCode: '61', number: '43301234****1234' },
      cancels: null,
    })
  })

  it('refuses an amount that is not the authorized one (400) and leaves the payment unfinished', async () => {
    const { orderId, paymentKey } = await pay(3000)
    const response = await confirm({ paymentKey, orderId, amount: 1 })
    expect(response.status).toBe(400)
    const lookup = await (await toss('GET', `/v1/payments/${paymentKey}`)).json()
    expect(lookup.status).toBe('IN_PROGRESS')
  })

  it('a payment that was never authorized is NOT_FOUND_PAYMENT_SESSION', async () => {
    const response = await confirm({ paymentKey: 'pk_nope', orderId: 'ord_nope', amount: 3000 })
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND_PAYMENT_SESSION' })
  })

  it('the same Idempotency-Key replays the same answer; another key on a finished payment is ALREADY_PROCESSED_PAYMENT', async () => {
    const { orderId, paymentKey } = await pay()
    const first = await (await confirm({ paymentKey, orderId, amount: 3000 }, 'k1')).json()
    const replay = await confirm({ paymentKey, orderId, amount: 3000 }, 'k1')
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual(first)
    const other = await confirm({ paymentKey, orderId, amount: 3000 }, 'k2')
    expect(other.status).toBe(400)
    expect(await other.json()).toMatchObject({ code: 'ALREADY_PROCESSED_PAYMENT' })
  })

  it('a POST without an Idempotency-Key is refused (the backend must always send one)', async () => {
    const { orderId, paymentKey } = await pay()
    const response = await toss('POST', '/v1/payments/confirm', {
      paymentKey,
      orderId,
      amount: 3000,
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' })
  })
})

describe('control: what the next confirm does (one time only)', () => {
  it('decline: REJECT_CARD_COMPANY once, the payment is ABORTED, the next payment is approved again', async () => {
    await control.set({ confirm: { mode: 'decline' } })
    const declined = await pay()
    const response = await confirm({
      paymentKey: declined.paymentKey,
      orderId: declined.orderId,
      amount: 3000,
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'REJECT_CARD_COMPANY' })
    expect((await (await toss('GET', `/v1/payments/${declined.paymentKey}`)).json()).status).toBe(
      'ABORTED',
    )
    const next = await pay()
    expect(
      (await confirm({ paymentKey: next.paymentKey, orderId: next.orderId, amount: 3000 })).status,
    ).toBe(200)
  })

  it('lose: the approval is applied at Toss but the answer never arrives; looking it up says DONE; the same key replays the real answer', async () => {
    await control.set({ confirm: { mode: 'lose' } })
    const lost = await pay()
    await expect(
      confirm({ paymentKey: lost.paymentKey, orderId: lost.orderId, amount: 3000 }, 'lost-1'),
    ).rejects.toThrow()
    const byOrder = await (await toss('GET', `/v1/payments/orders/${lost.orderId}`)).json()
    expect(byOrder).toMatchObject({ status: 'DONE', paymentKey: lost.paymentKey })
    const replay = await confirm(
      { paymentKey: lost.paymentKey, orderId: lost.orderId, amount: 3000 },
      'lost-1',
    )
    expect(replay.status).toBe(200)
  })

  it('delay: answers after the delay, approved', async () => {
    await control.set({ confirm: { mode: 'delay', delayMs: 300 } })
    const slow = await pay()
    const started = Date.now()
    const response = await confirm({
      paymentKey: slow.paymentKey,
      orderId: slow.orderId,
      amount: 3000,
    })
    expect(Date.now() - started).toBeGreaterThanOrEqual(280)
    expect(response.status).toBe(200)
  })

  it('error: a 5xx that applied nothing', async () => {
    await control.set({ confirm: { mode: 'error' } })
    const unlucky = await pay()
    const response = await confirm({
      paymentKey: unlucky.paymentKey,
      orderId: unlucky.orderId,
      amount: 3000,
    })
    expect(response.status).toBe(500)
    expect((await (await toss('GET', `/v1/payments/${unlucky.paymentKey}`)).json()).status).toBe(
      'IN_PROGRESS',
    )
  })

  it('complete: the buyer finishes later — the payment becomes DONE at Toss without a confirm', async () => {
    const left = await pay()
    expect((await (await toss('GET', `/v1/payments/orders/${left.orderId}`)).json()).status).toBe(
      'IN_PROGRESS',
    )
    await control.set({ complete: left.orderId })
    expect(await (await toss('GET', `/v1/payments/orders/${left.orderId}`)).json()).toMatchObject({
      status: 'DONE',
      totalAmount: 3000,
      balanceAmount: 3000,
    })
  })
})

describe('cancel (refund)', () => {
  it('a partial cancel leaves PARTIAL_CANCELED with the balance, a full one CANCELED; cancels[] lists each with a transaction key', async () => {
    const { orderId, paymentKey } = await pay(5000)
    await confirm({ paymentKey, orderId, amount: 5000 })
    const partial = await (
      await toss(
        'POST',
        `/v1/payments/${paymentKey}/cancel`,
        { cancelReason: '고객 요청', cancelAmount: 2000 },
        { 'Idempotency-Key': 'c1' },
      )
    ).json()
    expect(partial).toMatchObject({ status: 'PARTIAL_CANCELED', balanceAmount: 3000 })
    expect(partial.cancels).toHaveLength(1)
    expect(partial.cancels[0]).toMatchObject({
      cancelAmount: 2000,
      cancelStatus: 'DONE',
      refundableAmount: 3000,
    })
    expect(partial.cancels[0].transactionKey).toBeTruthy()
    const rest = await (
      await toss(
        'POST',
        `/v1/payments/${paymentKey}/cancel`,
        { cancelReason: '고객 요청' },
        { 'Idempotency-Key': 'c2' },
      )
    ).json()
    expect(rest).toMatchObject({ status: 'CANCELED', balanceAmount: 0 })
    expect(rest.cancels).toHaveLength(2)
  })

  it('cancelling more than the balance is NOT_CANCELABLE_AMOUNT; cancelling a cancelled payment is ALREADY_CANCELED_PAYMENT', async () => {
    const { orderId, paymentKey } = await pay(1000)
    await confirm({ paymentKey, orderId, amount: 1000 })
    const over = await toss(
      'POST',
      `/v1/payments/${paymentKey}/cancel`,
      { cancelReason: 'x', cancelAmount: 5000 },
      { 'Idempotency-Key': 'o1' },
    )
    expect(over.status).toBe(400)
    expect(await over.json()).toMatchObject({ code: 'NOT_CANCELABLE_AMOUNT' })
    await toss(
      'POST',
      `/v1/payments/${paymentKey}/cancel`,
      { cancelReason: 'x' },
      { 'Idempotency-Key': 'o2' },
    )
    const again = await toss(
      'POST',
      `/v1/payments/${paymentKey}/cancel`,
      { cancelReason: 'x' },
      { 'Idempotency-Key': 'o3' },
    )
    expect(again.status).toBe(400)
    expect(await again.json()).toMatchObject({ code: 'ALREADY_CANCELED_PAYMENT' })
  })

  it('the same Idempotency-Key does not cancel twice', async () => {
    const { orderId, paymentKey } = await pay(4000)
    await confirm({ paymentKey, orderId, amount: 4000 })
    const send = () =>
      toss(
        'POST',
        `/v1/payments/${paymentKey}/cancel`,
        { cancelReason: 'x', cancelAmount: 1000 },
        { 'Idempotency-Key': 'same' },
      )
    const first = await (await send()).json()
    const second = await (await send()).json()
    expect(second).toEqual(first)
    expect(second.cancels).toHaveLength(1)
  })
})

describe('the payment window (what the browser script talks to)', () => {
  it('sdk "cancel": no payment is made, the window reports PAY_PROCESS_CANCELED (one time)', async () => {
    await control.set({ sdk: 'cancel' })
    const result = await (
      await fetch(`${fake.url}/sdk/authorize`, {
        method: 'POST',
        body: JSON.stringify({ orderId: 'ord_c', amount: 3000 }),
      })
    ).json()
    expect(result).toMatchObject({ ok: false, fail: { code: 'PAY_PROCESS_CANCELED' } })
    expect((await toss('GET', '/v1/payments/orders/ord_c')).status).toBe(404)
    const next = await authorizeAtFakeToss(fake.url, { orderId: 'ord_c2', amount: 3000 })
    expect(next.paymentKey).toBeTruthy()
  })

  it('sdk "cancel-no-order-id": the same closing, but the window says nothing about which order it was (real Toss may not)', async () => {
    await control.set({ sdk: 'cancel-no-order-id' })
    const result = await (
      await fetch(`${fake.url}/sdk/authorize`, {
        method: 'POST',
        body: JSON.stringify({ orderId: 'ord_n', amount: 3000 }),
      })
    ).json()
    expect(result).toMatchObject({
      ok: false,
      fail: { code: 'PAY_PROCESS_CANCELED' },
      withoutOrderId: true,
    })
    expect((await toss('GET', '/v1/payments/orders/ord_n')).status).toBe(404)
    expect((await control.state()).next.sdk).toBeNull() // 한 번만
  })

  it('sdk "leave": the buyer authenticated and walked away — the payment waits (IN_PROGRESS) and the window never returns', async () => {
    await control.set({ sdk: 'leave' })
    const result = await (
      await fetch(`${fake.url}/sdk/authorize`, {
        method: 'POST',
        body: JSON.stringify({ orderId: 'ord_l', amount: 3000 }),
      })
    ).json()
    expect(result).toMatchObject({ ok: true, leave: true })
    expect((await (await toss('GET', '/v1/payments/orders/ord_l')).json()).status).toBe(
      'IN_PROGRESS',
    )
  })

  it('a card number can be chosen for the next payments (tests that look at the card)', async () => {
    await control.set({ cardNumber: '53271234****5678' })
    const { orderId, paymentKey } = await pay()
    expect((await (await confirm({ paymentKey, orderId, amount: 3000 })).json()).card.number).toBe(
      '53271234****5678',
    )
    await control.set({ cardNumber: null })
  })
})

describe('the log and reset', () => {
  it('records every Toss API call (with its Idempotency-Key), not the window or control traffic', async () => {
    await control.set({ reset: true })
    const { orderId, paymentKey } = await pay()
    await confirm({ paymentKey, orderId, amount: 3000 }, 'logged')
    await toss('GET', `/v1/payments/${paymentKey}`)
    const state = await control.state()
    expect(state.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      'POST /v1/payments/confirm',
      `GET /v1/payments/${paymentKey}`,
    ])
    expect(state.calls[0]).toMatchObject({
      idempotencyKey: 'logged',
      body: { orderId, amount: 3000 },
    })
    expect(control.confirmCalls(state, orderId)).toHaveLength(1)
  })

  it("callsFor picks the calls about one order (by order id, order lookup, or its payment key) and leaves other orders' calls out", async () => {
    const mine = await pay()
    const other = await pay(5000)
    await confirm({ ...mine }, 'mine-confirm')
    await confirm({ ...other }, 'other-confirm')
    await toss('GET', `/v1/payments/${mine.paymentKey}`)
    await toss('GET', `/v1/payments/orders/${mine.orderId}`)
    await toss('GET', `/v1/payments/${other.paymentKey}`)
    const state = await control.state()
    expect(
      control.callsFor(state, mine.orderId).map((call) => `${call.method} ${call.path}`),
    ).toEqual([
      'POST /v1/payments/confirm',
      `GET /v1/payments/${mine.paymentKey}`,
      `GET /v1/payments/orders/${mine.orderId}`,
    ])
    expect(control.callsFor(state, 'ord_unknown')).toEqual([])
  })

  it('reset forgets payments, calls and any pending one-time instructions', async () => {
    await control.set({ sdk: 'cancel', confirm: { mode: 'decline' } })
    await control.set({ reset: true })
    const state = await control.state()
    expect(state).toMatchObject({ payments: [], calls: [], next: { sdk: null, confirm: null } })
  })
})

describe('the browser script (fakeSdkScript)', () => {
  /** 스크립트를 가짜 `window` · `fetch` · `location` 위에서 실행한다 — 진짜 브라우저 없이 결제창이 하는 일을 본다 */
  function run(answer: unknown, failUrl = 'http://app.test/payments/return') {
    const win: Record<string, unknown> = {}
    const assigned: string[] = []
    const requests: Array<{ url: string; body: Record<string, unknown> }> = []
    const fakeFetch = async (url: string, init: { body: string }) => {
      requests.push({ url, body: JSON.parse(init.body) })
      return { json: async () => answer }
    }
    new Function('window', 'fetch', 'location', 'URL', fakeSdkScript('http://fake.test'))(
      win,
      fakeFetch,
      { assign: (url: string) => assigned.push(url) },
      URL,
    )
    const TossPayments = win.TossPayments as ((key: string) => {
      payment: (o: object) => { requestPayment: (r: object) => Promise<void> }
    }) & { ANONYMOUS: string }
    const request = {
      method: 'CARD',
      amount: { currency: 'KRW', value: 3000 },
      orderId: 'ord_1',
      orderName: '응원하기',
      successUrl: 'http://app.test/payments/return',
      failUrl,
    }
    const open = () =>
      TossPayments('test_ck_x')
        .payment({ customerKey: TossPayments.ANONYMOUS })
        .requestPayment(request)
    return { open, assigned, requests, TossPayments }
  }

  it('defines the SDK the package calls (TossPayments(clientKey).payment({customerKey}).requestPayment) and asks the fake to authorize', async () => {
    const { open, requests, TossPayments } = run({ ok: true, paymentKey: 'pk_1' })
    expect(typeof TossPayments.ANONYMOUS).toBe('string')
    await open()
    expect(requests).toEqual([
      {
        url: 'http://fake.test/sdk/authorize',
        body: expect.objectContaining({
          orderId: 'ord_1',
          amount: 3000,
          currency: 'KRW',
          clientKey: 'test_ck_x',
        }),
      },
    ])
  })

  it('on success the window goes straight to successUrl with paymentKey, orderId and amount (like Toss)', async () => {
    const { open, assigned } = run({ ok: true, paymentKey: 'pk_1' })
    await open()
    const back = new URL(assigned[0] as string)
    expect(`${back.origin}${back.pathname}`).toBe('http://app.test/payments/return')
    expect(Object.fromEntries(back.searchParams)).toEqual({
      paymentKey: 'pk_1',
      orderId: 'ord_1',
      amount: '3000',
    })
  })

  it('on a failure it goes to failUrl with code, message and orderId', async () => {
    const { open, assigned } = run({
      ok: false,
      fail: { code: 'PAY_PROCESS_CANCELED', message: '사용자가 결제를 취소했습니다' },
    })
    await open()
    expect(Object.fromEntries(new URL(assigned[0] as string).searchParams)).toEqual({
      code: 'PAY_PROCESS_CANCELED',
      message: '사용자가 결제를 취소했습니다',
      orderId: 'ord_1',
    })
  })

  it('a failure without an order id goes to failUrl with code and message only — and keeps whatever the app put on failUrl itself', async () => {
    const { open, assigned } = run(
      {
        ok: false,
        fail: { code: 'PAY_PROCESS_CANCELED', message: 'closed' },
        withoutOrderId: true,
      },
      'http://app.test/payments/return?order=ord_1',
    )
    await open()
    expect(Object.fromEntries(new URL(assigned[0] as string).searchParams)).toEqual({
      order: 'ord_1',
      code: 'PAY_PROCESS_CANCELED',
      message: 'closed',
    })
  })

  it('when the buyer "leaves" the window never goes anywhere and never answers', async () => {
    const { open, assigned } = run({ ok: true, leave: true })
    const outcome = await Promise.race([
      open().then(() => 'returned'),
      new Promise((r) => setTimeout(() => r('still open'), 50)),
    ])
    expect(outcome).toBe('still open')
    expect(assigned).toEqual([])
  })
})

describe('자동결제(구독)', () => {
  const customerKey = 'cus_0123456789abcdef0123456789abcdef'
  const authorizeBilling = async () => {
    const answer = (await (
      await fetch(`${fake.url}/sdk/authorize-billing`, {
        method: 'POST',
        body: JSON.stringify({ customerKey }),
      })
    ).json()) as { ok: boolean; authKey: string }
    return answer.authKey
  }
  const issue = (authKey: string, key = customerKey) =>
    toss('POST', '/v1/billing/authorizations/issue', { authKey, customerKey: key })

  it('issues a billing key once per authKey, and an unknown or reused authKey is 404 NOT_FOUND_BILLING', async () => {
    await control.set({ reset: true })
    const authKey = await authorizeBilling()
    const issued = await issue(authKey)
    expect(issued.status).toBe(200)
    expect(((await issued.json()) as { billingKey: string }).billingKey).toMatch(/^bkey_/)
    expect((await issue(authKey)).status).toBe(404) // 한 번만 쓴다
    const refused = await issue('auth_unknown')
    expect(refused.status).toBe(404)
    expect(((await refused.json()) as { code: string }).code).toBe('NOT_FOUND_BILLING')
  })

  it('charges with the billing key (idempotent by key), declines or loses the answer when told, and refuses an unknown key like the real one', async () => {
    await control.set({ reset: true })
    const { billingKey } = (await (await issue(await authorizeBilling())).json()) as {
      billingKey: string
    }
    const charge = (orderId: string, key: string) =>
      toss(
        'POST',
        `/v1/billing/${billingKey}`,
        { customerKey, amount: 3900, orderId, orderName: '월 구독' },
        { 'Idempotency-Key': key },
      )
    const first = await charge('ord_sub_1', 'k1')
    expect(first.status).toBe(200)
    const payment = (await first.json()) as {
      paymentKey: string
      status: string
      totalAmount: number
    }
    expect(payment).toMatchObject({ status: 'DONE', totalAmount: 3900 })
    expect(
      ((await (await charge('ord_sub_1', 'k1')).json()) as { paymentKey: string }).paymentKey,
    ).toBe(payment.paymentKey) // 같은 키는 같은 답
    expect((await toss('GET', '/v1/payments/orders/ord_sub_1')).status).toBe(200) // 조회가 이 결제를 안다

    await control.set({ billing: { mode: 'decline' } })
    const declined = await charge('ord_sub_2', 'k2')
    expect(declined.status).toBe(403)
    expect(((await declined.json()) as { code: string }).code).toBe('REJECT_CARD_COMPANY')
    expect((await charge('ord_sub_2', 'k3')).status).toBe(200) // 지시는 한 번만 쓰인다

    const unknown = await toss(
      'POST',
      '/v1/billing/bkey_unknown',
      { customerKey, amount: 1, orderId: 'ord_x', orderName: 'x' },
      { 'Idempotency-Key': 'k9' },
    )
    expect(unknown.status).toBe(400)
    expect(((await unknown.json()) as { code: string }).code).toBe('INVALID_BILL_KEY_REQUEST')
  })

  it('deletes a billing key and treats an unknown one as INVALID_BILL_KEY_REQUEST', async () => {
    await control.set({ reset: true })
    const { billingKey } = (await (await issue(await authorizeBilling())).json()) as {
      billingKey: string
    }
    expect((await control.state()).billingKeys).toEqual([billingKey])
    expect((await toss('DELETE', `/v1/billing/${billingKey}`)).status).toBe(200)
    expect((await control.state()).billingKeys).toEqual([])
    expect((await toss('DELETE', `/v1/billing/${billingKey}`)).status).toBe(400)
  })
})
