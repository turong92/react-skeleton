import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { PLANTED, authorizeAtFakeToss, routeTossSdk, tossControl } from './fakeToss'
import { ko, launch } from './helpers'
import {
  api,
  askForRefund,
  cheerFor,
  cheerOptions,
  choiceShowsHover,
  ensureSignedIn,
  labels,
  operatorPage,
  operatorRefundsRequest,
  paymentOn,
  resultTitle,
  returnedOrderId,
  tokenOf,
  won,
} from './paymentSteps'

/*
 * 결제 장부 1단계 — 응원하기 여정을 가짜 토스(`fakeToss.ts`)와 진짜 백엔드·브라우저로 끝까지(스펙 §13.2 ①~⑦):
 *  ① 응원하기 → 가짜 결제창 → 「결제됨」 → 내 응원 내역 → 카드 표시 → 환불 요청 → 운영자 환불 → 「환불됨」
 *  ② 결제창에서 인증만 하고 떠난 결제를 가짜 결제사가 나중에 끝낸다 → 만료 작업(조회)이 「결제됨」으로 맞추고 응원 기록이 생긴다
 *  ③ 돌아온 주소의 금액을 고치면 400 AMOUNT_MISMATCH — 결제사 승인 호출이 없다
 *  ④ 카드사 거절 → 「결제 안 됨」 → 다시 응원하기는 새 주문
 *  ⑤ 승인 응답 유실 → 「결제 확인 중」 → 잠시 뒤 「결제됨」(조회 작업이 맞춘다)
 *  ⑥ 결과 화면 새로 고침 · 뒤로 가기에 결제사 호출이 늘지 않는다
 *  ⑦ 결제창에서 그만둠 → 「그만뒀어요」 (결제창이 failUrl 에 주문 id 를 싣지 않아도 — 우리가 실은 `order` 로 그 주문을 닫는다)
 *  ⑧ 환불 요청 → 「요청 거두기」 → 「환불 요청 거둠」(돈은 안 움직였다), 다시 요청할 수 있다
 * 브라우저의 토스 SDK 스크립트는 가로채 가짜(곧장 successUrl/failUrl 로 돌려보내는 것)로 바꾼다(`routeTossSdk`) — `social.e2e.ts` 가 X 인가 주소를 가짜로 돌리는 것과 같은 방식.
 * 이 시험이 백엔드에 기대하는 것은 `globalSetup.ts` 머리말과 이 앱 README 의 「e2e 가 백엔드에 기대하는 것」에 있다. 가짜 토스가 없거나(`fakeTossUrl` 빈 문자열) 백엔드에 응원하기가 없으면 통째로 건너뛴다.
 * ①의 운영자 환불은 운영자 화면에서 한다(`operatorRefundsRequest` — 별도 로그인 컨텍스트). 운영자 화면 자체의 시나리오는 `paymentAdmin.e2e.ts`.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
/** 결제 확정은 조회 작업을 기다릴 수 있다(첫 조회 11초) — 그것을 넉넉히 넘기는 한도 */
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
      if (!toss || !(await paymentOn(apiUrl))) return ctx.skip()
      await toss.set({ reset: true })
      token = await tokenOf(apiUrl)
      await fn()
    },
    LATE + 30_000,
  )

/** 이 주문의 서버 쪽 지금 상태 */
const orderState = async (orderId: string) =>
  (await api(apiUrl, token, 'GET', `/payments/orders/${orderId}`)).json?.value?.order?.status as
    | string
    | undefined

