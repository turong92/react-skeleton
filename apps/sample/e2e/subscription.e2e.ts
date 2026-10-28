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
 * ④ 베이직 → 「플랜 바꾸기」(금액 미리보기 → 확인) → 스탠다드, 결제사 승인은 변경 몫으로 한 번 더 (남은 기간 차액만)
 * ⑥ 월 베이직 → 연 베이직(주기 늘리기는 「바로」, 남은 이용분을 빼고 새 주기) ⑦ 스탠다드 → 베이직(내리기는 「다음 결제일부터」 예약, 지금 결제 없음) → 「예약 거두기」로 스탠다드 그대로 (백엔드 K4 의 갈아타기가 있어야 돈다)
 * ⑤ 베이직 → 「지금 해지하고 환불」(환불 예정 금액·계산 내역 → 확인) → 「끝남」, 결제사 취소는 낸 금액만큼 정확히 한 번(견본 정책: 7일 안이면 전액)
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

describe('④ raising the plan', () => {
  run('shows what is charged now, then switches to Standard with one more charge', async () => {
    await untilNoLiveSubscription(DEMO)
    // 구독은 API 로 빠르게 연다(주기가 25초라 화면 걸음이 길면 갱신이 먼저 온다)
    const token = await tokenOf(apiUrl, DEMO)
    const started = await api(
      apiUrl,
      token,
      'POST',
      '/payments/subscriptions',
      { planCode: 'basic' },
      { 'Idempotency-Key': `e2e-raise-${Date.now()}` },
    )
    expect(started.status).toBe(201)
    const id = started.json.value.subscription.id as string
    const authKey = (
      (await (
        await fetch(`${fakeTossUrl}/sdk/authorize-billing`, {
          method: 'POST',
          body: JSON.stringify({ customerKey: started.json.value.billingAuth.customerKey }),
        })
      ).json()) as { authKey: string }
    ).authKey
    expect(
      (
        await api(apiUrl, token, 'POST', `/payments/subscriptions/${id}/activate`, {
          providerPayload: { authKey },
        })
      ).status,
    ).toBe(200)

    await ensureSignedIn(page, baseUrl)
    await page.goto(`${baseUrl}/subscription`)
    await page.getByRole('button', { name: subscribed.mine.changePlan, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(subscribed.changeDialog.plan).selectOption('standard')
    // 고른 윗등급 플랜의 금액 미리보기 - 지금 결제될 금액과 다음 결제부터의 가격
    await pwExpect(dialog.getByText(subscribed.changeDialog.chargeNow)).toBeVisible()
    await pwExpect(dialog.getByText(subscribed.changeDialog.nextPrice)).toBeVisible()
    await dialog.getByRole('button', { name: subscribed.changeDialog.confirm }).click()
    await pwExpect(dialog).toBeHidden()
    await pwExpect(page.getByText('스탠다드').first()).toBeVisible()

    const mine = await me()
    expect(mine.orders.map((o) => o.kind).sort()).toEqual([
      'SUBSCRIPTION_CHANGE',
      'SUBSCRIPTION_INITIAL',
    ])
    expect(mine.orders.every((o) => o.status === 'PAID')).toBe(true)
    // 결제사에는 카드 교환 한 번 + 승인 둘(첫 결제 · 변경 몫)만 갔다
    const charges = (await toss!.state()).calls.filter(
      (c) => c.method === 'POST' && /^\/v1\/billing\/(?!authorizations)/.test(c.path),
    )
    expect(charges).toHaveLength(2)
    await cancelIfAny(DEMO)
  })
})

/** 구독을 API 로 빠르게 연다(주기가 25초라 화면 걸음이 길면 갱신이 먼저 온다) - 구독 id 를 돌려준다 */
async function startViaApi(planCode: string, account = DEMO) {
  const token = await tokenOf(apiUrl, account)
  const started = await api(
    apiUrl,
    token,
    'POST',
    '/payments/subscriptions',
    { planCode },
    { 'Idempotency-Key': `e2e-${planCode}-${Date.now()}` },
  )
  expect(started.status).toBe(201)
  const id = started.json.value.subscription.id as string
  const authKey = (
    (await (
      await fetch(`${fakeTossUrl}/sdk/authorize-billing`, {
        method: 'POST',
        body: JSON.stringify({ customerKey: started.json.value.billingAuth.customerKey }),
      })
    ).json()) as { authKey: string }
  ).authKey
  const activated = await api(apiUrl, token, 'POST', `/payments/subscriptions/${id}/activate`, {
    providerPayload: { authKey },
  })
  expect(activated.status).toBe(200)
  return id
}

describe('⑥ a longer period right away', () => {
  run(
    'monthly Basic → yearly Basic: the dialog offers it under 「바로」 and the period becomes the long one',
    async () => {
      await untilNoLiveSubscription(DEMO)
      await startViaApi('basic')
      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/subscription`)
      await page.getByRole('button', { name: subscribed.mine.changePlan, exact: true }).click()
      const dialog = page.getByRole('dialog')
      const choice = dialog.getByLabel(subscribed.changeDialog.plan)
      await pwExpect(
        choice.locator(
          `optgroup[label="${subscribed.changeDialog.groups.now}"] option[value="basic-yearly"]`,
        ),
      ).toHaveCount(1)
      // 25초 주기라 갱신이 끼는 순간 미리보기가 409(결제가 오가는 중)일 수 있다 - 읽을 때까지 다른 플랜을 눌렀다 돌아오며 다시 묻는다
      for (let attempt = 0; ; attempt++) {
        await choice.selectOption('basic-yearly')
        try {
          await pwExpect(dialog.getByText(subscribed.changeDialog.chargeNow)).toBeVisible({
            timeout: 8_000,
          })
          break
        } catch (error) {
          if (attempt >= 3) throw error
          await choice.selectOption('standard')
        }
      }
      // 서버가 공제액을 주면 「남은 이용분을 빼고」, 아니면 「전액」 - 어느 쪽이든 새 주기가 오늘부터라는 말이 있다
      await pwExpect(dialog.getByText(/새 (결제 주기|기간)[가이] 시작/)).toBeVisible()
      // 25초 주기라 남은 몫이 줄어 결제할 금액이 오르면 서버가 409 로 새 금액을 보라고 한다 - 창이 새 금액을 다시 읽으면 다시 누른다(사람이 하는 대로)
      for (let attempt = 0; ; attempt++) {
        await dialog.getByRole('button', { name: subscribed.changeDialog.confirm }).click()
        try {
          await pwExpect(dialog).toBeHidden({ timeout: 8_000 })
          break
        } catch (error) {
          if (attempt >= 3) throw error
          await pwExpect(
            dialog.getByText(subscribed.changeDialog.errors.chargeChanged),
          ).toBeVisible()
        }
      }
      const sub = (await me()).subscription as unknown as { planCode: string; period: string }
      expect(sub.planCode).toBe('basic-yearly')
      expect(sub.period).not.toBe('PT25S')
      await cancelIfAny(DEMO)
    },
  )
})

describe('⑦ a downgrade waits for the renewal, and can be withdrawn', () => {
  run(
    'Standard → Basic is scheduled with no charge now; 「예약 거두기」 keeps Standard',
    async () => {
      await untilNoLiveSubscription(DEMO)
      await startViaApi('standard')
      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/subscription`)
      await page.getByRole('button', { name: subscribed.mine.changePlan, exact: true }).click()
      const dialog = page.getByRole('dialog')
      const choice = dialog.getByLabel(subscribed.changeDialog.plan)
      await pwExpect(
        choice.locator(
          `optgroup[label="${subscribed.changeDialog.groups.next}"] option[value="basic"]`,
        ),
      ).toHaveCount(1)
      await choice.selectOption('basic')
      await pwExpect(
        dialog.getByText(subscribed.changeDialog.effectiveOn, { exact: true }),
      ).toBeVisible()
      await pwExpect(dialog.getByText(subscribed.changeDialog.chargeNow)).toHaveCount(0)
      await dialog.getByRole('button', { name: subscribed.changeDialog.confirmScheduled }).click()
      await pwExpect(dialog).toBeHidden()

      // 25초 주기라 이 사이에 갱신이 끼어 예약이 이미 적용됐을 수 있다 - 그러면 플랜은 Basic, 예약은 없다. 어느 갈래든 맞는 것을 단언한다
      type Mine = { planCode: string; scheduledChange: unknown }
      const stateNow = async () => {
        const read = await me()
        return { orders: read.orders, sub: read.subscription as unknown as Mine }
      }
      const appliedEarly = async (why: string) => {
        const { sub } = await stateNow()
        // 갱신이 예약을 적용했다: 새 플랜으로 바뀌었고 예약은 비었다
        expect(sub.planCode).toBe('basic')
        expect(sub.scheduledChange ?? null).toBeNull()
        console.warn(`subscription ⑦ ended early: ${why} (the 25s renewal applied the schedule)`)
        await cancelIfAny(DEMO)
      }
      const after = await stateNow()
      // 예약 때문에 지금 결제가 나간 적은 없다(변경 결제 없음)
      expect(after.orders.map((o) => o.kind)).not.toContain('SUBSCRIPTION_CHANGE')
      if (after.sub.scheduledChange == null)
        return appliedEarly('before the schedule could be checked')
      expect(after.sub.planCode).toBe('standard')
      await pwExpect(page.getByText(subscribed.mine.scheduled)).toBeVisible()

      // 예약 거두기 → 확인 창 → 예약이 사라진다 (그 사이 갱신이 예약을 적용했다면 단추가 이미 없다)
      const withdraw = page.getByRole('button', { name: subscribed.mine.withdrawSchedule })
      if ((await withdraw.count()) === 0)
        return appliedEarly('before 「예약 거두기」 could be pressed')
      await withdraw.click()
      const confirm = page.getByRole('dialog')
      await confirm.getByRole('button', { name: subscribed.cancelScheduleDialog.confirm }).click()
      await pwExpect(confirm).toBeHidden()
      await pwExpect(page.getByText(subscribed.mine.scheduled)).toHaveCount(0)
      const done = (await me()).subscription as unknown as {
        planCode: string
        scheduledChange: unknown
      }
      expect(done.scheduledChange ?? null).toBeNull()
      // 거두는 사이에 갱신이 먼저 예약을 적용했다면 Basic, 아니면 Standard 그대로 - 어느 쪽이든 예약은 없다
      expect(['standard', 'basic']).toContain(done.planCode)
      await cancelIfAny(DEMO)
    },
  )
})

describe('⑤ ending now with a refund', () => {
  run(
    'shows the refund and its calculation, ends at once and the provider is asked to cancel once',
    async () => {
      await untilNoLiveSubscription(DEMO)
      const token = await tokenOf(apiUrl, DEMO)
      const started = await api(
        apiUrl,
        token,
        'POST',
        '/payments/subscriptions',
        { planCode: 'basic' },
        { 'Idempotency-Key': `e2e-now-${Date.now()}` },
      )
      expect(started.status).toBe(201)
      const id = started.json.value.subscription.id as string
      const authKey = (
        (await (
          await fetch(`${fakeTossUrl}/sdk/authorize-billing`, {
            method: 'POST',
            body: JSON.stringify({ customerKey: started.json.value.billingAuth.customerKey }),
          })
        ).json()) as { authKey: string }
      ).authKey
      expect(
        (
          await api(apiUrl, token, 'POST', `/payments/subscriptions/${id}/activate`, {
            providerPayload: { authKey },
          })
        ).status,
      ).toBe(200)

      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/subscription`)
      const now = labels.subscription.cancelNowDialog
      await page.getByRole('button', { name: subscribed.mine.cancelNow, exact: true }).click()
      const dialog = page.getByRole('dialog', { name: now.title })
      // 환불 예정 금액과 계산 내역 - 7일 안이라 낸 3,900원 전액
      await pwExpect(dialog.getByText(now.refund)).toBeVisible()
      await pwExpect(dialog.getByText('3,900원').first()).toBeVisible()
      await pwExpect(dialog.getByText(now.withdrawal)).toBeVisible()
      await dialog.getByRole('button', { name: now.confirm }).click()
      await pwExpect(dialog).toBeHidden()
      await pwExpect(page.getByText(subscribed.status.ENDED).first()).toBeVisible()
      await pwExpect(page.getByText(/3,900원을 돌려드려요/)).toBeVisible()

      const mine = await me()
      expect(mine.subscription?.status).toBe('ENDED')
      expect(mine.subscription?.endReason).toBe('USER_CANCELED_NOW')
      const cancels = (await toss!.state()).calls.filter(
        (c) => c.method === 'POST' && /^\/v1\/payments\/[^/]+\/cancel$/.test(c.path),
      )
      expect(cancels).toHaveLength(1)
      // 두 번 눌러도 환불은 한 번 - 서버가 같은 답을 준다
      const again = await api(apiUrl, token, 'POST', `/payments/subscriptions/${id}/cancel-now`)
      expect(again.status).toBe(200)
      expect(
        (await toss!.state()).calls.filter((c) => /^\/v1\/payments\/[^/]+\/cancel$/.test(c.path)),
      ).toHaveLength(1)
    },
  )
})
