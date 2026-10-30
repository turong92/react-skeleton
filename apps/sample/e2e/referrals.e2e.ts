import { koRewardsLabels } from '@skeleton/rewards'
import { koRewardsAdminLabels } from '@skeleton/rewards/admin'
import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { routeTossSdk, tossControl } from './fakeToss'
import {
  agreeToLegal,
  auth,
  dismissConsent,
  fillLoginId,
  ko,
  launch,
  uniqueLoginId,
} from './helpers'
import { waitForCode } from './mail'
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
 * 친구 초대 · 추천 보상 (스펙 §7) — 진짜 백엔드(`campaign` 모듈 + 견본 씨앗의 「친구 초대」: 첫 결제 뒤 지급 · 보류 7일 · 같은 네트워크 확인) · 브라우저 · 메일(mailpit) · 가짜 토스. 한 여정:
 *  ① A(`user@example.com`)가 보상 화면에서 초대 링크를 복사한다(클립보드에서 읽는다)
 *  ② 새 브라우저 문맥이 그 링크로 들어와 B 로 가입한다(메일의 6자리) → B 의 쿠폰함에 「응원 30%」, A 의 초대 현황에 「가입함」(WAITING)
 *  ③ B 가 첫 응원을 결제한다(가짜 토스) - 같은 기계라 서버가 「같은 네트워크」로 보고 → A 의 현황은 「확인 중」(PENDING)
 *  ④ 운영자가 초대 내역에서 「같은 네트워크」 표시를 보고 승인한다 → A 에게 500포인트, 현황은 「보상 지급」(REWARDED)
 * 보류 기한 해제 · 환불 취소 · 상한은 kotlin 통합 시험(시계를 옮긴다)이 맡는다. 씨앗은 새 DB 에서만 만들어진다(이미 있는 로컬 DB 는 `docker compose down -v`).
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
const L = koRewardsLabels
const A = koRewardsAdminLabels
const LATE = 180_000
const REWARD_POINTS = 500
const password = 'Correct-horse-9battery'

let browser: Browser
let context: BrowserContext
let page: Page
beforeAll(async () => {
  ;({ browser, context, page } = await launch())
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseUrl })
  if (fakeTossUrl) await routeTossSdk(context, fakeTossUrl)
})
afterAll(async () => {
  await browser?.close()
})

describe('referrals: copy the link, a friend signs up with it, the first cheer waits for review, the operator approves', () => {
  it(
    'an invited friend gets the 응원 30% coupon, the inviter sees 가입함, then 확인 중 after the friend pays, then 보상 지급 and 500 points once the operator approves',
    async (ctx) => {
      if (!toss || !(await paymentOn(apiUrl))) return ctx.skip()
      const adminToken = await tokenOf(apiUrl, ADMIN)
      const hasReferral = await api(apiUrl, adminToken, 'GET', '/admin/referrals')
      if (hasReferral.status === 404) return ctx.skip()
      await toss.set({ reset: true })
      const userToken = await tokenOf(apiUrl)
      const pointsBefore = (await api(apiUrl, userToken, 'GET', '/points')).json.value
        .balance as number

      // ① A 가 보상 화면에서 초대 링크를 복사한다
      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/rewards`)
      const copy = page.getByRole('button', { name: L.invite.copy, exact: true })
      await pwExpect(copy).toBeVisible()
      await copy.click()
      await pwExpect(page.getByRole('button', { name: L.invite.copied })).toBeVisible()
      const link = await page.evaluate(() => navigator.clipboard.readText())
      baseExpect(link).toMatch(/\/\?ref=[^&\s]+$/)

      // ② 새 브라우저 문맥(다른 사람)이 링크로 들어와 가입한다
      const friend = await browser.newContext({
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        viewport: { width: 1280, height: 800 },
      })
      friend.setDefaultTimeout(15_000)
      await routeTossSdk(friend, fakeTossUrl)
      try {
        const fp = await friend.newPage()
        const email = `e2e-friend-${Date.now().toString(36)}@example.com`
        await fp.goto(link)
        await dismissConsent(fp)
        await fp.goto(`${baseUrl}/sign-up`)
        await fp.getByLabel(auth.email).fill(email)
        await fp.getByLabel(auth.displayName).fill('초대받은 친구')
        await fillLoginId(fp, uniqueLoginId('frd'))
        await fp.getByLabel(auth.password).first().fill(password)
        await fp.getByLabel(auth.passwordConfirm).fill(password)
        await agreeToLegal(fp, apiUrl)
        await fp.getByRole('button', { name: auth.signUpSubmit }).click()
        const code = await waitForCode(mailUrl, email, 'verify')
        await fp.getByLabel(auth.codeDigit(1, 6)).click()
        await fp.keyboard.type(code.code)
        await pwExpect(fp.getByRole('heading', { level: 1 }).first()).toBeVisible()

        // B 의 쿠폰함에 「응원 30%」
        await fp.goto(`${baseUrl}/rewards/coupons`)
        await pwExpect(fp.getByRole('article').filter({ hasText: /응원 30%/ })).toBeVisible()

        // A 의 초대 현황: 가입함
        await page.goto(`${baseUrl}/rewards`)
        await pwExpect(page.getByText(L.invite.list.status.WAITING, { exact: true })).toBeVisible()

        // ③ B 가 첫 응원을 결제한다 → 같은 기계라 확인 중
        await cheerFor(fp, baseUrl, 3000)
        await returnedOrderId(fp)
        await pwExpect(resultTitle(fp, paymentLabels.result.paid.title)).toBeVisible()
        await page.goto(`${baseUrl}/rewards`)
        await pwExpect(page.getByText(L.invite.list.status.PENDING, { exact: true })).toBeVisible()
        baseExpect((await api(apiUrl, userToken, 'GET', '/points')).json.value.balance).toBe(
          pointsBefore,
        ) // 승인 전에는 포인트가 없다

        // ④ 운영자가 초대 내역에서 표시를 보고 승인한다
        const operator = await operatorPage(browser, baseUrl)
        try {
          const op = operator.page
          await op.getByRole('button', { name: ko('nav.admin') }).click()
          await op.getByRole('link', { name: ko('nav.adminReferrals'), exact: true }).click()
          await pwExpect(
            op.getByRole('heading', { level: 1, name: A.referrals.title }),
          ).toBeVisible()
          const row = op.getByRole('row').filter({ hasText: '초대받은 친구' })
          await pwExpect(row.getByText(A.referrals.sameNetwork)).toBeVisible()
          await pwExpect(row.getByText(A.referrals.status.REVIEW)).toBeVisible()
          await row.getByRole('button', { name: A.referrals.rowMenu('초대받은 친구') }).click()
          await op.getByRole('menuitem', { name: A.referrals.approve, exact: true }).click()
          await pwExpect(row.getByText(A.referrals.status.QUALIFIED)).toBeVisible()
        } finally {
          await operator.close()
        }

        // A: 500포인트와 알림, 현황은 보상 지급
        await pwExpect
          .poll(async () => (await api(apiUrl, userToken, 'GET', '/points')).json.value.balance, {
            timeout: 60_000,
          })
          .toBe(pointsBefore + REWARD_POINTS)
        await page.goto(`${baseUrl}/rewards`)
        await pwExpect(page.getByText(L.invite.list.status.REWARDED, { exact: true })).toBeVisible()
        await page.getByRole('button', { name: /^알림/ }).click()
        await pwExpect(
          page.getByRole('dialog', { name: ko('header.notificationsTitle') }),
        ).toContainText('500')
      } finally {
        await friend.close()
      }
    },
    LATE * 2,
  )
})