describe('① the whole journey: cheer, pay, see it, ask for a refund, the operator refunds', () => {
  run('pays 3,000원, shows the card, and ends 「환불됨」 after the operator refunds', async () => {
    await ensureSignedIn(page, baseUrl)
    await page.goto(`${baseUrl}/cheer`)
    await choiceShowsHover(page) // 금액 칸의 손 올린 모양(계산된 스타일)
    await cheerFor(page, baseUrl, 3000)

    // 결제창(가짜) → 돌아와서 승인 → 「결제됨」
    const orderId = await returnedOrderId(page)
    await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
    await pwExpect(page.getByText(labels.testMode)).toBeVisible()
    await pwExpect(page.getByText('현대카드 ····1234')).toBeVisible()

    // 내 응원 내역에 한 줄 — 결제됨
    await page.getByRole('button', { name: ko('cheer.history.title') }).click()
    await page.waitForURL(/\/cheers$/)
    const row = page
      .getByRole('listitem')
      .filter({ hasText: won(3000) })
      .first()
    await pwExpect(row.getByText(labels.orderStatus.PAID)).toBeVisible()
    await pwExpect(row.getByText('현대카드 ····1234')).toBeVisible() // 내역 줄의 카드 표시

    // 「자세히」 → 한 건: 금액 · 카드
    await row.getByRole('link', { name: new RegExp(labels.list.details) }).click()
    await page.waitForURL(new RegExp(`/payments/${orderId}$`))
    await pwExpect(page.getByText('현대카드 ····1234')).toBeVisible()

    // 환불 요청(돈은 안 움직인다) → 「환불 요청함」, 단추는 닿는 채로 이유가 옆에
    await page.getByRole('button', { name: labels.summary.requestRefund, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: labels.refundDialog.confirm }).click()
    await pwExpect(dialog).toBeHidden()
    await pwExpect(page.getByText(labels.refundStatus.REQUESTED).first()).toBeVisible()
    const requestButton = page.getByRole('button', {
      name: labels.summary.requestRefund,
      exact: true,
    })
    await pwExpect(requestButton).toHaveAttribute('aria-disabled', 'true')
    await pwExpect(page.getByText(labels.refundBlocked.requested)).toBeVisible()
    pwExpect(
      await toss!.state().then((s) => s.calls.filter((c) => c.path.endsWith('/cancel'))),
    ).toHaveLength(0)

    // 운영자 환불 — 운영자 화면에서: 환불 요청 탭 → 이 결제의 「요청대로 환불하기」 → 확인 창
    const operator = await operatorPage(browser, baseUrl)
    try {
      await operatorRefundsRequest(operator.page, baseUrl, orderId)
    } finally {
      await operator.close()
    }
    await page.reload()
    await pwExpect(page.getByText(labels.orderStatus.REFUNDED).first()).toBeVisible()
    await pwExpect(
      page.getByRole('button', { name: labels.summary.requestRefund, exact: true }),
    ).toHaveCount(0)

    // 내역에서도 「환불됨」
    await page.goto(`${baseUrl}/cheers`)
    await pwExpect(
      page
        .getByRole('listitem')
        .filter({ hasText: won(3000) })
        .first()
        .getByText(labels.orderStatus.REFUNDED),
    ).toBeVisible()

    // 결제사에는 취소가 한 번, 멱등 키와 함께
    const cancels = (await toss!.state()).calls.filter((c) => c.path.endsWith('/cancel'))
    pwExpect(cancels).toHaveLength(1)
    pwExpect(cancels[0]?.idempotencyKey).toBeTruthy()

    // 결제사가 준 개인정보(이름 · 이메일 · 전화 · 전체 카드 번호)는 화면에도 우리 API 에도 없다
    const detail = await api(apiUrl, token, 'GET', `/payments/orders/${orderId}`)
    const seen = JSON.stringify(detail.json) + (await page.content())
    for (const planted of Object.values(PLANTED)) pwExpect(seen).not.toContain(planted)
  })
})

describe('② left at the payment window, finished later: the expiry job matches it', () => {
  run(
    'the order is not paid until Toss says so; then it is 「결제됨」 and the cheer exists',
    async () => {
      await ensureSignedIn(page, baseUrl)
      await toss!.set({ sdk: 'leave' })
      await cheerFor(page, baseUrl, 1000)

      // 창은 돌아오지 않는다 — 가짜 토스에는 인증만 마친 결제가 하나
      await pwExpect
        .poll(async () => (await toss!.state()).payments.length, { timeout: 20_000 })
        .toBe(1)
      const waiting = (await toss!.state()).payments[0]!
      pwExpect(waiting.status).toBe('IN_PROGRESS')
      pwExpect(['PENDING', 'CONFIRMING']).toContain(await orderState(waiting.orderId))

      // 사용자가 뒤늦게 결제를 끝낸다(가짜 토스에서) — 우리 서버는 아직 모른다
      await toss!.set({ complete: waiting.orderId })

      // 결제 가능 시간이 지나면 만료 작업이 결제사에 물어 「결제됨」으로 맞춘다
      await pwExpect
        .poll(() => orderState(waiting.orderId), { timeout: LATE, intervals: [2_000] })
        .toBe('PAID')

      // 응원 기록이 생겼다 — 내 응원 내역에 한 줄. 작업이 맞춘 결제의 지급은 `ORDER_FULFIL` 작업(워커 1초 간격)이 하므로 기록은 `PAID` 보다 잠깐 늦다 —
      // 그 사이의 내역은 비어 보일 수 있다(백엔드 읽기 기준 - 실측은 하지 않았다). 내역 화면은 스스로 다시 묻지 않으므로 새로 열며 기다린다
      const paidRow = page
        .getByRole('listitem')
        .filter({ hasText: won(1000) })
        .first()
        .getByText(labels.orderStatus.PAID)
      await pwExpect(async () => {
        await page.goto(`${baseUrl}/cheers`)
        await pwExpect(paidRow).toBeVisible({ timeout: 3_000 })
      }).toPass({ timeout: 20_000, intervals: [500] })
    },
  )
})

