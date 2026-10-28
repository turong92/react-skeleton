import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { koAdminRolesLabels } from '@skeleton/auth/admin'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { routeTossSdk, tossControl } from './fakeToss'
import { auth, ko, launch } from './helpers'
import {
  ADMIN,
  adminPaymentsOn,
  api,
  askForRefund,
  cheerFor,
  ensureSignedIn,
  labels,
  operatorPage,
  operatorRefundsRequest,
  operatorOpensPayment,
  paymentOn,
  resultTitle,
  returnedOrderId,
  tokenOf,
} from './paymentSteps'

/*
 * 역할 · 권한 (스펙 §8.2) — 진짜 백엔드(`authz` 모듈이 있고 `skeleton.authz.admin.enabled=true`) · 브라우저 · 가짜 토스.
 *  ① 관리자가 역할 화면에서 `CS`(결제 보기 + 환불)를 만들고, 그 `CS` 를 포함하는 `STAFF`(권한 없이 위계만)를 만들어 계정 화면에서 시드 사용자에게 준다
 *  ② 그 사용자는 메뉴에 결제만(계정 · 역할 메뉴 없음), 열린 환불 요청을 승인할 수 있고, 「결제사와 맞추기」 단추는 없고 직접 호출은 서버가 403
 *  ③ 다른 역할이 포함 중인 `CS` 와 가진 계정이 있는 `STAFF` 는 지울 수 없다는 안내가 뜨고, 전권(ADMIN) 행은 잠겨 있다
 *  ④ 관리자가 `STAFF` 를 회수하면 사용자는 **다시 로그인하지 않아도** 다음 동작이 403(접근 차단 안내)
 * 아직 실행하지 않았다 — kotlin 의 K2 · K3 · K4 를 합친 백엔드(`scripts/sample-e2e-backend.sh`)가 있어야 돈다.
 * 역할 API(`GET /admin/roles`)가 404 인 백엔드, 운영자 결제 경로가 닫힌 백엔드, 가짜 토스가 없는 실행에서는 통째로 건너뛴다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
const roles = { ...koAdminRolesLabels.permissionLabels }
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

async function authzOn() {
  const answer = await api(apiUrl, await tokenOf(apiUrl, ADMIN), 'GET', '/admin/roles')
  return answer.status === 200
}

/** 계정 화면에서 이 사용자의 줄 메뉴로 역할을 주거나 회수한다 */
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

