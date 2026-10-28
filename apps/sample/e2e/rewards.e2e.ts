import { koRewardsLabels } from '@skeleton/rewards'
import { koRewardsAdminLabels } from '@skeleton/rewards/admin'
import { koAdminRolesLabels } from '@skeleton/auth/admin'
import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { routeTossSdk, tossControl } from './fakeToss'
import { auth, ko, launch } from './helpers'
import {
  ADMIN,
  api,
  ensureSignedIn,
  labels as paymentLabels,
  operatorPage,
  paymentOn,
  resultTitle,
  returnedOrderId,
  tokenOf,
  won,
} from './paymentSteps'

/*
 * 이벤트 · 보상 (스펙 §10 의 1 · 2 · 3 · 6) — 진짜 백엔드(`campaign` · `coupon` · `point` · `reward` 모듈, 각 `skeleton.<module>.admin.enabled=true`) · 브라우저 · 가짜 토스.
 *  ① 출석 → 「오늘 출석함」, 알림 하나와 잔액 +10 이 일꾼을 거쳐 도착한다
 *  ② 운영자가 30% 쿠폰을 주면 → 응원하기에서 그 쿠폰을 고르고 미리보기 금액 → 가짜 토스 결제 → 결과의 원가 · 할인 · 최종가, 쿠폰함에서 「사용함」
 *  ③ 「무료 이용권」 → 결제창 없이 바로 끝난다(가짜 토스 호출 없음, 「무료(쿠폰)」)
 *  ④ 운영자가 출석 이벤트를 끄면 사용자 화면에서 출석 카드가 사라진다(다시 켠다)
 *  ⑤ `payment.exempt` 역할을 사용자에게 주면 응원이 결제창 없이 「결제 면제」로 끝나고 운영 목록에 같은 알약, 회수하면 다음 응원은 결제창
 * 한 시나리오의 전제가 이 백엔드에 없으면(해당 경로 404) 그 시나리오만 건너뛴다. 시드: 출석 이벤트 하나(매일 10 포인트), 로컬 프로필의 사용자 `user@example.com`.
 * 아직 실행하지 않았다 — kotlin 의 K2~K9 를 합친 백엔드(`scripts/sample-e2e-backend.sh`)가 있어야 돈다. 지휘가 합친 뒤 `pnpm e2e:sample e2e/rewards.e2e.ts`.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
const L = koRewardsLabels
const A = koRewardsAdminLabels
const LATE = 120_000
const USER_EMAIL = 'user@example.com'

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

/** 이 경로가 이 백엔드에 있는가 - 404 만 「없다」, 나머지 실패는 던진다 */
async function exists(token: string, path: string): Promise<boolean> {
  const answer = await api(apiUrl, token, 'GET', path)
  if (answer.status === 404) return false
  if (answer.status >= 400) throw new Error(`GET ${path} → ${answer.status}`)
  return true
}

type CampaignRow = { id: string; kind: string; name: string }

async function accountIdOf(token: string): Promise<string> {
  const me = await api(apiUrl, token, 'GET', '/account/me')
  if (me.status !== 200) throw new Error(`GET /account/me → ${me.status}`)
  return me.json.value.id as string
}

async function balanceOf(token: string): Promise<number> {
  return (await api(apiUrl, token, 'GET', '/points')).json.value.balance as number
}

/** 운영자 API 로 쿠폰 정의를 만들고 사용자에게 한 장 준다 - 화면 흐름의 전제만 API 로 깐다 */
async function giveCoupon(
  adminToken: string,
  accountId: string,
  name: string,
  stages: unknown[],
): Promise<void> {
  const created = await api(apiUrl, adminToken, 'POST', '/admin/coupon-definitions', {
    name,
    stages,
    currency: null,
    minAmount: null,
    scope: { purposes: [], itemTypes: [], planCodes: [] },
    firstPurchaseOnly: false,
    validDays: 1,
    validUntil: null,
    issueLimit: null,
    perAccountLimit: 1,
  })
  if (created.status !== 201 && created.status !== 200)
    throw new Error(`create coupon definition → ${created.status}`)
  const id = created.json.value.id as string
  const issued = await api(apiUrl, adminToken, 'POST', `/admin/coupon-definitions/${id}/issue`, {
    accountIds: [accountId],
  })
  if (issued.status >= 300) throw new Error(`issue coupon → ${issued.status}`)
}

/** 응원하기 화면에서 금액과 쿠폰을 고르고 「응원하기」를 누른다 */
async function cheerWithCoupon(p: Page, amount: number, couponName: string) {
  await p.goto(`${baseUrl}/cheer`)
  await pwExpect(p.getByRole('heading', { level: 1, name: ko('cheer.title') })).toBeVisible()
  await p.getByRole('radio', { name: won(amount) }).click()
  await p.getByRole('radio', { name: new RegExp(couponName) }).click()
}
const submitCheer = (p: Page) =>
  p.getByRole('button', { name: ko('cheer.submit'), exact: true }).click()

