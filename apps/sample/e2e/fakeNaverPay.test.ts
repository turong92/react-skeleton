import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  FAKE_NAVERPAY,
  fakeSdkScript,
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

const reserveBody = (merchantPayKey: string, total: number) => ({
  sdk: {
    mode: 'development',
    clientId: FAKE_NAVERPAY.clientId,
    chainId: FAKE_NAVERPAY.chainId,
    payType: 'normal',
    openType: 'page',
  },
  open: {
    merchantPayKey,
    productName: '응원하기',
    productCount: 1,
    totalPayAmount: total,
    taxScopeAmount: total,
    taxExScopeAmount: 0,
    returnUrl: 'https://app.test/payments/return?kind=NAVERPAY_SDK&order=x',
    productItems: [
      { categoryType: 'ETC', categoryId: 'ETC', uid: merchantPayKey, name: 'x', count: 1 },
    ],
  },
})
/** 구매자가 결제창에서 결제를 마친다 - 돌려받은 결제 번호 */
async function buyerPays(total = 3000) {
  const orderId = `ord_test${++n}`
  const response = await fetch(`${fake.url}/sdk/reserve`, {
    method: 'POST',
    body: JSON.stringify(reserveBody(orderId, total)),
  })
  const result = (await response.json()) as { ok?: boolean; paymentId: string }
  expect(result.ok).toBe(true)
  return { orderId, paymentId: result.paymentId }
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

describe('the buyer window (reserve)', () => {
  it('refuses a window opened with another client id, or a tax split that does not add up', async () => {
    const wrong = reserveBody('ord_x', 3000)
    wrong.sdk.clientId = 'nope'
    expect(
      await (
        await fetch(`${fake.url}/sdk/reserve`, { method: 'POST', body: JSON.stringify(wrong) })
      ).json(),
    ).toMatchObject({ fail: { resultCode: 'InvalidMerchant' } })
    const bad = reserveBody('ord_x', 3000)
    bad.open.taxScopeAmount = 1000
    expect(
      await (
        await fetch(`${fake.url}/sdk/reserve`, { method: 'POST', body: JSON.stringify(bad) })
      ).json(),
    ).toMatchObject({ fail: { resultCode: 'InvalidParameter' } })
  })

  it('tamperAmount: the payment is made for the amount the buyer changed it to - once only', async () => {
    await control.set({ tamperAmount: 10 })
    const first = await buyerPays(3000)
    const second = await buyerPays(3000)
    const payments = (await control.state()).payments
    expect(payments.find((p) => p.paymentId === first.paymentId)?.total).toBe(10)
    expect(payments.find((p) => p.paymentId === second.paymentId)?.total).toBe(3000)
  })

  it('answers the preflight of the browser window (another origin) and lets it read the answer', async () => {
    const preflight = await fetch(`${fake.url}/sdk/reserve`, { method: 'OPTIONS' })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
    expect(preflight.headers.get('access-control-allow-headers')).toBe('Content-Type')
    const answer = await fetch(`${fake.url}/sdk/reserve`, {
      method: 'POST',
      body: JSON.stringify(reserveBody('ord_cors', 3000)),
    })
    expect(answer.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('GET /return hands the buyer on to the app with the same query', async () => {
    fake.setApp('http://app.test/')
    const hop = await fetch(
      `${fake.url}/return?kind=NAVERPAY_SDK&order=o&resultCode=Success&paymentId=p`,
      { redirect: 'manual' },
    )
    expect(hop.status).toBe(302)
    expect(hop.headers.get('location')).toBe(
      'http://app.test/payments/return?kind=NAVERPAY_SDK&order=o&resultCode=Success&paymentId=p',
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
      ['/v2.2/apply/payment', `apply-${paymentId}`],
    ])
  })
})

describe('the browser script (fakeSdkScript)', () => {
  /** 스크립트를 가짜 `window` · `fetch` · `location` 위에서 실행한다 — 진짜 브라우저 없이 결제창이 하는 일을 본다 */
  async function run(answer: unknown, returnUrl: string) {
    const win: Record<string, unknown> = {}
    const assigned: string[] = []
    const requests: { url: string; body: Record<string, unknown> }[] = []
    const fakeFetch = async (url: string, init: { body: string }) => {
      requests.push({ url, body: JSON.parse(init.body) as Record<string, unknown> })
      return { json: async () => answer }
    }
    new Function('window', 'fetch', 'location', fakeSdkScript('http://fake.test'))(win, fakeFetch, {
      assign: (url: string) => assigned.push(url),
    })
    const Naver = win.Naver as {
      Pay: { create: (o: object) => { open: (r: object) => Promise<void> } }
    }
    await Naver.Pay.create({ mode: 'development' }).open({ returnUrl })
    return { assigned, requests }
  }

  it('sends what the buyer put in the window to the fake and returns with resultCode=Success&paymentId, joining an existing query with &', async () => {
    const { assigned, requests } = await run(
      { ok: true, paymentId: 'P1' },
      'http://app.test/payments/return?kind=NAVERPAY_SDK&order=o',
    )
    expect(requests[0]?.url).toBe('http://fake.test/sdk/reserve')
    expect(requests[0]?.body).toEqual({
      sdk: { mode: 'development' },
      open: { returnUrl: 'http://app.test/payments/return?kind=NAVERPAY_SDK&order=o' },
    })
    expect(assigned).toEqual([
      'http://app.test/payments/return?kind=NAVERPAY_SDK&order=o&resultCode=Success&paymentId=P1',
    ])
  })

  it('a refusal returns with the result code (UserCancel carries nothing else; the others carry a message and a reserve id); leave never returns', async () => {
    expect(
      (await run({ fail: { resultCode: 'UserCancel' } }, 'http://app.test/r')).assigned,
    ).toEqual(['http://app.test/r?resultCode=UserCancel'])
    expect(
      (await run({ fail: { resultCode: 'TimeExpired', reserveId: 'RSV1' } }, 'http://app.test/r'))
        .assigned,
    ).toEqual(['http://app.test/r?resultCode=TimeExpired&resultMessage=failed&reserveId=RSV1'])
    expect((await run({ leave: true }, 'http://app.test/r')).assigned).toEqual([])
  })
})
