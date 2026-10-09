import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { routeTossSdk, tossControl } from './fakeToss'
import { auth, ko, launch } from './helpers'
import {
  adminPaymentsOn,
  api,
  askForRefund,
  cheerFor,
  ensureSignedIn,
  labels,
  operatorOpensPayment,
  operatorPage,
  operatorRejectsRequest,
  paymentOn,
  refundRequestRow,
  resultTitle,
  returnedOrderId,
  tokenOf,
  won,
} from './paymentSteps'

/*
 * 결제 장부 — 운영자 화면(`/admin/payments`)을 가짜 토스와 진짜 백엔드·브라우저로(스펙 §13.2 ① 의 운영자 걸음은 `payment.e2e.ts`, 여기는 운영자 화면 자체):
 *  ⓐ 운영자만 들어간다 — 일반 사용자는 「접근 차단」(로그아웃하지 않는다 · 서버도 403), 운영자는 탭 셋(전체 · 확인 필요 · 환불 요청)을 본다
 *  ⓑ 부분 환불 — 결제 번호로 찾아 한 건 화면에서 「환불하기」: 남은 금액을 넘는 금액은 막히고(눌러도 아무 일 없고 결제사 호출도 없다), 금액을 고치면 환불되어 「일부 환불됨」
 *  ⓒ 환불 요청 거절 — 사용자가 요청 → 환불 요청 탭에서 「요청 거절하기」 → 확인 창 → 사용자에게는 「환불 안 됨」, 결제는 그대로 「결제됨」이고 결제사 호출은 없다
 *  ⓓ 「결제사와 맞추기」 — 결제사에 조회가 나가고 「결제사와 맞췄어요」
 * 이 시험이 백엔드에 기대하는 것은 `globalSetup.ts` 머리말과 이 앱 README 의 「e2e 가 백엔드에 기대하는 것」에 있다 — 운영자 경로(`SKELETON_PAYMENT_ADMIN_ENABLED=true`)는 이 파일이 쓴다.
 * 운영자 경로가 닫힌 백엔드(`GET /admin/payments/refunds` 가 404), 가짜 토스가 없는 실행, 응원하기가 없는 백엔드에서는 통째로 건너뛴다.
 * 확인 필요 결제를 만드는 시나리오는 없다(그런 결제는 결제사와 금액이 어긋나는 사고가 있어야 생긴다) — 그 모양은 스토리 · 페이지 시험이 본다. 경로가 꺼진 서버의 404 화면도 페이지 시험이 본다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
const LATE = 90_000

let browser: Browser
let context: BrowserContext
let page: Page
let token = ''
beforeAll(async () => {
  ;({ browser, context, page } = await launch())
  if (fakeTossUrl) await routeTossSdk(context, fakeTossUrl)
})
afterAll(async () => {
  await browser?.close()
})

const run = (name: string, fn: () => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!toss || !(await paymentOn(apiUrl)) || !(await adminPaymentsOn(apiUrl))) return ctx.skip()
      await toss.set({ reset: true })
      token = await tokenOf(apiUrl)
      await fn()
    },
    LATE + 30_000,
  )

/** 사용자 화면에서 응원하고 결제됨까지 — 결제 번호를 돌려준다 */
async function payFor(amount: number) {
  await ensureSignedIn(page, baseUrl)
  await cheerFor(page, baseUrl, amount)
  const orderId = await returnedOrderId(page)
  await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
  return orderId
}

const orderOf = async (orderId: string) =>
  (await api(apiUrl, token, 'GET', `/payments/orders/${orderId}`)).json?.value as {
    order: { status: string; refundedAmount: number }
    refunds: Array<{ status: string }>
  }
const cancelCalls = async () =>
  (await toss!.state()).calls.filter((call) => call.path.endsWith('/cancel'))

