import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { paddleControl, routePaddleSdk } from './fakePaddle'
import { tossControl } from './fakeToss'
import { DEMO, launch } from './helpers'
import {
  ADMIN,
  adminPaymentsOn,
  api,
  ensureSignedIn,
  labels,
  operatorOpensPayment,
  operatorPage,
  resultTitle,
  tokenOf,
} from './paymentSteps'

/*
 * 해외 결제(Paddle) — 한 흐름: 구독 시작(결제창 → 서명된 웹훅) → 갱신 웹훅 → 같은 웹훅을 다시 받아도 한 번만 → 순서가 뒤바뀐 낡은 웹훅 → 기간 끝 해지(Paddle API) → 기간이 끝나면 끝난다.
 * 가짜 Paddle(`fakePaddle.ts`)이 진짜처럼 서명한 웹훅을 진짜 백엔드로 쏜다. 구독이 없는 백엔드나 가짜 Paddle 이 꺼진 실행(`E2E_FAKE_PADDLE=0`)이면 건너뛴다.
 * 접속 나라가 미국이면(헤더 `CF-IPCountry: US`) 서버가 Paddle 을 고른다(한국이면 토스). 이 흐름에서 **우리 갱신 작업은 토스 쪽으로도 Paddle 로도 과금하지 않는다** - 토스 승인 호출이 0 이다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakePaddleUrl = inject('fakePaddleUrl')
const fakeTossUrl = inject('fakeTossUrl')
const paddle = fakePaddleUrl ? paddleControl(fakePaddleUrl) : null
const subscribed = labels.subscription

let browser: Browser
let context: BrowserContext
let page: Page
beforeAll(async () => {
  ;({ browser, context, page } = await launch())
  // 구매자 나라는 서버가 접속 나라(Cloudflare 의 CF-IPCountry)로 정한다 - 이 흐름은 미국 방문자(→ Paddle)다
  await context.setExtraHTTPHeaders({ 'CF-IPCountry': 'US' })
  if (fakePaddleUrl) await routePaddleSdk(context, fakePaddleUrl)
})
afterAll(async () => {
  await browser?.close()
})

const mine = async () =>
  (await api(apiUrl, await tokenOf(apiUrl, DEMO), 'GET', '/payments/subscriptions/me')).json
    ?.value as {
    subscription: null | {
      id: string
      status: string
      provider: string
      providerManaged: boolean
      amount: { amount: number; currency: string }
      endReason: string | null
    }
    orders: Array<{
      id: string
      kind: string
      status: string
      amount: { amount: number; currency: string }
    }>
  }

describe('a Paddle subscription from the first payment to the end of the period', () => {
  it('starts by webhook, renews by webhook once, is cancelable only at the period end, and ends', async (ctx) => {
    const token = await tokenOf(apiUrl, DEMO)
    const config = await api(apiUrl, token, 'GET', '/payments/config')
    const plans = await api(apiUrl, token, 'GET', '/payments/subscriptions/plans')
    if (!paddle || plans.status !== 200 || !config.json?.value?.providers?.includes('paddle'))
      return ctx.skip()
    await paddle.set({ reset: true })
    // 가짜 토스는 파일 사이에 기록이 남는다 - 이 흐름이 더한 호출만 센다
    const tossBefore = fakeTossUrl ? (await tossControl(fakeTossUrl).state()).calls.length : 0
    const existing = (await mine()).subscription
    if (
      existing &&
      (existing.status === 'ACTIVE' ||
        existing.status === 'PAST_DUE' ||
        existing.status === 'CANCELING')
    )
      return ctx.skip() // 앞 시나리오가 닫지 못한 구독 - 이 흐름은 새 계정 상태를 전제한다

    // 1. 구독 시작 - 접속 나라 미국 → Paddle 결제창(대역) → 돌아온 화면이 서버를 되묻는다
    await ensureSignedIn(page, baseUrl)
    await page.goto(`${baseUrl}/subscribe`)
    await pwExpect(page.getByText(/결제 국가: 미국/)).toBeVisible()
    // 플랜 목록의 금액은 Paddle 가격(달러)이다 - 우리 플랜 표의 원화가 아니다
    await pwExpect(page.getByText('$3.99 · 1개월마다 결제')).toBeVisible()
    await pwExpect(page.getByText(/원 · 1개월마다 결제/)).toHaveCount(0)
    await page.getByRole('button', { name: /구독하기.*베이직/ }).click()
    await page.waitForURL(/\/subscriptions\/return\?.*provider=paddle/)
    await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()

    const started = await mine()
    expect(started.subscription).toMatchObject({
      status: 'ACTIVE',
      provider: 'paddle',
      providerManaged: true,
    })
    // 금액 · 통화는 Paddle 이 말한 그대로(미국 달러) - 우리 플랜의 원화가 아니다
    expect(started.subscription?.amount).toEqual({ amount: 399, currency: 'USD' })
    expect(started.orders.map((o) => o.kind)).toEqual(['SUBSCRIPTION_INITIAL'])
    const providerSub = (await paddle.state()).subscriptions[0]!
    // 거래는 백엔드가 만들었다: 서버가 정한 가격 · 우리 구독 줄 id 가 들어 있다(브라우저가 넘긴 값이 아니다)
    const created = (await paddle.state()).transactions[0]!
    expect(created.items).toEqual([{ price_id: 'pri_e2e_basic', quantity: 1 }])
    expect(created.custom_data).toMatchObject({ subscriptionId: started.subscription!.id })

    // 내 구독 - 해지는 기간 끝에만(환불 있는 중도 해지 · 플랜 올리기는 열리지 않는다)
    await page.goto(`${baseUrl}/subscription`)
    await pwExpect(page.getByText(subscribed.status.ACTIVE).first()).toBeVisible()
    await pwExpect(page.getByRole('button', { name: subscribed.mine.cancelNow })).toHaveCount(0)
    await pwExpect(page.getByRole('button', { name: subscribed.mine.changePlan })).toHaveCount(0)

    // 2. 갱신 - Paddle 이 다음 기간을 결제했다. 주문이 하나 늘고 구독은 그대로
    await paddle.set({ renew: providerSub.id })
    await pwExpect
      .poll(async () => (await mine()).orders.length, { timeout: 30_000, intervals: [500] })
      .toBe(2)
    expect((await mine()).orders.map((o) => o.kind).sort()).toEqual([
      'SUBSCRIPTION_INITIAL',
      'SUBSCRIPTION_RENEWAL',
    ])

    // 3. 같은 웹훅 재전송 + 순서가 뒤바뀐 낡은 웹훅 - 주문은 늘지 않고 상태는 그대로
    const renewalEvent = (await paddle.state()).sent
      .filter((s) => s.eventType === 'transaction.completed')
      .at(-1)!
    await paddle.set({ replay: renewalEvent.eventId })
    await paddle.set({ stale: providerSub.id })
    await new Promise((r) => setTimeout(r, 4_000)) // 작업이 돌 시간
    const afterReplay = await mine()
    expect(afterReplay.orders).toHaveLength(2)
    expect(afterReplay.subscription?.status).toBe('ACTIVE')

    // 4. 기간 끝 해지 - 우리 서버가 Paddle 에 요청한다(effective_from = next_billing_period)
    await page.goto(`${baseUrl}/subscription`)
    await page.getByRole('button', { name: subscribed.mine.cancel, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: subscribed.cancelDialog.confirm }).click()
    await pwExpect(dialog).toBeHidden()
    await pwExpect(page.getByText(subscribed.status.CANCELING).first()).toBeVisible()
    const state = await paddle.state()
    expect(state.calls.filter((c) => c.path.endsWith('/cancel'))).toHaveLength(1)
    expect(state.calls.find((c) => c.path.endsWith('/cancel'))).toMatchObject({
      path: `/subscriptions/${providerSub.id}/cancel`,
      authorized: true,
      body: { effective_from: 'next_billing_period' },
    })

    // 5. 기간이 끝났다 - Paddle 이 알린다
    await paddle.set({ endPeriod: providerSub.id })
    await pwExpect
      .poll(async () => (await mine()).subscription?.status, { timeout: 30_000, intervals: [500] })
      .toBe('ENDED')
    expect((await mine()).subscription?.endReason).toBe('USER_CANCELED')

    // 우리 쪽 어디도 과금하지 않았다: 토스 승인 호출 0, Paddle 로 간 요청은 해지 하나뿐
    if (fakeTossUrl) {
      const tossCalls = (await tossControl(fakeTossUrl).state()).calls
        .slice(tossBefore)
        .filter(
          (c) => c.path.startsWith('/v1/billing') || c.path.startsWith('/v1/payments/confirm'),
        )
      expect(tossCalls).toEqual([])
    }
    expect((await paddle.state()).calls.filter((c) => c.path.endsWith('/cancel'))).toHaveLength(1)
    // 보낸 웹훅은 모두 받아들여졌다(서명 통과)
    expect((await paddle.state()).sent.every((s) => s.status === 200)).toBe(true)
  }, 180_000)
})

describe('refunding a Paddle subscription charge', () => {
  it("is held for review, ends by Paddle's decision webhook, and ends the subscription only when the operator left the choice on", async (ctx) => {
    const token = await tokenOf(apiUrl, DEMO)
    const config = await api(apiUrl, token, 'GET', '/payments/config')
    const plans = await api(apiUrl, token, 'GET', '/payments/subscriptions/plans')
    if (
      !paddle ||
      plans.status !== 200 ||
      !config.json?.value?.providers?.includes('paddle') ||
      !(await adminPaymentsOn(apiUrl))
    )
      return ctx.skip()
    await paddle.set({ reset: true })
    const existing = (await mine()).subscription
    if (
      existing &&
      (existing.status === 'ACTIVE' ||
        existing.status === 'PAST_DUE' ||
        existing.status === 'CANCELING')
    )
      return ctx.skip()

    // 구독을 시작한다(접속 나라 미국 → Paddle)
    await ensureSignedIn(page, baseUrl)
    await page.goto(`${baseUrl}/subscribe`)
    await page.getByRole('button', { name: /구독하기.*베이직/ }).click()
    await page.waitForURL(/\/subscriptions\/return\?.*provider=paddle/)
    await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
    const started = await mine()
    const initial = started.orders.find((o) => o.kind === 'SUBSCRIPTION_INITIAL')!
    const providerSub = (await paddle.state()).subscriptions[0]!
    const admin = await tokenOf(apiUrl, ADMIN)
    const adminOrder = async (id: string) =>
      (await api(apiUrl, admin, 'GET', `/admin/payments/orders/${id}`)).json?.value as {
        order: { status: string; refundedAmount: number; refundBlock: string | null }
        refunds: Array<{ status: string; failureCode: string | null; keepSubscription: boolean }>
      }
    const cancels = async () =>
      (await paddle.state()).calls.filter((c) => c.path.endsWith('/cancel'))

    // 1. 「구독도 해지」를 끄고 전액 환불 - Paddle 이 검토 중으로 쥔다(202), 장부는 줄을 열어 둔다
    expect((await adminOrder(initial.id)).order.refundBlock).toBeNull()
    const kept = await api(
      apiUrl,
      admin,
      'POST',
      `/admin/payments/orders/${initial.id}/refunds`,
      { reasonCode: 'OPERATOR', amount: 399, endSubscription: false },
      { 'Idempotency-Key': `e2e-paddle-keep-${Date.now()}` },
    )
    expect(kept.status).toBe(202)
    expect(kept.json.value).toMatchObject({
      status: 'PENDING',
      failureCode: 'PROVIDER_PENDING',
      keepSubscription: true,
    })
    const adjustments = (await paddle.state()).calls.filter((c) => c.path === '/adjustments')
    expect(adjustments).toHaveLength(1)
    expect(adjustments[0]).toMatchObject({
      authorized: true,
      body: { action: 'refund', transaction_id: expect.any(String), type: 'full' },
    })
    // 운영자 화면은 「결제사 검토 중」이라고 말한다
    const operator = await operatorPage(browser, baseUrl)
    try {
      await operatorOpensPayment(operator.page, baseUrl, initial.id)
      await pwExpect(
        operator.page.getByText(labels.admin.refundFailure.PROVIDER_PENDING!),
      ).toBeVisible()
    } finally {
      await operator.close()
    }

    // 2. Paddle 이 승인했다 - 웹훅이 줄을 끝낸다. 구독은 그대로고 Paddle 에는 해지를 보내지 않는다
    const first = (await paddle.state()).adjustments[0]!
    await paddle.set({ decide: { id: first.id, status: 'approved' } })
    await pwExpect
      .poll(async () => (await adminOrder(initial.id)).order.status, {
        timeout: 30_000,
        intervals: [500],
      })
      .toBe('REFUNDED')
    expect((await adminOrder(initial.id)).refunds[0]).toMatchObject({ status: 'SUCCEEDED' })
    expect((await mine()).subscription?.status).toBe('ACTIVE')
    expect(await cancels()).toHaveLength(0)

    // 3. 갱신 결제를 기본 선택(구독도 해지)으로 전액 환불 - 승인되면 구독이 끝나고 Paddle 에도 즉시 해지가 간다
    await paddle.set({ renew: providerSub.id })
    await pwExpect
      .poll(async () => (await mine()).orders.length, { timeout: 30_000, intervals: [500] })
      .toBe(2)
    const renewal = (await mine()).orders.find((o) => o.kind === 'SUBSCRIPTION_RENEWAL')!
    const ended = await api(
      apiUrl,
      admin,
      'POST',
      `/admin/payments/orders/${renewal.id}/refunds`,
      { reasonCode: 'OPERATOR', amount: 399 },
      { 'Idempotency-Key': `e2e-paddle-end-${Date.now()}` },
    )
    expect(ended.status).toBe(202)
    expect(ended.json.value.keepSubscription).toBe(false)
    const second = (await paddle.state()).adjustments.find((a) => a.status === 'pending_approval')!
    await paddle.set({ decide: { id: second.id, status: 'approved' } })
    await pwExpect
      .poll(async () => (await mine()).subscription?.status, { timeout: 30_000, intervals: [500] })
      .toBe('ENDED')
    expect((await mine()).subscription?.endReason).toBe('REFUNDED')
    await pwExpect.poll(async () => (await cancels()).length, { timeout: 30_000 }).toBe(1)
    expect((await cancels())[0]).toMatchObject({
      path: `/subscriptions/${providerSub.id}/cancel`,
      authorized: true,
      body: { effective_from: 'immediately' },
    })
    expect((await paddle.state()).sent.every((s) => s.status === 200)).toBe(true)
  }, 180_000)
})
