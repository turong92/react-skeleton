import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { FAKE_KAKAOPAY, PLANTED, kakaoPayControl } from './fakeKakaoPay'
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
 * 카카오페이 직접 연동(단건) — 한 흐름: 응원하기에서 「카카오페이」를 골라 결제 → 가짜 카카오페이의 결제창이 인증을 마치고 돌려보낸다(`pg_token`) → 서버가 승인 → 「결제됨」 →
 * 내 응원 내역 → 환불 요청 → 운영자 환불 → 「환불됨」. 같은 나라(KR)에 토스와 카카오페이가 둘 다 켜져 있어야 「결제 방법」 고르기가 보인다(백엔드 `GET /payments/config` 의 `choices`).
 * 가짜 카카오페이(`fakeKakaoPay.ts`)가 없거나(`E2E_FAKE_KAKAOPAY=0`) 백엔드에 카카오페이가 없으면 통째로 건너뛴다.
 * 이 시험이 백엔드에 기대하는 것은 `globalSetup.ts` 머리말과 이 앱 README 의 「e2e 가 백엔드에 기대하는 것」에 있다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeKakaoPayUrl = inject('fakeKakaoPayUrl')
const kakao = fakeKakaoPayUrl ? kakaoPayControl(fakeKakaoPayUrl) : null
const LATE = 90_000

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

describe('a KakaoPay one-time payment from the choice to the refund', () => {
  it(
    'pays 3,000원 through KakaoPay, shows it in the history, and ends 「환불됨」 after the operator refunds',
    async (ctx) => {
      if (!kakao || !(await paymentOn(apiUrl))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      const config = await api(apiUrl, token, 'GET', '/payments/config')
      if (!config.json?.value?.choices?.includes('kakaopay')) return ctx.skip()
      await kakao.set({ reset: true })

      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/cheer`)
      await pwExpect(page.getByRole('heading', { level: 1, name: ko('cheer.title') })).toBeVisible()
      // 결제 방법이 둘이면 고르기가 보인다 - 서버가 정한 토스가 처음 골라져 있고, 카카오페이를 고른다
      await pwExpect(page.getByText(ko('cheer.providerLegend'))).toBeVisible()
      await pwExpect(page.getByRole('radio', { name: ko('cheer.provider.toss') })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      const amount = page.getByRole('radio', { name: won(3000) })
      await amount.click()
      const pick = page.getByRole('radio', { name: ko('cheer.provider.kakaopay') })
      await pick.click()
      await pwExpect(pick).toHaveAttribute('aria-checked', 'true')
      await page.getByRole('button', { name: ko('cheer.submit'), exact: true }).click()

      // 결제창(가짜)이 인증을 마치고 pg_token 을 달아 돌려보낸다 → 돌아온 화면이 승인을 보낸다 → 「결제됨」
      await page.waitForURL(/\/payments\/return\?/)
      const orderId = new URL(page.url()).searchParams.get('order')
      if (!orderId) throw new Error(`no order in ${page.url()}`)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      await pwExpect(page.getByText(labels.testMode)).toBeVisible()

      // 결제사에는 준비 한 번 · 승인 한 번, 금액은 서버가 정한 값 - 승인 토큰은 호출 기록에 없다
      const state = await kakao.state()
      const paths = state.calls.map((c) => c.path.replace('/online/v1/payment/', ''))
      pwExpect(paths).toEqual(['ready', 'approve'])
      pwExpect(state.calls[0]?.body).toMatchObject({
        cid: FAKE_KAKAOPAY.cid,
        partner_order_id: orderId,
        total_amount: 3000,
      })
      pwExpect(state.calls[1]?.body).toMatchObject({
        partner_order_id: orderId,
        total_amount: 3000,
      })
      pwExpect(state.payments.map((p) => p.status)).toEqual(['SUCCESS_PAYMENT'])

      // 새로 고쳐도 승인이 다시 나가지 않는다
      await page.reload()
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      pwExpect((await kakao.state()).calls.filter((c) => c.path.endsWith('/approve'))).toHaveLength(
        1,
      )

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
      pwExpect((await kakao.state()).calls.filter((c) => c.path.endsWith('/cancel'))).toHaveLength(
        0,
      )
      const operator = await operatorPage(browser, baseUrl)
      try {
        await operatorRefundsRequest(operator.page, baseUrl, orderId)
      } finally {
        await operator.close()
      }
      await page.reload()
      await pwExpect(page.getByText(labels.orderStatus.REFUNDED).first()).toBeVisible()

      // 결제사에는 취소가 한 번, 전액
      const after = await kakao.state()
      const cancels = after.calls.filter((c) => c.path.endsWith('/cancel'))
      pwExpect(cancels).toHaveLength(1)
      pwExpect(cancels[0]?.body).toMatchObject({ cancel_amount: 3000 })
      pwExpect(after.payments[0]?.status).toBe('CANCEL_PAYMENT')

      // 결제사가 준 이름 · 카드 정보는 화면에도 우리 API 에도 없다
      const detail = await api(apiUrl, token, 'GET', `/payments/orders/${orderId}`)
      const seen = JSON.stringify(detail.json) + (await page.content())
      for (const planted of Object.values(PLANTED)) pwExpect(seen).not.toContain(planted)
    },
    LATE + 30_000,
  )

  it(
    "a buyer who closes KakaoPay's window comes back to 「그만뒀어요」, and a new press makes a new order",
    async (ctx) => {
      if (!kakao || !(await paymentOn(apiUrl))) return ctx.skip()
      const token = await tokenOf(apiUrl)
      const config = await api(apiUrl, token, 'GET', '/payments/config')
      if (!config.json?.value?.choices?.includes('kakaopay')) return ctx.skip()
      await kakao.set({ reset: true })
      await kakao.set({ buyer: 'cancel' })

      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/cheer`)
      await page.getByRole('radio', { name: won(1000) }).click()
      await page.getByRole('radio', { name: ko('cheer.provider.kakaopay') }).click()
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
      pwExpect((await kakao.state()).calls.filter((c) => c.path.endsWith('/approve'))).toHaveLength(
        0,
      )
    },
    LATE,
  )
})
