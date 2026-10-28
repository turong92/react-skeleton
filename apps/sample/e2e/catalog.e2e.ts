import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { routeTossSdk, tossControl } from './fakeToss'
import { periodMinutes } from '@skeleton/payment'
import { DEMO, launch } from './helpers'
import {
  ADMIN,
  api,
  ensureSignedIn,
  endLiveSubscription,
  labels,
  mySubscription,
  operatorPage,
  resultTitle,
  tokenOf,
} from './paymentSteps'

/*
 * 상품 · 가격 카탈로그 — 운영자가 행사가를 걸면 가격표와 구독 화면이 그 표를 읽고, 가격을 멈춰도 이미 구독한 사람은 산 가격 그대로다 (진짜 백엔드·브라우저, 결제는 가짜 토스).
 * 이 시험이 백엔드에 기대하는 것(견본 앱 시드 - 백엔드 K3): 상품 `standard`(구독)에 KRW 가격이 **주기 둘**(짧은 것 = 월, 긴 것 = 연 - 로컬 시드는 3분 · 36분, 운영 모양은 P1M · P1Y)로 있고, 운영 카탈로그(`catalog.admin`)가 열려 있고 운영자 `admin@example.com` 이 `catalog.manage` 를 갖는다.
 * 건너뛸 때는 이유를 콘솔에 남긴다. 나라 따라 통화가 갈리는 시나리오는 개발용 나라 스위치(`routing.dev-country-switch`, `X-Dev-Country`)가 켜진 백엔드에서만 돈다. 카탈로그가 없는 백엔드 · 가짜 토스가 없는 실행 · 시드가 다른 백엔드에서는 통째로 건너뛴다.
 *  ① 운영자가 standard 의 KRW 연 행사가(그 연 가격이 정가, 행사가는 그 80%, 끝 = 내일)를 더한다 → 한국 방문자의 랜딩 연 토글에 정가 취소선 + 기간 → 로그인 사용자가 구독 화면에서 연 행사가로 시작
 *     → 운영자가 그 행사 가격을 멈춘다 → 랜딩은 정가(취소선 없음), 내 구독은 행사가 그대로
 *  ② 미국 방문자(`X-Dev-Country: US`)의 랜딩 · 구독 화면은 USD 가격(DB 금액)만 보인다 (Paddle 결제창은 열지 않는다)
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
const text = labels.admin.catalog
const COUNTRY_KEY = 'notes:dev-country'

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

type Price = {
  code: string
  period: string | null
  amount: number
  currency: string
  current: boolean
  compareAtAmount: number | null
  selling: boolean
  stoppedAt: string | null
}
type Product = { code: string; prices: Price[] }

const catalog = async (): Promise<Product[] | null> => {
  const answer = await api(apiUrl, await tokenOf(apiUrl, ADMIN), 'GET', '/admin/catalog/products')
  return answer.status === 200 ? (answer.json.values as Product[]) : null
}

const SKIP = (reason: string) => console.warn(`catalog.e2e skipped: ${reason}`)

/** standard 의 KRW 현재 가격 중 주기가 가장 긴 것(= 연 가격) - 시드가 이 모양이 아니면 `null` */
async function yearlySeed(): Promise<Price | null> {
  const products = await catalog()
  if (!products) return (SKIP('the operator catalog is not on this backend (404)'), null)
  const standard = products.find((product) => product.code === 'standard')
  if (!standard) return (SKIP('no product "standard" in the seed'), null)
  const krw = standard.prices.filter((p) => p.currency === 'KRW' && p.period !== null && p.current)
  const periods = new Set(krw.map((p) => p.period))
  if (periods.size < 2)
    return (SKIP('"standard" needs KRW prices with two different periods'), null)
  return krw.sort((a, b) => periodMinutes(a.period!) - periodMinutes(b.period!)).at(-1)!
}

async function devCountrySwitchOn(): Promise<boolean> {
  const answer = await api(apiUrl, await tokenOf(apiUrl), 'GET', '/payments/config', undefined, {
    'X-Dev-Country': 'US',
  })
  return answer.json?.value?.country === 'US'
}