describe('③ a changed amount in the return address is refused and Toss is never asked', () => {
  run(
    '400 PAYMENT.AMOUNT_MISMATCH, no confirm call at Toss, the screen says it could not confirm',
    async () => {
      await ensureSignedIn(page, baseUrl)
      const options = await cheerOptions(apiUrl, token)
      const option = options.find((o) => o.amount.amount === 3000)!
      const created = await api(
        apiUrl,
        token,
        'POST',
        '/payments/orders',
        { itemType: 'cheer', itemRef: option.itemRef },
        { 'Idempotency-Key': `e2e-tamper-${Date.now()}` },
      )
      pwExpect(created.status).toBe(201)
      const orderId = created.json.value.order.id as string
      // 사용자가 결제창에서 인증을 마쳤다 — 결제 키가 있다
      const { paymentKey } = await authorizeAtFakeToss(fakeTossUrl, { orderId, amount: 3000 })

      // 돌아온 주소의 금액을 1원으로 고쳐 연다
      await page.goto(
        `${baseUrl}/payments/return?paymentKey=${paymentKey}&orderId=${orderId}&amount=1`,
      )
      await pwExpect(resultTitle(page, labels.result.unconfirmed.title)).toBeVisible()
      await pwExpect(page.getByRole('button', { name: labels.result.retry })).toHaveCount(0) // 재결제 단추가 없다

      // 같은 일을 API 로: 서버가 거절한 코드
      const direct = await api(apiUrl, token, 'POST', `/payments/orders/${orderId}/confirm`, {
        providerPaymentId: paymentKey,
        amount: 1,
      })
      pwExpect(direct.status).toBe(400)
      pwExpect(direct.json.code).toBe('PAYMENT.AMOUNT_MISMATCH')

      // 결제사는 한 번도 불리지 않았고, 주문은 아직 결제할 수 있다
      pwExpect(toss!.confirmCalls(await toss!.state(), orderId)).toHaveLength(0)
      pwExpect(await orderState(orderId)).toBe('PENDING')
    },
  )
})

describe('④ a card the issuer declines', () => {
  run(
    '「결제 안 됨」 with a reason, no way to double pay; trying again is a new order',
    async () => {
      await ensureSignedIn(page, baseUrl)
      await toss!.set({ confirm: { mode: 'decline' } })
      await cheerFor(page, baseUrl, 5000)
      const first = await returnedOrderId(page)
      await pwExpect(resultTitle(page, labels.result.failed.title)).toBeVisible()
      await pwExpect(page.getByText(labels.failure.CARD_DECLINED)).toBeVisible()
      await pwExpect(page.getByText(labels.orderStatus.PAID)).toHaveCount(0)

      // 「다시 해 보기」 → 응원하기로 → 다시 누르면 새 주문
      await page.getByRole('button', { name: labels.result.retry }).click()
      await page.waitForURL(/\/cheer$/)
      await page.getByRole('radio', { name: won(5000) }).click()
      await page.getByRole('button', { name: ko('cheer.submit'), exact: true }).click()
      const second = await returnedOrderId(page)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      pwExpect(second).not.toBe(first)
      pwExpect(await orderState(first)).not.toBe('PAID')
      pwExpect(await orderState(second)).toBe('PAID')
    },
  )
})

describe('⑤ the approval answer is lost', () => {
  run(
    '「결제 확인 중」 first, then 「결제됨」 by itself once the lookup job matches it',
    async () => {
      await ensureSignedIn(page, baseUrl)
      await toss!.set({ confirm: { mode: 'lose' } })
      await cheerFor(page, baseUrl, 3000)
      const orderId = await returnedOrderId(page)

      await pwExpect(resultTitle(page, labels.result.confirming.title)).toBeVisible()
      // 화면은 그대로 두었다 — 조회 작업이 맞추면 스스로 바뀐다
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible({ timeout: LATE })

      // 결제사의 승인은 한 번뿐이다(다시 보내기가 결제사를 또 부르지 않는다)
      pwExpect(toss!.confirmCalls(await toss!.state(), orderId)).toHaveLength(1)
      pwExpect(await orderState(orderId)).toBe('PAID')
    },
  )
})