describe('authz: a CS role made on the screen, given to a user and taken back', () => {
  it(
    'creates CS, gives it, the user sees payments only and can approve a refund but not sync, then loses it without signing in again',
    async (ctx) => {
      if (
        !toss ||
        !(await paymentOn(apiUrl)) ||
        !(await adminPaymentsOn(apiUrl)) ||
        !(await authzOn())
      )
        return ctx.skip()
      await toss.set({ reset: true })
      const userToken = await tokenOf(apiUrl)

      // 사용자: 응원하고 환불을 요청해 둔다(열린 환불 요청)
      await ensureSignedIn(page, baseUrl)
      await cheerFor(page, baseUrl, 3000)
      const orderId = await returnedOrderId(page)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      await askForRefund(page, baseUrl, orderId)

      const operator = await operatorPage(browser, baseUrl)
      try {
        const op = operator.page
        // ① 역할 만들기
        await op.goto(`${baseUrl}/admin/roles`)
        await op.getByRole('button', { name: koAdminRolesLabels.create! }).click()
        const dialog = op.getByRole('dialog', { name: koAdminRolesLabels.createTitle! })
        await dialog.getByLabel(koAdminRolesLabels.nameLabel!).fill('CS')
        await dialog.getByLabel(roles['payment.read']!, { exact: true }).check()
        await dialog.getByLabel(roles['payment.refund']!, { exact: true }).check()
        await dialog.getByRole('button', { name: koAdminRolesLabels.save!, exact: true }).click()
        await pwExpect(dialog).toBeHidden()
        const csRow = op.getByRole('row').filter({ hasText: 'CS' })
        await pwExpect(csRow.first()).toContainText(roles['payment.refund']!)
        // 전권 행은 잠겨 있다
        await pwExpect(
          op.getByRole('button', { name: koAdminRolesLabels.edit!('ADMIN') }),
        ).toHaveAttribute('aria-disabled', 'true')

        // 위계: STAFF 는 CS 를 포함한다(자기 권한은 없다) - 시드 사용자에게는 STAFF 만 준다
        await op.getByRole('button', { name: koAdminRolesLabels.create! }).click()
        const staffDialog = op.getByRole('dialog', { name: koAdminRolesLabels.createTitle! })
        await staffDialog.getByLabel(koAdminRolesLabels.nameLabel!).fill('STAFF')
        await staffDialog.getByLabel('CS', { exact: true }).check()
        // 포함한 CS 의 권한은 물려받은 것으로 체크 · 잠금
        await pwExpect(
          staffDialog.getByLabel(roles['payment.refund']!, { exact: true }),
        ).toBeDisabled()
        await staffDialog
          .getByRole('button', { name: koAdminRolesLabels.save!, exact: true })
          .click()
        await pwExpect(staffDialog).toBeHidden()
        await accountMenu(op, auth.adminGrantRole('STAFF'))

        // ③ 포함된 역할 · 가진 계정이 있는 역할은 지울 수 없다
        await op.goto(`${baseUrl}/admin/roles`)
        await op.getByRole('button', { name: koAdminRolesLabels.remove!('CS') }).click()
        const included = op.getByRole('dialog', { name: koAdminRolesLabels.deleteTitle!('CS') })
        await included.getByRole('button', { name: koAdminRolesLabels.removeButton! }).click()
        await pwExpect(included.getByText(koAdminRolesLabels.errors!.roleIncluded!)).toBeVisible()
        await included.getByRole('button', { name: koAdminRolesLabels.cancel! }).click()
        await op.getByRole('button', { name: koAdminRolesLabels.remove!('STAFF') }).click()
        const del = op.getByRole('dialog', { name: koAdminRolesLabels.deleteTitle!('STAFF') })
        await del.getByRole('button', { name: koAdminRolesLabels.removeButton! }).click()
        await pwExpect(del.getByText(koAdminRolesLabels.errors!.inUse!)).toBeVisible()
        await del.getByRole('button', { name: koAdminRolesLabels.cancel! }).click()

        // ② 사용자: 새로 읽으면 메뉴에 결제만
        await page.goto(`${baseUrl}/`)
        const nav = page.getByRole('navigation').first()
        await pwExpect(nav.getByRole('link', { name: ko('nav.adminPayments') })).toBeVisible()
        await pwExpect(nav.getByRole('link', { name: ko('nav.adminAccounts') })).toHaveCount(0)
        await pwExpect(nav.getByRole('link', { name: ko('nav.adminRoles') })).toHaveCount(0)
        // 열린 환불 요청을 승인한다
        await operatorRefundsRequest(page, baseUrl, orderId)
        // 「결제사와 맞추기」 단추가 없고, 직접 부르면 서버가 403
        await operatorOpensPayment(page, baseUrl, orderId)
        await pwExpect(
          page.getByRole('button', { name: labels.admin.panel.sync, exact: true }),
        ).toHaveCount(0)
        const sync = await api(apiUrl, userToken, 'POST', `/admin/payments/orders/${orderId}/sync`)
        pwExpect(sync.status).toBe(403)

        // ④ 회수 - 다시 로그인하지 않고 다음 동작이 403
        await accountMenu(op, auth.adminRevokeRole('STAFF'))
        await page.goto(`${baseUrl}/admin/payments`)
        await pwExpect(page.getByRole('heading', { name: auth.blockedTitle })).toBeVisible()
        const refused = await api(
          apiUrl,
          userToken,
          'GET',
          '/admin/payments/refunds?status=REQUESTED',
        )
        pwExpect(refused.status).toBe(403)

        // 뒷정리: STAFF 가 먼저(가진 계정이 없어졌다), 그다음 포함하던 CS
        await op.goto(`${baseUrl}/admin/roles`)
        for (const name of ['STAFF', 'CS']) {
          await op.getByRole('button', { name: koAdminRolesLabels.remove!(name) }).click()
          const gone = op.getByRole('dialog', { name: koAdminRolesLabels.deleteTitle!(name) })
          await gone.getByRole('button', { name: koAdminRolesLabels.removeButton! }).click()
          await pwExpect(gone).toBeHidden()
          await pwExpect(op.getByRole('row').filter({ hasText: name })).toHaveCount(0)
        }
      } finally {
        await operator.close()
      }
    },
    LATE * 2,
  )
})
