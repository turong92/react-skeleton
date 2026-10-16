import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { FAKE_NAVERPAY, PLANTED, naverPayControl, routeNaverPaySdk } from './fakeNaverPay'
import { ko, launch } from './helpers'
import {
  api,
  ensureSignedIn,
  labels,
  operatorPage,
  operatorRefundsRequest,
  paymentOn,
  resultTitle,
  tokenOf,
  won,
} from './paymentSteps'

/*
 * 네이버페이 직접 연동(단건) — 한 흐름: 응원하기에서 「네이버페이」를 골라 결제 → 브라우저의 네이버 SDK(가짜로 가로챈다)가 결제창을 열고 결제를 마쳐 `paymentId` 를 달아 돌려보낸다 → 서버가 승인 →
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
let context: BrowserContext
let page: Page
beforeAll(async () => {
  ;({ browser, context, page } = await launch())
  // 브라우저의 네이버 SDK 스크립트는 가짜로 바꾼다(진짜 `nsp.pay.naver.com` 에는 닿지 않는다)
  if (fakeNaverPayUrl) await routeNaverPaySdk(context, fakeNaverPayUrl)
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

      // 결제창(가짜 SDK)이 결제를 마치고 paymentId 를 달아 돌려보낸다 → 돌아온 화면이 승인을 보낸다 → 「결제됨」
      await page.waitForURL(/\/payments\/return\?/)
      const orderId = new URL(page.url()).searchParams.get('order')
      if (!orderId) throw new Error(`no order in ${page.url()}`)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      await pwExpect(page.getByText(labels.testMode)).toBeVisible()

      // 결제사에는 승인 한 번뿐이다(결제 준비 호출이 없다) - 멱등 키는 결제 번호에서, 승인 응답의 주문 번호 · 금액은 우리 주문과 같다
      const state = await naver.state()
      const [payment] = state.payments
      pwExpect(state.calls.map((c) => c.path.split('/').slice(-2).join('/'))).toEqual([
        'apply/payment',
      ])
      pwExpect(state.calls[0]?.body).toEqual({ paymentId: payment?.paymentId })
      pwExpect(state.calls[0]?.idempotencyKey).toBe(`apply-${payment?.paymentId}`)
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