describe('⑥ refreshing or going back on the result does not call Toss again', () => {
  run(
    'the confirm is sent again by the page, the server answers the same, Toss sees one confirm',
    async () => {
      await ensureSignedIn(page, baseUrl)
      await cheerFor(page, baseUrl, 3000)
      const orderId = await returnedOrderId(page)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()
      // 이 주문에 대한 호출만 센다(다른 주문의 늦은 조회 · 만료 작업이 흔들지 못하게)
      const before = toss!.callsFor(await toss!.state(), orderId).length
      pwExpect(toss!.confirmCalls(await toss!.state(), orderId)).toHaveLength(1)

      // 새로 고침
      await page.reload()
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()

      // 다른 화면에 갔다가 뒤로 가기
      await page.getByRole('button', { name: ko('cheer.history.title') }).click()
      await page.waitForURL(/\/cheers$/)
      await page.goBack()
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()

      const after = await toss!.state()
      pwExpect(toss!.callsFor(after, orderId)).toHaveLength(before)
      pwExpect(toss!.confirmCalls(after, orderId)).toHaveLength(1)
    },
  )
})

describe('⑦ closing the payment window', () => {
  run('「그만뒀어요」 and a way to try again; Toss is never asked to confirm', async () => {
    await ensureSignedIn(page, baseUrl)
    await toss!.set({ sdk: 'cancel' })
    await cheerFor(page, baseUrl, 3000)
    await page.waitForURL(/\/payments\/return\?/)
    const orderId = new URL(page.url()).searchParams.get('orderId')!
    await pwExpect(resultTitle(page, labels.result.canceled.title)).toBeVisible()
    await pwExpect(page.getByRole('button', { name: labels.result.retry })).toBeVisible()
    // 화면은 주소만 보고 곧바로 말한다 — 서버의 주문이 닫히는 것은 그 뒤 잠깐 있다
    await pwExpect.poll(() => orderState(orderId)).toBe('CANCELED')
    pwExpect(toss!.confirmCalls(await toss!.state(), orderId)).toHaveLength(0)
  })

  run(
    'the window names no order when it closes — 「그만뒀어요」 all the same, the order we put on the failure address is the one given back',
    async () => {
      await ensureSignedIn(page, baseUrl)
      await toss!.set({ sdk: 'cancel-no-order-id' })
      await cheerFor(page, baseUrl, 1000)
      await page.waitForURL(/\/payments\/return\?/)
      const returned = new URL(page.url()).searchParams
      pwExpect(returned.get('orderId')).toBeNull() // 결제창은 주문을 말하지 않았다
      const orderId = returned.get('order')! // 우리가 실패 주소에 실은 것
      pwExpect(orderId).toBeTruthy()
      await pwExpect(resultTitle(page, labels.result.canceled.title)).toBeVisible()
      await pwExpect(page.getByText(ko('cheer.return.invalidTitle'))).toHaveCount(0)
      await pwExpect(page.getByRole('button', { name: labels.result.retry })).toBeVisible()
      await pwExpect.poll(() => orderState(orderId)).toBe('CANCELED') // 그 주문이 닫혔다
      pwExpect(toss!.confirmCalls(await toss!.state(), orderId)).toHaveLength(0)
    },
  )
})

describe('⑧ a refund request taken back', () => {
  run(
    '「요청 거두기」 ends in 「환불 요청 거둠」, no cancel reaches Toss, and the payment can be asked about again',
    async () => {
      await ensureSignedIn(page, baseUrl)
      await cheerFor(page, baseUrl, 1000)
      const orderId = await returnedOrderId(page)
      await pwExpect(resultTitle(page, labels.result.paid.title)).toBeVisible()

      // 요청 → 「환불 요청함」, 거두기 단추가 생긴다
      await askForRefund(page, baseUrl, orderId)
      const withdraw = page.getByRole('button', {
        name: labels.summary.withdrawRefund,
        exact: true,
      })
      await pwExpect(withdraw).toBeVisible()

      // 거둔다 → 「환불 요청 거둠」, 거두기 단추는 사라진다
      await withdraw.click()
      await pwExpect(page.getByText(labels.refundStatus.WITHDRAWN).first()).toBeVisible()
      await pwExpect(withdraw).toHaveCount(0)

      // 돈은 안 움직였고 결제는 그대로이며, 다시 요청할 수 있다(단추가 막히지 않는다)
      pwExpect((await toss!.state()).calls.filter((c) => c.path.endsWith('/cancel'))).toHaveLength(
        0,
      )
      pwExpect(await orderState(orderId)).toBe('PAID')
      await pwExpect(
        page.getByRole('button', { name: labels.summary.requestRefund, exact: true }),
      ).not.toHaveAttribute('aria-disabled', 'true')
      await askForRefund(page, baseUrl, orderId)
      await pwExpect(withdraw).toBeVisible() // 새 요청에 다시 거두기가 생긴다
    },
  )
})