describe('ⓐ only an administrator reaches the operator payment screens', () => {
  run(
    'a normal user is blocked without being signed out, an administrator sees the three tabs',
    async () => {
      await ensureSignedIn(page, baseUrl)
      await page.goto(`${baseUrl}/admin/payments`)
      await pwExpect(page.getByRole('heading', { name: auth.blockedTitle })).toBeVisible()
      await page.goto(`${baseUrl}/admin/payments/ord_none`)
      await pwExpect(page.getByRole('heading', { name: auth.blockedTitle })).toBeVisible()
      // 서버도 같은 답 — 화면이 막은 것만이 아니다
      const refused = await api(apiUrl, token, 'GET', '/admin/payments/refunds?status=REQUESTED')
      pwExpect(refused.status).toBe(403)
      // 로그아웃되지 않았다
      await page.goto(`${baseUrl}/cheers`)
      await pwExpect(
        page.getByRole('heading', { level: 1, name: ko('cheer.history.title') }),
      ).toBeVisible()

      const operator = await operatorPage(browser, baseUrl)
      try {
        await operator.page.goto(`${baseUrl}/admin/payments`)
        const tabs = operator.page.getByRole('tablist', { name: ko('admin.payments.tabsLabel') })
        for (const key of [
          'admin.payments.tabAll',
          'admin.payments.tabReview',
          'admin.payments.tabRefunds',
        ] as const)
          await pwExpect(tabs.getByRole('tab', { name: ko(key), exact: true })).toBeVisible()
        // 결제가 한 건도 없는 서버(이 파일을 혼자 돌릴 때)는 표 대신 빈 상태를 그린다
        await pwExpect(
          operator.page
            .getByRole('table', { name: labels.admin.orders.caption })
            .or(operator.page.getByRole('heading', { name: labels.admin.orders.emptyTitle })),
        ).toBeVisible()
        // 탭은 주소에 남는다
        await tabs.getByRole('tab', { name: ko('admin.payments.tabRefunds'), exact: true }).click()
        await pwExpect(operator.page).toHaveURL(/\/admin\/payments\?tab=refunds$/)
        await pwExpect(
          operator.page
            .getByRole('table', { name: labels.admin.requests.caption })
            .or(operator.page.getByRole('heading', { name: labels.admin.requests.emptyTitle })),
        ).toBeVisible()
      } finally {
        await operator.close()
      }
    },
  )
})

describe('ⓑ a partial refund by hand', () => {
  run(
    'an amount over what is left is blocked on the screen; a smaller one refunds and the payment reads 「일부 환불됨」',
    async () => {
      const orderId = await payFor(5000)
      const operator = await operatorPage(browser, baseUrl)
      try {
        const op = operator.page
        await operatorOpensPayment(op, baseUrl, orderId)
        // 운영자만 보는 칸
        await pwExpect(
          op.getByText(labels.admin.panel.providerPayment, { exact: true }),
        ).toBeVisible()
        await pwExpect(op.getByText(orderId, { exact: true })).toBeVisible()
        await pwExpect(op.getByRole('region', { name: labels.admin.panel.events })).toBeVisible()

        await op.getByRole('button', { name: labels.admin.panel.refund, exact: true }).click()
        const dialog = op.getByRole('dialog', { name: labels.admin.refundDialog.direct.title })
        const amount = dialog.getByLabel(labels.admin.refundDialog.amountLabel)
        await pwExpect(amount).toHaveValue('5000') // 처음은 남은 금액 전부
        const confirm = dialog.getByRole('button', {
          name: labels.admin.refundDialog.confirm,
          exact: true,
        })

        // 남은 금액을 넘으면 막힌다 — 꺼지지 않고 닿고, 눌러도 아무 일 없고, 환불 요청도 결제사도 불리지 않는다
        // (브라우저가 보낸 환불 POST 를 세어 둔다 - 아래 정상 환불에서 1 이 되므로 이 세는 눈이 멀쩡하다는 증거도 된다)
        const refundPosts: string[] = []
        op.on('request', (request) => {
          if (
            request.method() === 'POST' &&
            /\/orders\/[^/]+\/refunds$/.test(new URL(request.url()).pathname)
          )
            refundPosts.push(request.url())
        })
        await amount.fill('5001')
        await pwExpect(confirm).toHaveAttribute('aria-disabled', 'true')
        await pwExpect(
          dialog.getByText(labels.admin.refundDialog.blocked.exceeds(won(5000))),
        ).toBeVisible()
        // 닿고(포커스가 간다) Enter 로 눌러도 아무 일 없다 - `click()` 은 `aria-disabled` 단추를 「enabled 가 아님」으로 세어 15초를 기다리다 실패하므로 키보드로 누른다
        await confirm.focus()
        await pwExpect(confirm).toBeFocused()
        await op.keyboard.press('Enter')
        // 눌렀는데 아무 일이 없었음을 기다린다 - 보냈다면 누르는 순간 요청이 나가므로 잠깐 두면 `refundPosts` 에 잡히고 창은 일하는 중이거나 닫혔을 것이다.
        // (`waitForLoadState('networkidle')` 은 쓰지 않는다: 한 화면 안의 이동(SPA)이 지난 뒤에는 요청이 하나도 남지 않아도 그 상태가 다시 오지 않아 15초를 기다리다 던진다 - 첫 실행에서 실측)
        await op.waitForTimeout(1_500)
        await pwExpect(dialog).toBeVisible()
        await pwExpect(confirm).toHaveAttribute('aria-disabled', 'true')
        pwExpect(refundPosts).toHaveLength(0)
        pwExpect(await cancelCalls()).toHaveLength(0)

        // 고치면 풀린다 — 부분 환불
        await amount.fill('2000')
        await pwExpect(confirm).not.toHaveAttribute('aria-disabled', 'true')
        await confirm.click()
        await pwExpect(dialog).toBeHidden()
        pwExpect(refundPosts).toHaveLength(1) // 막힌 누름은 0, 고친 누름은 1

        await pwExpect(op.getByText(labels.orderStatus.PARTIALLY_REFUNDED).first()).toBeVisible()
        const refunds = op.getByRole('region', { name: labels.summary.refunds })
        await pwExpect(refunds.getByText(won(2000))).toBeVisible()
        await pwExpect(refunds.getByText(labels.refundReason.OPERATOR)).toBeVisible()
        // 줄에 「누가 · 왜」가 이 순서로 - 「운영자」는 사유(「운영자가 환불함」)에도 들어 있어 낱말만 찾으면 늘 참이다
        await pwExpect(refunds.getByRole('listitem').filter({ hasText: won(2000) })).toContainText(
          `${labels.admin.actors.OPERATOR} · ${labels.refundReason.OPERATOR}`,
        )
        // 이력에도 남는다
        await pwExpect(
          op
            .getByRole('region', { name: labels.admin.panel.events })
            .getByText(labels.admin.eventTypes.REFUND_SENT!),
        ).toBeVisible()
      } finally {
        await operator.close()
      }
      // 결제사에는 취소가 한 번 — 금액 2,000원, 멱등 키와 함께
      const cancels = await cancelCalls()
      pwExpect(cancels).toHaveLength(1)
      pwExpect(cancels[0]?.body?.cancelAmount).toBe(2000)
      pwExpect(cancels[0]?.idempotencyKey).toBeTruthy()
      // 서버가 아는 것
      const now = await orderOf(orderId)
      pwExpect(now.order.status).toBe('PARTIALLY_REFUNDED')
      pwExpect(now.order.refundedAmount).toBe(2000)
    },
  )
})

