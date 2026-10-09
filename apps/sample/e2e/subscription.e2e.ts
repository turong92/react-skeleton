import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { routeTossSdk, tossControl } from './fakeToss'
import { DEMO, launch } from './helpers'
import { api, ensureSignedIn, labels, resultTitle, tokenOf } from './paymentSteps'

/*
 * 구독(결제 2단계) — 플랜 → 카드 등록(가짜 토스 SDK 의 `requestBillingAuth`) → 첫 결제 → 「내 구독」 → 해지 예약, 거절된 첫 결제, 주기 끝의 갱신 한 번을 가짜 토스와 진짜 백엔드·브라우저로 끝까지.
 * 백엔드의 견본 플랜 주기는 25초, 거절된 갱신의 재시도는 8초 뒤다(`paymentE2eConfig.ts`). 구독이 없는 백엔드(`GET /payments/subscriptions/plans` 가 404)면 통째로 건너뛴다.
 * ① 베이직 구독 → 「구독 중」·카드 ····1234 → 해지 예약(확인 창) → 「해지 예약됨」·「○에 끝나요」(다시 눌러도 같은 답)
 * ② 카드사가 첫 결제를 거절 → 결과 「결제 안 됨」 → 「내 구독」은 「끝남」(구독이 시작되지 않았다) → 다시 구독할 수 있다
 * ③ 구독 한 번 + 주기 끝 갱신 한 번 → 결제사 승인이 정확히 두 번(첫 결제 · 갱신), 결제 내역 둘 → 해지해 더 과금되지 않게 닫는다
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
const SECOND = { email: 'moderator@example.com', password: 'password' }
const subscribed = labels.subscription

let browser: Browser
let context: BrowserContext
let page: Page
beforeAll(async () => {
  ;({ browser, context, page } = await launch())
  if (fakeTossUrl) await routeTossSdk(context, fakeTossUrl)
})
afterAll(async () => {
  await browser?.close()
})

let probe: Promise<boolean> | undefined
const subscriptionsOn = () =>
  (probe ??= tokenOf(apiUrl).then(
    async (token) =>
      (await api(apiUrl, token, 'GET', '/payments/subscriptions/plans')).status === 200,
  ))

const run = (name: string, fn: () => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!toss || !(await subscriptionsOn())) return ctx.skip()
      await toss.set({ reset: true })
      await fn()
    },
    150_000,
  )

/** 이 계정의 살아 있는 구독을 닫는다(다음 시나리오가 다시 구독할 수 있게) — 해지 예약이면 주기 끝에 끝난다 */
async function cancelIfAny(account: { email: string; password: string }) {
  const token = await tokenOf(apiUrl, account)
  const me = await api(apiUrl, token, 'GET', '/payments/subscriptions/me')
  const sub = me.json?.value?.subscription
  if (sub && (sub.status === 'ACTIVE' || sub.status === 'PAST_DUE'))
    await api(apiUrl, token, 'POST', `/payments/subscriptions/${sub.id}/cancel`)
}

/** 살아 있는 구독이 없어질 때까지 기다린다 - 해지 예약된 구독은 주기(25초) 끝에 갱신 작업이 끝낸다 */
async function untilNoLiveSubscription(account: { email: string; password: string }) {
  await cancelIfAny(account)
  await pwExpect
    .poll(async () => (await me(account)).subscription?.status ?? 'NONE', {
      timeout: 90_000,
      intervals: [1_000],
    })
    .toMatch(/^(NONE|ENDED)$/)
}

const me = async (account = DEMO) =>
  (await api(apiUrl, await tokenOf(apiUrl, account), 'GET', '/payments/subscriptions/me')).json
    ?.value as {
    subscription: null | {
      id: string
      status: string
      card: { issuer: string; last4: string } | null
      currentPeriodEnd: string
      endReason: string | null
    }
    orders: Array<{ id: string; kind: string; status: string }>
  }

