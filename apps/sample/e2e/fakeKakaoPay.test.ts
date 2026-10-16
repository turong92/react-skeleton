import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FAKE_KAKAOPAY,
  kakaoPayControl,
  startFakeKakaoPay,
  type FakeKakaoPay,
} from './fakeKakaoPay'

/*
 * 가짜 카카오페이가 **진짜 카카오페이처럼 엄격한지** — e2e 가 이 서버 위에서 돈다. 응답 모양은 백엔드의 가짜(`FakeKakaoPayServer.kt`)와 맞춘다.
 */
let fake: FakeKakaoPay
let control: ReturnType<typeof kakaoPayControl>
beforeAll(async () => {
  fake = await startFakeKakaoPay()
  control = kakaoPayControl(fake.url)
})
afterAll(async () => {
  await fake?.close()
})

const kakao = (path: string, body: unknown, key = FAKE_KAKAOPAY.secretKey) =>
  fetch(`${fake.url}/online/v1/payment/${path}`, {
    method: 'POST',
    headers: { Authorization: `SECRET_KEY ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const cid = FAKE_KAKAOPAY.cid
const RETURN = 'https://app.test/payments/return?provider=kakaopay&order=ord_x'
let n = 0

async function ready(total = 3000) {
  const orderId = `ord_test${++n}`
  const response = await kakao('ready', {
    cid,
    partner_order_id: orderId,
    partner_user_id: 'acc_1',
    item_name: '응원하기',
    quantity: 1,
    total_amount: total,
    tax_free_amount: 0,
    approval_url: `${RETURN}&result=success`,
    cancel_url: `${RETURN}&result=cancel`,
    fail_url: `${RETURN}&result=fail`,
  })
  return { orderId, total, ...(await response.json()) } as {
    orderId: string
    total: number
    tid: string
    next_redirect_pc_url: string
  }
}

/** 구매자가 결제창을 따라가 인증을 마친다 - 돌려보내는 주소의 pg_token */
async function buyerApproves(pcUrl: string) {
  const hop = await fetch(pcUrl, { redirect: 'manual' })
  expect(hop.status).toBe(302)
  return new URL(hop.headers.get('location') ?? '').searchParams.get('pg_token') ?? ''
}

const approve = (p: { tid: string; orderId: string }, token: string, total?: number) =>
  kakao('approve', {
    cid,
    tid: p.tid,
    partner_order_id: p.orderId,
    partner_user_id: 'acc_1',
    pg_token: token,
    ...(total === undefined ? {} : { total_amount: total }),
  })

describe('keys and merchant code', () => {
  it('a wrong secret key is 401 -401, a wrong merchant code is 400 -400', async () => {
    const wrong = await kakao('ready', { cid }, 'nope')
    expect(wrong.status).toBe(401)
    expect(await wrong.json()).toMatchObject({ error_code: -401 })
    const cidWrong = await kakao('ready', { cid: 'OTHER' })
    expect(cidWrong.status).toBe(400)
  })
})

describe('ready and the buyer window', () => {
  it('prepares a payment with a tid and the three window addresses; the buyer window goes back to approval_url with a pg_token', async () => {
    const p = await ready()
    expect(p.tid).toMatch(/^T\d{19}$/)
    const token = await buyerApproves(p.next_redirect_pc_url)
    expect(token).toMatch(/^pgtok_/)
  })

  it('refuses a ready without a required field (400 -400)', async () => {
    const response = await kakao('ready', { cid, partner_order_id: 'o' })
    expect(response.status).toBe(400)
  })

  it('the buyer can close the window (cancel_url) or fail (fail_url) - once only; nothing is approvable then', async () => {
    const closed = await ready()
    await control.set({ buyer: 'cancel' })
    const hop = await fetch(closed.next_redirect_pc_url, { redirect: 'manual' })
    expect(hop.headers.get('location')).toContain('result=cancel')
    const failed = await ready()
    await control.set({ buyer: 'fail' })
    expect(
      (await fetch(failed.next_redirect_pc_url, { redirect: 'manual' })).headers.get('location'),
    ).toContain('result=fail')
    expect((await approve(closed, 'any')).status).toBe(400)
  })

  it('GET /return hands the buyer on to the app with the same query', async () => {
    fake.setApp('http://127.0.0.1:5999')
    const hop = await fetch(
      `${fake.url}/return?provider=kakaopay&order=o&result=success&pg_token=t`,
      { redirect: 'manual' },
    )
    expect(hop.status).toBe(302)
    expect(hop.headers.get('location')).toBe(
      'http://127.0.0.1:5999/payments/return?provider=kakaopay&order=o&result=success&pg_token=t',
    )
  })
})

describe('approve', () => {
  it('approves after the buyer authenticated, with the total prepared', async () => {
    const p = await ready()
    const token = await buyerApproves(p.next_redirect_pc_url)
    const response = await approve(p, token, 3000)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      tid: p.tid,
      partner_order_id: p.orderId,
      amount: { total: 3000 },
    })
  })

  it('refuses another total than the prepared one (400 -780) and leaves the payment unfinished', async () => {
    const p = await ready()
    const token = await buyerApproves(p.next_redirect_pc_url)
    expect((await approve(p, token, 2999)).status).toBe(400)
    const order = await (await kakao('order', { cid, tid: p.tid })).json()
    expect(order.status).toBe('AUTH_PASSWORD')
  })

  it('refuses a payment the buyer never authenticated, and a second approve of an approved one', async () => {
    const p = await ready()
    expect((await approve(p, 'guess')).status).toBe(400)
    const token = await buyerApproves(p.next_redirect_pc_url)
    expect((await approve(p, token)).status).toBe(200)
    expect((await approve(p, token)).status).toBe(400)
  })
})

describe('cancel and order', () => {
  it('cancels in parts, refuses more than what is left, and the order lookup lists every cancel', async () => {
    const p = await ready()
    expect((await approve(p, await buyerApproves(p.next_redirect_pc_url))).status).toBe(200)
    const cancel = (amount: number) =>
      kakao('cancel', { cid, tid: p.tid, cancel_amount: amount, cancel_tax_free_amount: 0 })
    const first = await (await cancel(1000)).json()
    expect(first).toMatchObject({
      status: 'PART_CANCEL_PAYMENT',
      approved_cancel_amount: { total: 1000 },
      cancel_available_amount: { total: 2000 },
    })
    expect((await cancel(2001)).status).toBe(400)
    expect((await cancel(2000)).status).toBe(200)
    const order = await (await kakao('order', { cid, tid: p.tid })).json()
    expect(order.status).toBe('CANCEL_PAYMENT')
    expect(
      order.payment_action_details.map((a: { payment_action_type: string; amount: number }) => [
        a.payment_action_type,
        a.amount,
      ]),
    ).toEqual([
      ['PAYMENT', 3000],
      ['CANCEL', 1000],
      ['CANCEL', 2000],
    ])
  })
})

describe('control: what the next approve does (one time only)', () => {
  it('lose: the approval is applied but the answer never arrives; the lookup then says SUCCESS_PAYMENT', async () => {
    const p = await ready()
    const token = await buyerApproves(p.next_redirect_pc_url)
    await control.set({ approve: { mode: 'lose' } })
    await expect(approve(p, token)).rejects.toThrow()
    expect((await (await kakao('order', { cid, tid: p.tid })).json()).status).toBe(
      'SUCCESS_PAYMENT',
    )
  })

  it('decline: -780 once and nothing is applied; the next approve goes through again', async () => {
    const p = await ready()
    const token = await buyerApproves(p.next_redirect_pc_url)
    await control.set({ approve: { mode: 'decline' } })
    expect((await approve(p, token)).status).toBe(400)
    expect((await approve(p, token)).status).toBe(200)
  })

  it('records the Kakao API calls without the approval token', async () => {
    await control.set({ reset: true })
    const p = await ready()
    await approve(p, await buyerApproves(p.next_redirect_pc_url))
    const state = await control.state()
    expect(state.calls.map((c) => c.path)).toEqual([
      '/online/v1/payment/ready',
      '/online/v1/payment/approve',
    ])
    expect(JSON.stringify(state.calls)).not.toContain('pgtok_')
  })
})