describe('ⓒ a refund request the operator declines', () => {
  run(
    'the person sees 「환불 안 됨」, the payment stays 「결제됨」 and Toss is never asked to cancel',
    async () => {
      const orderId = await payFor(1000)
      await askForRefund(page, baseUrl, orderId)
      const operator = await operatorPage(browser, baseUrl)
      try {
        await operator.page.goto(`${baseUrl}/admin/payments?tab=refunds`)
        await pwExpect(refundRequestRow(operator.page, orderId)).toBeVisible()
        await operatorRejectsRequest(operator.page, baseUrl, orderId)
      } finally {
        await operator.close()
      }

      // 사용자: 요청은 「환불 안 됨」으로 닫히고, 결제는 그대로, 다시 요청할 수 있다
      await page.reload()
      await pwExpect(page.getByText(labels.refundStatus.REJECTED).first()).toBeVisible()
      await pwExpect(page.getByText(labels.orderStatus.PAID).first()).toBeVisible()
      await pwExpect(
        page.getByRole('button', { name: labels.summary.requestRefund, exact: true }),
      ).not.toHaveAttribute('aria-disabled', 'true')
      pwExpect(await cancelCalls()).toHaveLength(0)
      pwExpect((await orderOf(orderId)).order.status).toBe('PAID')
    },
  )
})

describe('ⓓ matching with the payment provider', () => {
  run('「결제사와 맞추기」 asks Toss and says it matched', async () => {
    const orderId = await payFor(3000)
    const operator = await operatorPage(browser, baseUrl)
    try {
      const op = operator.page
      await operatorOpensPayment(op, baseUrl, orderId)
      const lookups = async () =>
        (await toss!.state()).calls.filter((call) => call.method === 'GET').length
      const before = await lookups()
      await op.getByRole('button', { name: labels.admin.panel.sync, exact: true }).click()
      await pwExpect(
        op.getByRole('status').filter({ hasText: labels.admin.panel.synced }),
      ).toBeVisible()
      pwExpect(await lookups()).toBeGreaterThan(before)
      // 확인 필요가 아닌 결제는 그대로 — 알약도 띠도 없다
      await pwExpect(op.getByText(labels.unknownStatus, { exact: true })).toHaveCount(0)
      await pwExpect(op.getByText(labels.orderStatus.PAID).first()).toBeVisible()
    } finally {
      await operator.close()
    }
  })
})