describe('① the whole journey: pick a plan, register the card, pay, see it, reserve the end', () => {
  run('a Basic subscription turns 「구독 중」 and a reserved end says when it ends', async () => {
    await cancelIfAny(DEMO)
    await ensureSignedIn(page, baseUrl)
    await page.goto(`${baseUrl}/subscribe`)
    await page.getByRole('button', { name: /구독하기.*베이직/ }).click()

    // 카드 등록 창(가짜) → 돌아와서 첫 결제 → 「결제됨」
    await page.waitForURL(/\/subscriptions\/return\?/)
    await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()

    // 내 구독 — 상태 · 카드 · 다음 결제일
    await page.goto(`${baseUrl}/subscription`)
    await pwExpect(page.getByText(subscribed.status.ACTIVE).first()).toBeVisible()
    await pwExpect(page.getByText('현대카드 ····1234').first()).toBeVisible()
    await pwExpect(page.getByText(subscribed.mine.nextPayment).first()).toBeVisible()

    // 해지 예약 → 확인 창 → 「해지 예약됨」
    await page.getByRole('button', { name: subscribed.mine.cancel, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: subscribed.cancelDialog.confirm }).click()
    await pwExpect(dialog).toBeHidden()
    await pwExpect(page.getByText(subscribed.status.CANCELING).first()).toBeVisible()
    await pwExpect(page.getByText(/에 끝나요/).first()).toBeVisible()

    const mine = await me()
    expect(mine.subscription?.status).toBe('CANCELING')
    expect(mine.orders.map((o) => o.kind)).toEqual(['SUBSCRIPTION_INITIAL'])
    // 결제사에는 카드 등록 교환(발급) 한 번 + 승인 한 번만 갔다
    const calls = (await toss!.state()).calls.filter((c) => c.path.startsWith('/v1/billing'))
    expect(calls.map((c) => c.method + ' ' + c.path.replace(/bkey_[^/]+/, '{key}'))).toEqual([
      'POST /v1/billing/authorizations/issue',
      'POST /v1/billing/{key}',
    ])
    // 평문 빌링키는 화면 어디에도 없다
    expect(await page.content()).not.toMatch(/bkey_/)
  })
})

describe('② the card company refuses the first payment', () => {
  run(
    'the result says it did not go through and 「내 구독」 shows no running subscription',
    async () => {
      await untilNoLiveSubscription(DEMO)
      await ensureSignedIn(page, baseUrl)
      await toss!.set({ billing: { mode: 'decline', code: 'REJECT_CARD_COMPANY' } })
      await page.goto(`${baseUrl}/subscribe`)
      await page.getByRole('button', { name: /구독하기.*스탠다드/ }).click()
      await page.waitForURL(/\/subscriptions\/return\?/)
      await pwExpect(resultTitle(page, labels.result.failed.title)).toBeVisible()

      const mine = await me()
      expect(mine.subscription?.status).toBe('ENDED')
      expect(mine.subscription?.endReason).toBe('FIRST_PAYMENT_DECLINED')
      expect(mine.subscription?.card).toBeNull()
      // 빌링키는 결제사에서 지워졌다(끝난 구독은 살아 있는 카드를 남기지 않는다)
      await pwExpect
        .poll(async () => (await toss!.state()).billingKeys.length, { timeout: 60_000 })
        .toBe(0)

      // 다시 구독할 수 있다
      await page.goto(`${baseUrl}/subscribe`)
      await page.getByRole('button', { name: /구독하기.*베이직/ }).click()
      await page.waitForURL(/\/subscriptions\/return\?/)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      await cancelIfAny(DEMO)
    },
  )
})

describe('③ the renewal at the end of the period', () => {
  run('is charged exactly once and shows as a second payment', async () => {
    await cancelIfAny(SECOND)
    const token = await tokenOf(apiUrl, SECOND)
    const started = await api(
      apiUrl,
      token,
      'POST',
      '/payments/subscriptions',
      { planCode: 'basic' },
      { 'Idempotency-Key': `e2e-renew-${Date.now()}` },
    )
    expect(started.status).toBe(201)
    const id = started.json.value.subscription.id as string
    const customerKey = started.json.value.billingAuth.customerKey as string
    const authKey = (
      (await (
        await fetch(`${fakeTossUrl}/sdk/authorize-billing`, {
          method: 'POST',
          body: JSON.stringify({ customerKey }),
        })
      ).json()) as { authKey: string }
    ).authKey
    const activated = await api(apiUrl, token, 'POST', `/payments/subscriptions/${id}/activate`, {
      providerPayload: { authKey },
    })
    expect(activated.status).toBe(200)
    expect(activated.json.value.status).toBe('ACTIVE')

    // 주기(25초) 끝에 갱신이 한 번 나간다
    await pwExpect
      .poll(async () => (await me(SECOND)).orders.length, { timeout: 120_000, intervals: [1_000] })
      .toBeGreaterThanOrEqual(2)
    const mine = await me(SECOND)
    expect(mine.orders.map((o) => o.kind).sort()).toEqual([
      'SUBSCRIPTION_INITIAL',
      'SUBSCRIPTION_RENEWAL',
    ])
    expect(mine.subscription?.status).toBe('ACTIVE')
    const charges = (await toss!.state()).calls.filter(
      (c) => c.method === 'POST' && /^\/v1\/billing\/(?!authorizations)/.test(c.path),
    )
    expect(charges).toHaveLength(2)
    expect(new Set(charges.map((c) => c.idempotencyKey)).size).toBe(2) // 주문마다 멱등 키가 다르다

    await cancelIfAny(SECOND)
  })
})