describe('rewards: attendance, coupons on a cheer, a free voucher, switching an event off, a waived payment', () => {
  it(
    'checking in turns the button into 오늘 출석함 and, through the worker, brings a notification and +10 points',
    async (ctx) => {
      const token = await tokenOf(apiUrl)
      if (!(await exists(token, '/campaigns'))) return ctx.skip()
      const before = await balanceOf(token)
      const unread = async () =>
        (await api(apiUrl, token, 'GET', '/notifications?unreadOnly=true&size=1')).json.pagination
          .totalElements as number
      const unreadBefore = await unread()
      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/rewards`)
      const done = page.getByRole('button', { name: L.attendance.checkedToday })
      const checkIn = page.getByRole('button', { name: L.attendance.checkIn, exact: true })
      await pwExpect(done.or(checkIn)).toBeVisible()
      if ((await checkIn.count()) === 0) return ctx.skip() // 오늘 이미 출석했다 - 다음 실행(새 데이터)에서 본다
      await checkIn.click()
      await pwExpect(done).toBeDisabled()
      await pwExpect
        .poll(() => balanceOf(token), { timeout: 60_000 })
        .toBeGreaterThanOrEqual(before + 10)
      await pwExpect.poll(unread, { timeout: 60_000 }).toBeGreaterThan(unreadBefore)
    },
    LATE,
  )

  it(
    'a 30% coupon is picked on the cheer screen, previewed, paid at the fake Toss, shown as original / discount / final, and used in the wallet',
    async (ctx) => {
      if (!toss || !(await paymentOn(apiUrl))) return ctx.skip()
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/coupon-definitions'))) return ctx.skip()
      const userToken = await tokenOf(apiUrl)
      await toss.set({ reset: true })
      const name = `e2e 30% ${Date.now()}`
      await giveCoupon(adminToken, await accountIdOf(userToken), name, [
        { type: 'PERCENT', value: 30, maxDiscount: null, periods: 1 },
      ])
      await ensureSignedIn(page, baseUrl)
      await cheerWithCoupon(page, 3000, name)
      // 미리보기: 3,000원 → 2,100원
      await pwExpect(page.getByText(won(2100))).toBeVisible()
      await submitCheer(page)
      await returnedOrderId(page)
      await pwExpect(resultTitle(page, paymentLabels.result.paid.title)).toBeVisible()
      await pwExpect(page.getByText(paymentLabels.discount.original)).toBeVisible()
      await pwExpect(page.getByText(`-${won(900)}`)).toBeVisible()
      await pwExpect(page.getByText(paymentLabels.discount.final)).toBeVisible()
      await pwExpect(page.getByText(won(2100)).first()).toBeVisible()
      // 쿠폰함: 지난 쿠폰 탭에서 「사용함」
      await page.goto(`${baseUrl}/rewards/coupons`)
      await page.getByRole('tab', { name: L.coupon.past }).click()
      const card = page.getByRole('article').filter({ hasText: name })
      await pwExpect(card).toContainText(L.coupon.status.USED)
    },
    LATE,
  )

  it(
    'a free voucher finishes the cheer without a payment window: no call reaches the fake Toss, the order says 무료(쿠폰)',
    async (ctx) => {
      if (!toss || !(await paymentOn(apiUrl))) return ctx.skip()
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/coupon-definitions'))) return ctx.skip()
      const userToken = await tokenOf(apiUrl)
      await toss.set({ reset: true })
      const name = `e2e free ${Date.now()}`
      await giveCoupon(adminToken, await accountIdOf(userToken), name, [
        { type: 'FREE', value: 0, maxDiscount: null, periods: 1 },
      ])
      await ensureSignedIn(page, baseUrl)
      await cheerWithCoupon(page, 3000, name)
      await submitCheer(page)
      await page.waitForURL(/\/payments\/(?!return)[^/?]+$/)
      await pwExpect(page.getByText(paymentLabels.discount.settlement.FREE).first()).toBeVisible()
      const state = await toss.state()
      baseExpect(state.calls).toHaveLength(0)
    },
    LATE,
  )

  it(
    'the operator switches the attendance event off and its card disappears for the user; switching it on brings it back',
    async (ctx) => {
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/campaigns'))) return ctx.skip()
      const campaigns = (await api(apiUrl, adminToken, 'GET', '/admin/campaigns')).json
        .values as CampaignRow[]
      const attendance = campaigns.find((c) => c.kind === 'attendance')
      if (!attendance) return ctx.skip()
      const operator = await operatorPage(browser, baseUrl)
      try {
        const op = operator.page
        await op.goto(`${baseUrl}/admin/campaigns`)
        const sw = op.getByRole('switch', { name: A.campaigns.enabledSwitch(attendance.name) })
        await pwExpect(sw).toBeChecked()
        await sw.click()
        await pwExpect(sw).not.toBeChecked()
        await ensureSignedIn(page, baseUrl)
        await page.goto(`${baseUrl}/rewards`)
        await pwExpect(page.getByRole('heading', { name: attendance.name })).toHaveCount(0)
        await sw.click()
        await pwExpect(sw).toBeChecked()
        await page.goto(`${baseUrl}/rewards`)
        await pwExpect(page.getByRole('heading', { name: attendance.name })).toBeVisible()
      } finally {
        await operator.close()
      }
    },
    LATE,
  )

  it(
    'a role holding payment.exempt makes the cheer finish without a window (결제 면제, also in the operator list); taking it back brings the window again',
    async (ctx) => {
      if (!toss || !(await paymentOn(apiUrl))) return ctx.skip()
      const adminToken = await tokenOf(apiUrl, ADMIN)
      if (!(await exists(adminToken, '/admin/roles'))) return ctx.skip()
      const permissions = (await api(apiUrl, adminToken, 'GET', '/admin/permissions')).json
        .values as Array<{ key: string }>
      if (!permissions.some((p) => p.key === 'payment.exempt')) return ctx.skip()
      await toss.set({ reset: true })
      const operator = await operatorPage(browser, baseUrl)
      try {
        const op = operator.page
        // 역할 만들기
        await op.goto(`${baseUrl}/admin/roles`)
        await op.getByRole('button', { name: koAdminRolesLabels.create! }).click()
        const dialog = op.getByRole('dialog', { name: koAdminRolesLabels.createTitle! })
        await dialog.getByLabel(koAdminRolesLabels.nameLabel!).fill('WAIVED')
        await dialog.getByLabel('payment.exempt', { exact: true }).check()
        await dialog.getByRole('button', { name: koAdminRolesLabels.save!, exact: true }).click()
        await pwExpect(dialog).toBeHidden()
        await accountMenu(op, auth.adminGrantRole('WAIVED'))

        // 면제 계정의 응원: 결제창 없이 끝나고 가짜 토스 호출이 없다
        await ensureSignedIn(page, baseUrl)
        await page.goto(`${baseUrl}/cheer`)
        await page.getByRole('radio', { name: won(3000) }).click()
        await submitCheer(page)
        await page.waitForURL(/\/payments\/(?!return)[^/?]+$/)
        await pwExpect(
          page.getByText(paymentLabels.discount.settlement.EXEMPT).first(),
        ).toBeVisible()
        baseExpect((await toss.state()).calls).toHaveLength(0)

        // 운영 목록에 같은 알약
        await op.goto(`${baseUrl}/admin/payments`)
        await pwExpect(op.getByText(paymentLabels.discount.settlement.EXEMPT).first()).toBeVisible()

        // 회수 - 다음 응원은 결제창
        await accountMenu(op, auth.adminRevokeRole('WAIVED'))
        await page.goto(`${baseUrl}/cheer`)
        await page.getByRole('radio', { name: won(3000) }).click()
        await submitCheer(page)
        await returnedOrderId(page)
        await pwExpect(resultTitle(page, paymentLabels.result.paid.title)).toBeVisible()

        // 뒷정리
        await op.goto(`${baseUrl}/admin/roles`)
        await op.getByRole('button', { name: koAdminRolesLabels.remove!('WAIVED') }).click()
        const gone = op.getByRole('dialog', { name: koAdminRolesLabels.deleteTitle!('WAIVED') })
        await gone.getByRole('button', { name: koAdminRolesLabels.removeButton! }).click()
        await pwExpect(gone).toBeHidden()
      } finally {
        await operator.close()
      }
    },
    LATE * 2,
  )
})

/** 계정 화면에서 이 사용자의 줄 메뉴로 역할을 주거나 회수한다(`authzRoles.e2e.ts` 와 같은 걸음) */
async function accountMenu(op: Page, itemName: string) {
  await op.goto(`${baseUrl}/admin/accounts`)
  await op.getByLabel(auth.adminSearch, { exact: true }).fill(USER_EMAIL)
  const row = op.getByRole('row').filter({ hasText: USER_EMAIL })
  await row.getByRole('button', { name: new RegExp(USER_EMAIL) }).click()
  await op.getByRole('menuitem', { name: itemName, exact: true }).click()
  // 줄이 다시 읽혀 메뉴 항목이 반대로 바뀔 때까지
  await row.getByRole('button', { name: new RegExp(USER_EMAIL) }).click()
  await pwExpect(op.getByRole('menuitem', { name: itemName, exact: true })).toHaveCount(0)
  await op.keyboard.press('Escape')
}
