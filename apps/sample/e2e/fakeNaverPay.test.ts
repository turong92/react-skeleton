import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FAKE_NAVERPAY,
  naverPayControl,
  startFakeNaverPay,
  type FakeNaverPay,
} from './fakeNaverPay'

/*
 * 가짜 네이버페이가 **진짜 네이버페이처럼 엄격한지** — e2e 가 이 서버 위에서 돈다. 응답 모양은 백엔드의 가짜(`FakeNaverPayServer.kt`)와 맞춘다.
 */
let fake: FakeNaverPay
let control: ReturnType<typeof naverPayControl>
beforeAll(async () => {
  fake = await startFakeNaverPay()
  control = naverPayControl(fake.url)
})
afterAll(async () => {
  await fake?.close()
})

const API = '/naverpay-partner/naverpay/payments'
const headers = (over: Record<string, string> = {}) => ({
  'X-Naver-Client-Id': FAKE_NAVERPAY.clientId,
  'X-Naver-Client-Secret': FAKE_NAVERPAY.clientSecret,
  'X-NaverPay-Chain-Id': FAKE_NAVERPAY.chainId,
  ...over,
})
const post = (path: string, form: Record<string, string>, key?: string, auth = headers()) =>
  fetch(`${fake.url}${API}${path}`, {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(key ? { 'X-NaverPay-Idempotency-Key': key } : {}),
    },
    body: new URLSearchParams(form).toString(),
  })
