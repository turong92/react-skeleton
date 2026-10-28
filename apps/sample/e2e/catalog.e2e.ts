import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { routeTossSdk, tossControl } from './fakeToss'
import { DEMO, launch, signIn } from './helpers'
import {
  ADMIN,
  api,
  endLiveSubscription,
  labels,
  mySubscription,
  operatorPage,
  resultTitle,
  tokenOf,
} from './paymentSteps'

/*
 * 상품 · 가격 카탈로그 — 운영자가 행사가를 걸면 가격표와 구독 화면이 그 표를 읽고, 가격을 멈춰도 이미 구독한 사람은 산 가격 그대로다 (진짜 백엔드·브라우저, 결제는 가짜 토스).
 * 이 시험이 백엔드에 기대하는 것(견본 앱 시드 - 백엔드 K3): 상품 `standard`(구독)에 KRW 월 가격과 **연 가격 69,000원** 이 있고, 운영 카탈로그(`catalog.admin`)가 열려 있고 운영자 `admin@example.com` 이 `catalog.manage` 를 갖는다.
 * 나라 따라 통화가 갈리는 시나리오는 개발용 나라 스위치(`routing.dev-country-switch`, `X-Dev-Country`)가 켜진 백엔드에서만 돈다. 카탈로그가 없는 백엔드 · 가짜 토스가 없는 실행 · 시드가 다른 백엔드에서는 통째로 건너뛴다.
 *  ① 운영자가 standard 의 KRW 연 행사가(정가 69,000 → 59,000, 끝 = 내일)를 더한다 → 한국 방문자의 랜딩 연 토글에 정가 취소선 + 기간 → 로그인 사용자가 구독 화면에서 연 행사가로 시작
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
}
type Product = { code: string; prices: Price[] }

const catalog = async (): Promise<Product[] | null> => {
  const answer = await api(apiUrl, await tokenOf(apiUrl, ADMIN), 'GET', '/admin/catalog/products')
  return answer.status === 200 ? (answer.json.values as Product[]) : null
}

/** 이 백엔드가 위 시드를 갖고 있는가 - 아니면 건너뛴다 */
async function seeded(): Promise<boolean> {
  const standard = (await catalog())?.find((product) => product.code === 'standard')
  return (
    standard?.prices.some(
      (p) => p.period === 'P1Y' && p.currency === 'KRW' && p.amount === 69000 && p.current,
    ) ?? false
  )
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

const run = (name: string, fn: () => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!toss || !(await seeded())) return ctx.skip()
      await toss.set({ reset: true })
      await fn()
    },
    240_000,
  )

/** `datetime-local` 칸에 넣는 「내일 이 시각」 - 브라우저의 시간대(Asia/Seoul) 달력 */
const tomorrow = () =>
  new Date(Date.now() + 24 * 3_600_000)
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .replace(' ', 'T')
    .slice(0, 16)

describe('① a sale price: operator adds it, the landing and the subscribe page show it, stopping it leaves the subscriber on it', () => {
  run(
    'KR visitor sees the struck-through regular price; the subscriber keeps the sale price after it is stopped',
    async () => {
      await endLiveSubscription(apiUrl, DEMO)
      const operator = await operatorPage(browser, baseUrl)
      try {
        // 운영자: standard → 가격 더하기 → 연간 · 59,000 · 행사가(정가 69,000, 끝 = 내일)
        await operator.page.goto(`${baseUrl}/admin/catalog/standard`)
        await operator.page.getByRole('button', { name: text.prices.add }).click()
        const dialog = operator.page.getByRole('dialog', { name: text.addPrice.title })
        await dialog.getByLabel(text.addPrice.period).selectOption('P1Y')
        await dialog
          .getByRole('textbox', { name: new RegExp(`^${text.addPrice.amount}`) })
          .fill('59000')
        await dialog.getByRole('checkbox', { name: new RegExp(text.addPrice.sale) }).check()
        await dialog
          .getByRole('textbox', { name: new RegExp(`^${text.addPrice.regularAmount}`) })
          .fill('69000')
        await dialog.getByLabel(text.addPrice.saleEnds).fill(tomorrow())
        await dialog.getByRole('button', { name: text.addPrice.submit }).click()
        await pwExpect(dialog).toBeHidden()
        await pwExpect(
          operator.page.getByText(text.prices.regular('69,000원')).first(),
        ).toBeVisible()

        // 한국 방문자: 랜딩 연 토글에 정가 취소선(한 달 몫 5,750원) + 연 총액 + 기간
        const kr = await visitor('KR')
        await kr.page.goto(baseUrl)
        await kr.page.getByRole('button', { name: /연간/ }).click()
        await pwExpect(kr.page.locator('del', { hasText: '₩5,750' })).toBeVisible()
        await pwExpect(kr.page.getByText(/연 ₩59,000 결제/)).toBeVisible()
        await kr.context.close()

        // 로그인 사용자: 구독 화면에서 연 행사가로 시작 (토스 테스트 - 기존 구독 e2e 단계)
        await signIn(page, baseUrl)
        await page.goto(`${baseUrl}/subscribe`)
        const card = page
          .getByRole('listitem')
          .filter({ has: page.getByRole('button', { name: /구독하기/ }) })
          .filter({ hasText: /스탠다드|Standard/ })
        await card.getByRole('button', { name: /연간/ }).click()
        await pwExpect(card.locator('del', { hasText: '69,000원' })).toBeVisible()
        await card
          .getByRole('button', { name: /구독하기/ })
          .last()
          .click()
        await page.waitForURL(/\/subscriptions\/return\?/)
        await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
        const started = (await mySubscription(apiUrl, DEMO)).subscription
        expect(started?.status).toBe('ACTIVE')
        const before = await subscriptionAmount()
        expect(before).toEqual({ amount: 59000, period: 'P1Y' })

        // 운영자: 행사 가격(정가 69,000 줄)을 멈춘다
        await operator.page.reload()
        const saleRow = operator.page
          .getByRole('row')
          .filter({ hasText: text.prices.regular('69,000원') })
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
        await pwExpect(after.page.getByText('₩5,750').first()).toBeVisible()
        await expect(after.page.locator('del').count()).resolves.toBe(0)
        await after.context.close()
        expect(await subscriptionAmount()).toEqual(before)
        await page.goto(`${baseUrl}/subscription`)
        await pwExpect(page.getByText(/59,000원/).first()).toBeVisible()
      } finally {
        await operator.close()
        await endLiveSubscription(apiUrl, DEMO)
      }
    },
  )
})

describe('② a US visitor sees only dollar prices from the table', () => {
  run(
    'the landing and the subscribe page show USD (DB amounts), no won, and never open the Paddle window',
    async () => {
      if (!(await devCountrySwitchOn())) return
      const us = await visitor('US', 'en-US')
      try {
        await us.page.goto(baseUrl)
        await pwExpect(us.page.getByText(/\$\d/).first()).toBeVisible()
        await expect(us.page.getByText('₩').count()).resolves.toBe(0)
        await signIn(us.page, baseUrl)
        await us.page.goto(`${baseUrl}/subscribe`)
        await pwExpect(us.page.getByText(/\$\d/).first()).toBeVisible()
        await expect(us.page.getByText(/원/).count()).resolves.toBe(0)
      } finally {
        await us.context.close()
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
