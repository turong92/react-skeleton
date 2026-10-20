import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { FAKE_NAVERPAY, PLANTED, naverPayControl } from './fakeNaverPay'
import { DEMO, ko, launch } from './helpers'
import {
  api,
  endLiveSubscription,
  ensureSignedIn,
  labels,
  mySubscription,
  operatorPage,
  operatorRefundsRequest,
  paymentOn,
  resultTitle,
  subscriptionsOn,
  tokenOf,
  won,
} from './paymentSteps'

/*
 * 네이버페이 직접 연동(단건) — 한 흐름: 응원하기에서 「네이버페이」를 골라 결제 → 서버가 결제를 예약하고 구매자가 예약한 결제창(가짜)에서 결제를 마쳐 `paymentId` 를 달아 돌려보낸다 → 서버가 승인 →
 * 「결제됨」 → 내 응원 내역 → 환불 요청 → 운영자 환불 → 「환불됨」. 같은 나라(KR)에 토스와 네이버페이가 둘 다 켜져 있어야 「결제 방법」 고르기가 보인다(백엔드 `GET /payments/config` 의 `choices`).
 * 가짜 네이버페이(`fakeNaverPay.ts`)가 없거나(`E2E_FAKE_NAVERPAY=0`) 백엔드에 네이버페이가 없으면 통째로 건너뛴다. 인증값이 가맹 심사 뒤에야 나와 진짜 네이버페이로는 돌려 보지 못했다.
 * 이 시험이 백엔드에 기대하는 것은 `globalSetup.ts` 머리말과 이 앱 README 의 「e2e 가 백엔드에 기대하는 것」에 있다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeNaverPayUrl = inject('fakeNaverPayUrl')
const naver = fakeNaverPayUrl ? naverPayControl(fakeNaverPayUrl) : null
const LATE = 90_000

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

describe('a NaverPay one-time payment from the choice to the refund', () => {
  it(
    'pays 3,000원 through NaverPay, shows it in the history, and ends 「환불됨」 after the operator refunds',
    async (ctx) => {
      if (!naver || !(await paymentOn(apiUrl))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      const config = await api(apiUrl, token, 'GET', '/payments/config')
      if (!config.json?.value?.choices?.includes('naverpay')) return ctx.skip()
      await naver.set({ reset: true })

      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/cheer`)
      await pwExpect(page.getByRole('heading', { level: 1, name: ko('cheer.title') })).toBeVisible()
      // 결제 방법이 여럿이면 고르기가 보인다 - 서버가 정한 토스가 처음 골라져 있고, 네이버페이를 고른다
      await pwExpect(page.getByText(ko('cheer.providerLegend'))).toBeVisible()
      await pwExpect(page.getByRole('radio', { name: ko('cheer.provider.toss') })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      await page.getByRole('radio', { name: won(3000) }).click()
      const pick = page.getByRole('radio', { name: ko('cheer.provider.naverpay') })
      await pick.click()
      await pwExpect(pick).toHaveAttribute('aria-checked', 'true')
      await page.getByRole('button', { name: ko('cheer.submit'), exact: true }).click()

      // 결제창(가짜)이 결제를 마치고 paymentId 를 달아 돌려보낸다 → 돌아온 화면이 승인을 보낸다 → 「결제됨」
      await page.waitForURL(/\/payments\/return\?/)
      const orderId = new URL(page.url()).searchParams.get('order')
      if (!orderId) throw new Error(`no order in ${page.url()}`)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      await pwExpect(page.getByText(labels.testMode)).toBeVisible()

      // 결제사에는 예약 한 번 · 승인 한 번 - 금액 · 주문 번호는 서버가 정한 값(예약), 멱등 키는 결제 번호에서
      const state = await naver.state()
      const [payment] = state.payments
      pwExpect(state.calls.map((c) => c.path.split('/').slice(-2).join('/'))).toEqual([
        'v2/reserve',
        'apply/payment',
      ])
      pwExpect(state.calls[0]?.body).toMatchObject({
        merchantPayKey: orderId,
        totalPayAmount: 3000,
        taxScopeAmount: 3000,
        taxExScopeAmount: 0,
      })
      pwExpect(state.calls[1]?.body).toEqual({ paymentId: payment?.paymentId })
      pwExpect(state.calls[1]?.idempotencyKey).toBe(`apply-${payment?.paymentId}`)
      pwExpect(payment).toMatchObject({ merchantPayKey: orderId, total: 3000, applied: true })

      // 새로 고쳐도 승인이 다시 나가지 않는다
      await page.reload()
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      pwExpect(
        (await naver.state()).calls.filter((c) => c.path.endsWith('/apply/payment')),
      ).toHaveLength(1)

      // 내 응원 내역에 한 줄 — 결제됨
      await page.goto(`${baseUrl}/cheers`)
      const row = page
        .getByRole('listitem')
        .filter({ hasText: won(3000) })
        .first()
      await pwExpect(row.getByText(labels.orderStatus.PAID)).toBeVisible()

      // 환불 요청(돈은 안 움직인다) → 운영자 환불
      await page.goto(`${baseUrl}/payments/${orderId}`)
      await page.getByRole('button', { name: labels.summary.requestRefund, exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: labels.refundDialog.confirm }).click()
      await pwExpect(dialog).toBeHidden()
      pwExpect(
        (await naver.state()).calls.filter((c) => c.path.endsWith('/v1/cancel')),
      ).toHaveLength(0)
      const operator = await operatorPage(browser, baseUrl)
      try {
        await operatorRefundsRequest(operator.page, baseUrl, orderId)
      } finally {
        await operator.close()
      }
      await page.reload()
      await pwExpect(page.getByText(labels.orderStatus.REFUNDED).first()).toBeVisible()

      // 결제사에는 취소가 한 번, 전액 - 과세 + 면세가 취소 금액과 같다
      const after = await naver.state()
      const cancels = after.calls.filter((c) => c.path.endsWith('/v1/cancel'))
      pwExpect(cancels).toHaveLength(1)
      pwExpect(cancels[0]?.body).toMatchObject({
        paymentId: payment?.paymentId,
        cancelAmount: '3000',
        taxScopeAmount: '3000',
        taxExScopeAmount: '0',
        cancelRequester: '2',
      })
      pwExpect(after.payments[0]?.cancels.map((c) => c.amount)).toEqual([3000])

      // 결제사가 준 사용자 키 · 카드 정보는 화면에도 우리 API 에도 없다
      const detail = await api(apiUrl, token, 'GET', `/payments/orders/${orderId}`)
      const seen = JSON.stringify(detail.json) + (await page.content())
      for (const planted of Object.values(PLANTED)) pwExpect(seen).not.toContain(planted)
      pwExpect(seen).not.toContain(FAKE_NAVERPAY.clientSecret)
    },
    LATE + 30_000,
  )

  it(
    "a buyer who closes NaverPay's window comes back to 「그만뒀어요」, and a new press makes a new order",
    async (ctx) => {
      if (!naver || !(await paymentOn(apiUrl))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      const config = await api(apiUrl, token, 'GET', '/payments/config')
      if (!config.json?.value?.choices?.includes('naverpay')) return ctx.skip()
      await naver.set({ reset: true })
      await naver.set({ buyer: 'cancel' })

      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/cheer`)
      await page.getByRole('radio', { name: won(1000) }).click()
      await page.getByRole('radio', { name: ko('cheer.provider.naverpay') }).click()
      await page.getByRole('button', { name: ko('cheer.submit'), exact: true }).click()

      await page.waitForURL(/\/payments\/return\?/)
      await pwExpect(resultTitle(page, labels.result.canceled.title)).toBeVisible()
      const orderId = new URL(page.url()).searchParams.get('order')
      // 화면은 주소만으로 먼저 「그만뒀어요」라 하고, 주문을 닫는 호출(abandon)은 곧이어 나간다 - 서버 쪽 상태는 기다려 본다
      await pwExpect
        .poll(async () => {
          const order = await api(apiUrl, token, 'GET', `/payments/orders/${orderId}`)
          return order.json?.value?.order?.status
        })
        .toBe('CANCELED')
      pwExpect(
        (await naver.state()).calls.filter((c) => c.path.endsWith('/apply/payment')),
      ).toHaveLength(0)
    },
    LATE,
  )
})

/*
 * 네이버페이 정기 결제 — 구독하기에서 「네이버페이」를 골라 서버가 등록을 예약하고(돈이 움직이지 않는다) 구매자가 등록창(가짜)에서 마쳐 `reserveId` · `tempReceiptId` 를 달아 돌아온다 →
 * 서버가 등록을 완료해(`recurrentId`) 첫 결제를 한다(예약 → 승인) → 「구독 중」 · 「내 구독」에 네이버페이 → 주기(25초) 끝의 갱신은 같은 두 걸음 → 해지 예약 → 끝나면 등록 해지.
 */