const history = (paymentId: string) =>
  fetch(`${fake.url}${API}/v2.3/list/history/${paymentId}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageNumber: 1, rowsPerPage: 100 }),
  })
let n = 0

const RETURN = 'https://app.test/payments/return?kind=NAVERPAY_REDIRECT&order=x'
const reserveBody = (merchantPayKey: string, total: number) => ({
  modelVersion: '2',
  merchantPayKey,
  productName: '응원하기',
  productCount: 1,
  totalPayAmount: total,
  taxScopeAmount: total,
  taxExScopeAmount: 0,
  returnUrl: RETURN,
  productItems: [
    { categoryType: 'ETC', categoryId: 'ETC', uid: merchantPayKey, name: 'x', count: 1 },
  ],
})
let keys = 0
const reserve = (body: unknown, key: string | null = `rk-${++keys}`) =>
  fetch(`${fake.url}${API}/v2/reserve`, {
    method: 'POST',
    headers: {
      ...headers(),
      'Content-Type': 'application/json',
      ...(key ? { 'X-NaverPay-Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  })
/** 서버가 결제를 예약한다 - 예약 번호 */
async function reserved(orderId: string, total: number) {
  const body = (await (await reserve(reserveBody(orderId, total))).json()) as {
    code: string
    body: { reserveId: string }
  }
  expect(body.code).toBe('Success')
  return body.body.reserveId
}
/** 구매자가 예약한 결제창을 따라가 결제를 마친다 - 돌아가는 주소 */
async function openWindow(reserveId: string) {
  const hop = await fetch(`${fake.url}/payments/${reserveId}`, { redirect: 'manual' })
  expect(hop.status).toBe(302)
  return new URL(hop.headers.get('location') ?? '')
}
/** 구매자가 결제를 마친다 - 돌려받은 결제 번호 */
async function buyerPays(total = 3000) {
  const orderId = `ord_test${++n}`
  const back = await openWindow(await reserved(orderId, total))
  expect(back.searchParams.get('resultCode')).toBe('Success')
  return { orderId, paymentId: back.searchParams.get('paymentId') ?? '' }
}
const apply = (paymentId: string, key = `apply-${paymentId}`) =>
  post('/v2.2/apply/payment', { paymentId }, key)
const cancel = (
  paymentId: string,
  amount: number,
  key: string,
  tax = { taxScopeAmount: String(amount), taxExScopeAmount: '0' },
) =>
  post(
    '/v1/cancel',
    { paymentId, cancelAmount: String(amount), cancelReason: 'test', cancelRequester: '2', ...tax },
    key,
  )

describe('keys and the idempotency header', () => {
  it('any wrong auth header is 401 with no body; an apply or cancel without the idempotency key is 400', async () => {
    const { paymentId } = await buyerPays()
    for (const name of ['X-Naver-Client-Id', 'X-Naver-Client-Secret', 'X-NaverPay-Chain-Id'])
      expect(
        (await post('/v2.2/apply/payment', { paymentId }, 'k1', headers({ [name]: 'nope' })))
          .status,
      ).toBe(401)
    expect((await post('/v2.2/apply/payment', { paymentId })).status).toBe(400)
    expect((await post('/v1/cancel', { paymentId })).status).toBe(400)
  })
})

describe('apply', () => {
  it('applies a payment the buyer made in the window, with the figures the buyer put in the window', async () => {
    const { orderId, paymentId } = await buyerPays(3000)
    const body = await (await apply(paymentId)).json()
    expect(body).toMatchObject({
      code: 'Success',
      body: {
        paymentId,
        detail: {
          merchantPayKey: orderId,
          totalPayAmount: 3000,
          admissionState: 'SUCCESS',
          admissionTypeCode: '01',
        },
      },
    })
  })

  it('a second apply with another key is AlreadyComplete; the same key again is 409 with the first answer and applies nothing', async () => {
    const { paymentId } = await buyerPays()
    const first = await (await apply(paymentId)).json()
    expect(await (await apply(paymentId, 'another-key')).json()).toMatchObject({
      code: 'AlreadyComplete',
    })
    const replay = await apply(paymentId)
    expect(replay.status).toBe(409)
    expect(await replay.json()).toEqual(first)
    expect(
      (await control.state()).payments.filter((p) => p.paymentId === paymentId && p.applied),
    ).toHaveLength(1)
  })

  it('an unknown payment id is a business error inside a 200', async () => {
    const response = await apply('nope')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ code: 'InvalidMerchant' })
  })
})

describe('cancel and history', () => {
  it('cancels in parts, refuses more than what is left and a tax split that does not add up, and the history lists every cancel', async () => {
    const { paymentId } = await buyerPays(3000)
    await apply(paymentId)
    expect(await (await cancel(paymentId, 1000, 'c1')).json()).toMatchObject({
      code: 'Success',
      body: { primaryPayCancelAmount: 1000, totalRestAmount: 2000 },
    })
    expect(await (await cancel(paymentId, 2500, 'c2')).json()).toMatchObject({
      code: 'OverRemainAmount',
    })
    expect(
      await (
        await cancel(paymentId, 500, 'c3', { taxScopeAmount: '100', taxExScopeAmount: '0' })
      ).json(),
    ).toMatchObject({ code: 'TaxScopeAmountError' })
    expect(await (await cancel(paymentId, 2000, 'c4')).json()).toMatchObject({
      code: 'Success',
      body: { totalRestAmount: 0 },
    })
    expect(await (await cancel(paymentId, 1, 'c5')).json()).toMatchObject({
      code: 'AlreadyCanceled',
    })
    const list = (
      (await (await history(paymentId)).json()) as {
        body: { list: { admissionTypeCode: string; totalPayAmount: number }[] }
      }
    ).body.list
    expect(list.map((e) => [e.admissionTypeCode, e.totalPayAmount])).toEqual([
      ['01', 3000],
      ['04', 1000],
      ['04', 2000], // 03(전체 취소)은 한 번에 결제액 전부를 취소한 건 - 모듈은 03 · 04 를 같게 읽는다
    ])
  })

  it('an unapplied payment cannot be cancelled and has an empty history', async () => {
    const { paymentId } = await buyerPays()
    expect(await (await cancel(paymentId, 1000, 'u1')).json()).toMatchObject({
      code: 'InvalidPaymentId',
    })
    expect(await (await history(paymentId)).json()).toMatchObject({
      code: 'Success',
      body: { list: [] },
    })
  })
})

describe('reserve and the buyer window', () => {
  it('reserves with the amount and order id the server sent, needs the idempotency key, refuses a tax split that does not add up and replays the first answer with 409', async () => {
    expect((await reserve(reserveBody('ord_x', 3000), null)).status).toBe(400)
    const bad = { ...reserveBody('ord_x', 3000), taxScopeAmount: 1000 }
    expect(await (await reserve(bad)).json()).toMatchObject({ code: 'InvalidParameter' })
    const first = await reserve(reserveBody('ord_k', 4000), 'same-key')
    const replay = await reserve(reserveBody('ord_k', 4000), 'same-key')
    expect(replay.status).toBe(409)
    expect(await replay.json()).toEqual(await first.json())
    expect(
      (await control.state()).reservations.filter((r) => r.merchantPayKey === 'ord_k'),
    ).toHaveLength(1)
  })

  it('the buyer window pays exactly what was reserved and goes back to the return address with resultCode=Success&paymentId, joining an existing query with &', async () => {
    const reserveId = await reserved('ord_win', 3000)
    const back = await openWindow(reserveId)
    expect(`${back.origin}${back.pathname}`).toBe('https://app.test/payments/return')
    expect(back.searchParams.get('kind')).toBe('NAVERPAY_REDIRECT')
    const payment = (await control.state()).payments.find(
      (p) => p.paymentId === back.searchParams.get('paymentId'),
    )
    expect(payment).toMatchObject({ merchantPayKey: 'ord_win', total: 3000, applied: false })
  })

  it('the buyer can close the window (UserCancel), fail (TimeExpired) or leave - once only; nothing is paid then', async () => {
    const before = (await control.state()).payments.length
    await control.set({ buyer: 'cancel' })
    expect((await openWindow(await reserved('ord_c', 1000))).searchParams.get('resultCode')).toBe(
      'UserCancel',
    )
    await control.set({ buyer: 'fail' })
    const failed = await openWindow(await reserved('ord_f', 1000))
    expect(failed.searchParams.get('resultCode')).toBe('TimeExpired')
    expect(failed.searchParams.get('reserveId')).toMatch(/^RSV/)
    await control.set({ buyer: 'leave' })
    const left = await fetch(`${fake.url}/payments/${await reserved('ord_l', 1000)}`, {
      redirect: 'manual',
    })
    expect(left.status).toBe(200)
    expect((await control.state()).payments).toHaveLength(before)
    expect((await openWindow(await reserved('ord_n', 1000))).searchParams.get('resultCode')).toBe(
      'Success',
    )
    expect((await fetch(`${fake.url}/payments/RSV-none`, { redirect: 'manual' })).status).toBe(404)
  })

  it('GET /return hands the buyer on to the app with the same query', async () => {
    fake.setApp('http://app.test/')
    const hop = await fetch(
      `${fake.url}/return?kind=NAVERPAY_REDIRECT&order=o&resultCode=Success&paymentId=p`,
      { redirect: 'manual' },
    )
    expect(hop.status).toBe(302)
    expect(hop.headers.get('location')).toBe(
      'http://app.test/payments/return?kind=NAVERPAY_REDIRECT&order=o&resultCode=Success&paymentId=p',
    )
  })
})

describe('control: what the next apply does (one time only)', () => {
  it('lose: the apply is applied but the answer never arrives; the same key then gets the first answer back (409) and the history says it is paid', async () => {
    await control.set({ apply: { mode: 'lose' } })
    const { paymentId } = await buyerPays()
    await expect(apply(paymentId)).rejects.toThrow()
    const replay = await apply(paymentId)
    expect(replay.status).toBe(409)
    expect(await replay.json()).toMatchObject({ code: 'Success', body: { paymentId } })
    expect(await (await history(paymentId)).json()).toMatchObject({
      body: { list: [{ admissionTypeCode: '01' }] },
    })
  })

  it('decline: Fail once and nothing is applied; the next apply goes through', async () => {
    await control.set({ apply: { mode: 'decline' } })
    const { paymentId } = await buyerPays()
    expect(await (await apply(paymentId, 'k-a')).json()).toMatchObject({ code: 'Fail' })
    expect(await (await apply(paymentId, 'k-b')).json()).toMatchObject({ code: 'Success' })
  })

  it('records the NaverPay API calls with the idempotency key', async () => {
    await control.set({ reset: true })
    const { paymentId } = await buyerPays()
    await apply(paymentId)
    const calls = (await control.state()).calls
    expect(calls.map((c) => [c.path.replace(API, ''), c.idempotencyKey])).toEqual([
      ['/v2/reserve', expect.stringMatching(/^rk-/)],
      ['/v2.2/apply/payment', `apply-${paymentId}`],
    ])
  })
})