/** 새 브라우저 컨텍스트 - 로그인과 나라를 이 시나리오가 정한다 */
async function visitor(country: 'KR' | 'US', locale: 'ko-KR' | 'en-US' = 'ko-KR') {
  const fresh = await browser.newContext({
    locale,
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
  })
  fresh.setDefaultTimeout(15_000)
  await fresh.addInitScript(
    ([key, value]) => localStorage.setItem(key!, value!),
    [COUNTRY_KEY, country],
  )
  return { context: fresh, page: await fresh.newPage() }
}

type Ctx = { skip: () => never }
const run = (name: string, fn: (ctx: Ctx) => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!toss) return (SKIP('no fake Toss in this run'), ctx.skip())
      await toss.set({ reset: true })
      await fn(ctx as unknown as Ctx)
    },
    240_000,
  )

/** `datetime-local` 칸에 넣는 「내일 이 시각」 - 브라우저의 시간대(Asia/Seoul) 달력 */
const tomorrow = () =>
  new Date(Date.now() + 24 * 3_600_000)
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .replace(' ', 'T')
    .slice(0, 16)

/** 화면의 원화 표기 - 가격표(`formatPrice`)와 같은 규칙(정수 · 소수 없음) */
const wonText = (amount: number) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(amount)
/** 구독 화면의 금액 표기 - `69,000원` */
const wonSuffix = (amount: number) => `${amount.toLocaleString('en-US')}원`

/** 시험이 남긴 행사 가격(정가가 있는 판매 중 가격)을 멈춘다 - 시나리오가 중간에 실패해도 다음 실행이 오염되지 않게 */
async function stopLeftoverSales() {
  const token = await tokenOf(apiUrl, ADMIN)
  const standard = (await catalog())?.find((product) => product.code === 'standard')
  for (const price of standard?.prices ?? [])
    if (price.compareAtAmount !== null && price.selling && price.stoppedAt === null)
      await api(apiUrl, token, 'POST', `/admin/catalog/prices/${price.code}/stop`)
}

describe('① a sale price: operator adds it, the landing and the subscribe page show it, stopping it leaves the subscriber on it', () => {
  run(
    'KR visitor sees the struck-through regular price; the subscriber keeps the sale price after it is stopped',
    async (ctx) => {
      // 앞 실행이 남긴 행사가가 있으면 연 가격 판정(현재 가격)이 흐려진다 - 먼저 치운다
      await stopLeftoverSales()
      const yearly = await yearlySeed()
      if (!yearly) return ctx.skip()
      const regular = yearly.amount
      const sale = Math.floor((regular * 0.8) / 100) * 100
      await endLiveSubscription(apiUrl, DEMO)
      const operator = await operatorPage(browser, baseUrl)
      try {
        // 운영자: standard → 가격 더하기 → 연 가격과 같은 주기 · 행사가(정가 = 연 가격, 끝 = 내일)
        await operator.page.goto(`${baseUrl}/admin/catalog/standard`)
        await operator.page.getByRole('button', { name: text.prices.add }).click()
        const dialog = operator.page.getByRole('dialog', { name: text.addPrice.title })
        if (yearly.period === 'P1M' || yearly.period === 'P1Y')
          await dialog.getByLabel(text.addPrice.period).selectOption(yearly.period)
        else {
          await dialog.getByLabel(text.addPrice.period).selectOption('custom')
          await dialog.getByLabel(text.addPrice.periodCustomLabel).fill(yearly.period!)
        }
        await dialog
          .getByRole('textbox', { name: new RegExp(`^${text.addPrice.amount}`) })
          .fill(String(sale))
        await dialog.getByRole('checkbox', { name: new RegExp(text.addPrice.sale) }).check()
        await dialog
          .getByRole('textbox', { name: new RegExp(`^${text.addPrice.regularAmount}`) })
          .fill(String(regular))
        await dialog.getByLabel(text.addPrice.saleEnds).fill(tomorrow())
        await dialog.getByRole('button', { name: text.addPrice.submit }).click()
        await pwExpect(dialog).toBeHidden()
        const saleRow = operator.page
          .getByRole('row')
          .filter({ hasText: text.prices.regular(wonSuffix(regular)) })
        await pwExpect(saleRow.getByText(text.prices.states.current)).toBeVisible()

        // 한국 방문자: 랜딩 연 토글에 정가 취소선(한 달 몫) + 연 총액 + 기간
        const kr = await visitor('KR')
        await kr.page.goto(baseUrl)
        await kr.page.getByRole('button', { name: /연간/ }).click()
        await pwExpect(kr.page.locator('del', { hasText: wonText(regular / 12) })).toBeVisible()
        await pwExpect(kr.page.getByText(`연 ${wonText(sale)} 결제`)).toBeVisible()
        await kr.context.close()

        // 로그인 사용자: 구독 화면에서 긴 주기(행사가)로 시작 (토스 테스트 - 기존 구독 e2e 단계)
        await ensureSignedIn(page, baseUrl)
        await page.goto(`${baseUrl}/subscribe`)
        const card = page
          .getByRole('listitem')
          .filter({ has: page.getByRole('group') })
          .filter({ hasText: /스탠다드|Standard/ })
        await card.getByRole('group').getByRole('button').last().click()
        await pwExpect(card.locator('del', { hasText: wonSuffix(regular) })).toBeVisible()
        await card.getByRole('button', { name: /구독하기/ }).click()
        await page.waitForURL(/\/subscriptions\/return\?/)
        await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
        expect((await mySubscription(apiUrl, DEMO)).subscription?.status).toBe('ACTIVE')
        const before = await subscriptionAmount()
        expect(before).toEqual({ amount: sale, period: yearly.period })

        // 운영자: 행사 가격을 멈춘다
        await operator.page.reload()
        await saleRow.getByRole('button', { name: new RegExp(`^${text.prices.stop}`) }).click()
        await operator.page
          .getByRole('dialog', { name: text.stopDialog.title })
          .getByRole('button', { name: text.stopDialog.confirm })
          .click()
        await pwExpect(saleRow.getByText(text.prices.states.stopped)).toBeVisible()

        // 랜딩은 정가(취소선 없음), 내 구독은 행사가 그대로
        const after = await visitor('KR')
        await after.page.goto(baseUrl)
        await after.page.getByRole('button', { name: /연간/ }).click()
        await pwExpect(after.page.getByText(wonText(regular / 12)).first()).toBeVisible()
        await expect(after.page.locator('del').count()).resolves.toBe(0)
        await after.context.close()
        expect(await subscriptionAmount()).toEqual(before)
        await page.goto(`${baseUrl}/subscription`)
        await pwExpect(page.getByText(wonSuffix(sale)).first()).toBeVisible()
      } finally {
        await stopLeftoverSales()
        await operator.close()
        await endLiveSubscription(apiUrl, DEMO)
      }
    },
  )
})