const subscribed = labels.subscription

/** 이 백엔드가 네이버페이 정기 결제를 열어 두었는가 — 구독이 있고 `subscriptionChoices` 에 네이버페이가 든다 */
async function naverSubscriptionsOn() {
  if (!naver || !(await paymentOn(apiUrl)) || !(await subscriptionsOn(apiUrl))) return false
  const config = await api(apiUrl, await tokenOf(apiUrl), 'GET', '/payments/config')
  return Boolean(config.json?.value?.subscriptionChoices?.includes('naverpay'))
}

const pathsOf = (calls: Array<{ path: string }>) =>
  calls.map((c) => c.path.replace('/naverpay-partner/naverpay/payments/recurrent/', ''))

describe('a NaverPay subscription from the choice to the end', () => {
  it('registers without money, charges the first payment and one renewal by reserve then approve, and expires the registration when it ends', async (ctx) => {
    if (!(await naverSubscriptionsOn())) return ctx.skip()
    await endLiveSubscription(apiUrl)
    await naver!.set({ reset: true })

    await ensureSignedIn(page, baseUrl)
    await page.goto(`${baseUrl}/subscribe`)
    await pwExpect(page.getByText(ko('subscription.subscribe.providerLegend'))).toBeVisible()
    const pick = page.getByRole('radio', { name: ko('cheer.provider.naverpay') })
    await pick.click()
    await pwExpect(pick).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: /구독하기.*베이직/ }).click()

    // 등록창(가짜) → 돌아와서 등록 완료 + 첫 결제 → 「결제됨」
    await page.waitForURL(/\/subscriptions\/return\?/)
    await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()

    // 내 구독 - 상태 · 네이버페이(앱 이름)
    await page.goto(`${baseUrl}/subscription`)
    await pwExpect(page.getByText(subscribed.status.ACTIVE).first()).toBeVisible()
    await pwExpect(page.getByText('네이버페이').first()).toBeVisible()

    // 결제사에는 등록 예약 · 등록 완료(돈 없음) → 자동결제 예약 · 승인. 정기 인증값이었고 가려진 이메일 · 구분값은 어디에도 없다
    const first = await naver!.state()
    pwExpect(pathsOf(first.calls)).toEqual([
      'regist/v1/reserve',
      'regist/v1/approval',
      'pay/v3/reserve',
      'pay/v3/approval',
    ])
    pwExpect(first.calls[0]?.body).toMatchObject({ totalPayAmount: 3900 })
    pwExpect(first.calls[2]?.body).toMatchObject({ totalPayAmount: 3900 })
    pwExpect(Object.values(first.recurrents)).toEqual([true])
    pwExpect(first.payments).toHaveLength(1)
    const seen =
      JSON.stringify(
        await api(apiUrl, await tokenOf(apiUrl), 'GET', '/payments/subscriptions/me'),
      ) + (await page.content())
    for (const planted of Object.values(PLANTED)) pwExpect(seen).not.toContain(planted)
    for (const recurrentId of Object.keys(first.recurrents))
      pwExpect(seen).not.toContain(recurrentId)

    // 주기(25초) 끝에 갱신이 한 번 - 같은 두 걸음, 새 주문 번호
    await pwExpect
      .poll(async () => (await mySubscription(apiUrl)).orders.length, {
        timeout: 120_000,
        intervals: [1_000],
      })
      .toBeGreaterThanOrEqual(2)
    const mine = await mySubscription(apiUrl)
    pwExpect(mine.orders.map((o) => o.kind).sort()).toEqual([
      'SUBSCRIPTION_INITIAL',
      'SUBSCRIPTION_RENEWAL',
    ])
    pwExpect(mine.orders.every((o) => o.status === 'PAID')).toBe(true)
    const state = await naver!.state()
    pwExpect(state.calls.filter((c) => c.path.endsWith('/pay/v3/approval'))).toHaveLength(2)
    pwExpect(new Set(state.payments.map((p) => p.merchantPayKey)).size).toBe(2)

    // 해지 예약 → 기간 끝에 끝나면서 등록이 해지된다
    await endLiveSubscription(apiUrl)
    await pwExpect
      .poll(async () => Object.values((await naver!.state()).recurrents), {
        timeout: 60_000,
        intervals: [1_000],
      })
      .toEqual([false])
    pwExpect(
      (await naver!.state()).calls.filter((c) => c.path.endsWith('/expire/v1/request')),
    ).toHaveLength(1)
  }, 240_000)

  it("a buyer who closes NaverPay's registration window comes back to 「그만뒀어요」, nothing is charged and no subscription starts", async (ctx) => {
    if (!(await naverSubscriptionsOn())) return ctx.skip()
    await endLiveSubscription(apiUrl)
    await naver!.set({ reset: true })
    await naver!.set({ buyer: 'cancel' })

    await ensureSignedIn(page, baseUrl)
    await page.goto(`${baseUrl}/subscribe`)
    await page.getByRole('radio', { name: ko('cheer.provider.naverpay') }).click()
    await page.getByRole('button', { name: /구독하기.*베이직/ }).click()

    await page.waitForURL(/\/subscriptions\/return\?/)
    await pwExpect(page.getByText(ko('subscription.return.closedTitle'))).toBeVisible()
    const state = await naver!.state()
    pwExpect(state.payments).toHaveLength(0)
    pwExpect(state.calls.filter((c) => c.path.includes('/pay/v3/'))).toHaveLength(0)
    const mine = await mySubscription(apiUrl, DEMO)
    pwExpect(mine.subscription?.status ?? 'NONE').toMatch(/^(NONE|ENDED|PENDING)$/)
  }, 120_000)
})
