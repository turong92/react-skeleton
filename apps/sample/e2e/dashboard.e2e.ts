import { koDashboardLabels } from '@skeleton/dashboard'
import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { FAKE_CLOUDFLARE } from './fakeCloudflare'
import { FAKE_GA } from './fakeGa'
import { routeTossSdk, tossControl } from './fakeToss'
import { launch, ko } from './helpers'
import {
  ADMIN,
  api,
  cheerFor,
  ensureSignedIn,
  labels as paymentLabels,
  operatorPage,
  paymentOn,
  resultTitle,
  returnedOrderId,
  tokenOf,
} from './paymentSteps'

/*
 * 관리자 대시보드(`/admin/dashboard`) — 한 여정, 진짜 백엔드 + 가짜 Cloudflare · GA(+ 가짜 토스)로:
 *  운영자 로그인 → 메뉴 첫 항목 「대시보드」 → 신규 가입 타일 ≥ 1(시드 계정) → 「오늘」에서 Cloudflare 방문 타일 = 가짜 값, 유입 카드 Cloudflare 탭에 가짜 유입처
 *  → 「7일」에서 GA 탭에 가짜 채널 → 헤더 「지금 7명」 → 순매출 타일을 누르면 그래프 제목이 순매출
 *  → 사용자가 응원 결제 한 건 → 다시 불러오면 결제 건수 +1(서버 캐시 30초 안에서 다시 읽는다).
 * 가짜 Cloudflare · GA 는 `globalSetup.ts` 가 켠다(`E2E_FAKE_ANALYTICS=0` 이면 끄고 그 걸음은 건너뛴다). 대시보드 경로가 없는 백엔드(404)면 통째로 건너뛴다.
 * 문구는 패키지의 한국어 문구(`koDashboardLabels`)에서 읽는다. 가짜 서버의 모양은 계획 계약 C4(추측)이고, 값은 `fakeCloudflare.ts` · `fakeGa.ts` 의 상수다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeCloudflareUrl = inject('fakeCloudflareUrl')
const fakeGaUrl = inject('fakeGaUrl')
const fakeTossUrl = inject('fakeTossUrl')
const L = koDashboardLabels

let browser: Browser
let context: BrowserContext
let userPage: Page
beforeAll(async () => {
  ;({ browser, context, page: userPage } = await launch())
  if (fakeTossUrl) await routeTossSdk(context, fakeTossUrl)
})
afterAll(async () => {
  await browser?.close()
})

/** 타일의 큰 숫자 - 타일 글자의 둘째 줄(이름 다음) */
async function tileNumber(page: Page, name: string): Promise<number> {
  const text = await page.getByRole('button', { name: new RegExp(`^${name}`) }).innerText()
  return Number((text.split('\n')[1] ?? '').replace(/[^\d]/g, ''))
}
const tile = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}`) })

describe('the admin dashboard', () => {
  it('shows the numbers the backend and the fake analytics sources gave, and moves with a payment', async (ctx) => {
    const adminToken = await tokenOf(apiUrl, ADMIN)
    if ((await api(apiUrl, adminToken, 'GET', '/admin/dashboard')).status === 404) return ctx.skip()
    const operator = await operatorPage(browser, baseUrl)
    const page = operator.page
    try {
      // 운영 메뉴(「운영」 단추)의 첫 항목 「대시보드」
      await page.getByRole('button', { name: ko('nav.admin') }).click()
      const firstLink = page.getByRole('link', { name: ko('nav.adminDashboard'), exact: true })
      await pwExpect(firstLink).toBeVisible()
      await firstLink.click()
      await pwExpect(page.getByRole('heading', { level: 1, name: L.title })).toBeVisible()

      // 신규 가입 — 시드 계정이 있다
      await pwExpect
        .poll(() => tileNumber(page, L.metrics['account.signed-up']))
        .toBeGreaterThanOrEqual(1)

      if (fakeCloudflareUrl) {
        // 「오늘」은 Cloudflare 를 바로 묻는다(어제까지는 새벽 적재분) — 가짜가 준 값이 그대로 나온다(표본 간격을 다시 곱하지 않는다)
        await page.getByRole('button', { name: L.periods.today, exact: true }).click()
        await pwExpect
          .poll(() => tileNumber(page, L.metrics['cloudflare.visits']))
          .toBe(FAKE_CLOUDFLARE.visitsShown)
        const traffic = page.getByRole('article', { name: L.groups.traffic })
        await pwExpect(traffic.getByText(FAKE_CLOUDFLARE.referers[0].host)).toBeVisible()
        await pwExpect(traffic.getByText(FAKE_CLOUDFLARE.internalReferer.host)).toHaveCount(0) // 자기 사이트 안의 이동(방문 0)은 유입이 아니다
      }

      if (fakeGaUrl) {
        // GA 는 오늘 분을 당기지 못한다(몇 시간 뒤 집계) — 7일에서 어제까지의 적재분
        await page.getByRole('button', { name: L.periods['7d'], exact: true }).click()
        const traffic = page.getByRole('article', { name: L.groups.traffic })
        await traffic.getByRole('tab', { name: L.rankings['ga.channels'] }).click()
        await pwExpect(traffic.getByText(FAKE_GA.channels[0].name)).toBeVisible()
        // 헤더 「지금 7명」
        await pwExpect(
          page.getByRole('button', { name: L.realtime.badge(String(FAKE_GA.realtimeUsers)) }),
        ).toBeVisible()
      }

      // 타일을 누르면 그래프 제목이 그 지표로
      await tile(page, L.metrics['payment.net-revenue']).click()
      await pwExpect(
        page.getByRole('heading', { name: L.trendTitle(L.metrics['payment.net-revenue']) }),
      ).toBeVisible()

      // 사용자가 응원 결제 한 건 → 다시 불러오면 결제 건수 +1
      const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
      if (toss && (await paymentOn(apiUrl))) {
        const before = await tileNumber(page, L.metrics['payment.paid-count'])
        await toss.set({ reset: true })
        await ensureSignedIn(userPage, baseUrl)
        await cheerFor(userPage, baseUrl, 1000)
        await returnedOrderId(userPage)
        await pwExpect(resultTitle(userPage, paymentLabels.result.paid.title)).toBeVisible()
        // 서버의 DB 숫자 캐시는 e2e 백엔드에서 5초(`globalSetup.ts` 의 `dashboard.cache.db`) - 그 뒤 다시 불러오면 새 값이 나온다
        await pwExpect
          .poll(
            async () => {
              await page.reload()
              await pwExpect(page.getByRole('heading', { level: 1, name: L.title })).toBeVisible()
              return tileNumber(page, L.metrics['payment.paid-count'])
            },
            { timeout: 60_000, intervals: [5_000] },
          )
          .toBe(before + 1)
      }
    } finally {
      await operator.close()
    }
  }, 240_000)
})