describe('② a US visitor sees only dollar prices from the table', () => {
  run(
    'the landing and the subscribe page show USD (DB amounts), no won, and never open the Paddle window',
    async (ctx) => {
      if (!(await yearlySeed())) return ctx.skip()
      if (!(await devCountrySwitchOn()))
        return (SKIP('the backend has no dev country switch (X-Dev-Country)'), ctx.skip())
      // 화면 말은 한국어 그대로(로그인 단계가 한국어 문구를 쓴다), 나라만 미국
      const us = await visitor('US')
      try {
        // 로그인하지 않은 미국 방문자의 랜딩
        await us.page.goto(baseUrl)
        await pwExpect(us.page.getByText(/\$\d/).first()).toBeVisible()
        await expect(us.page.getByText('₩').count()).resolves.toBe(0)
      } finally {
        await us.context.close()
      }
      // 로그인한 사용자의 구독 화면 - 같은 브라우저에서 나라만 미국으로(개발용 나라 스위치)
      await ensureSignedIn(page, baseUrl)
      await page.evaluate(([key]) => localStorage.setItem(key!, 'US'), [COUNTRY_KEY])
      try {
        await page.goto(`${baseUrl}/subscribe`)
        await pwExpect(page.getByText(/\$\d/).first()).toBeVisible()
        await expect(page.getByText(/[\d,]+원/).count()).resolves.toBe(0)
      } finally {
        await page.evaluate(([key]) => localStorage.removeItem(key!), [COUNTRY_KEY])
      }
    },
  )
})

/** 지금 구독의 금액과 주기 - 서버가 박아 둔 값 */
async function subscriptionAmount() {
  const answer = await api(apiUrl, await tokenOf(apiUrl, DEMO), 'GET', '/payments/subscriptions/me')
  const sub = answer.json?.value?.subscription
  return { amount: sub?.amount?.amount as number, period: sub?.period as string }
}
