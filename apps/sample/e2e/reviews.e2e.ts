import { koReviewsAdminLabels } from '@skeleton/reviews/admin'
import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { reviewsLabelsFor } from '../src/reviews/labels'
import { readAllNotifications } from './boardSteps'
import { routeTossSdk, tossControl } from './fakeToss'
import { DEMO, dismissConsent, launch, signIn } from './helpers'
import {
  ADMIN,
  api,
  endLiveSubscription,
  labels as paymentLabels,
  resultTitle,
  subscriptionsOn,
  tokenOf,
} from './paymentSteps'

/*
 * 리뷰 (스펙 §7 「리뷰」 여정) — 진짜 백엔드(`review` · `review-jdbc` · `payment` 구독 · `notification` · 보상, `skeleton.review.admin.enabled=true`, 견본 yml `require-purchase: true`) · 가짜 토스 · 브라우저.
 *  ① user 가 가짜 결제사로 베이직을 구독 → `/products/basic` 에서 5점 · 본문을 써서 올리면 요약이 「리뷰 1개 · 5.0」, 리뷰에 「구매 인증」 → 보상 「100포인트」가 포인트와 알림함에 도착
 *  ② 구매 없는 user2(`moderator@example.com`)는 쓰기 칸 대신 「구매한 분만 쓸 수 있어요」, user 의 리뷰에 「도움돼요」(1) · 신고(스팸)
 *  ④ 로그아웃 상태(새 브라우저)에서도 상품 화면의 리뷰가 보인다 - 숨기기 전이어야 하므로 ③ 앞에 돈다
 *  ③ admin 이 `/admin/reviews` 신고 큐에서 신고 사유 칩(스팸)을 보고 답글(리뷰당 하나) → 숨기기(사유 필수) → user 에게 알림, 상품 화면은 리뷰가 없고, user 는 자기 리뷰에서 「숨겨짐」 + 사유
 * 시나리오는 앞 시나리오가 만든 리뷰 한 건을 이어 쓴다(위 순서대로 돈다). 백엔드는 매번 새 DB(`globalSetup`)라 user 의 첫 리뷰 보상이 한 번만 나가는 것에 기댄다.
 * 리뷰·구독 모듈이 없는 백엔드(`GET /reviews/config` · `GET /payments/subscriptions/plans` 가 404)면 통째로 건너뛴다.
 * 아직 실행하지 않았다 - 서버 쪽(K1~K3)이 있는 백엔드(`scripts/sample-e2e-backend.sh`)를 띄운 뒤 `pnpm e2e:sample e2e/reviews.e2e.ts`.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakeTossUrl = inject('fakeTossUrl')
const toss = fakeTossUrl ? tossControl(fakeTossUrl) : null
const SECOND = { email: 'moderator@example.com', password: 'password' }
const L = reviewsLabelsFor('ko')
const A = koReviewsAdminLabels.queue
const REPLY = koReviewsAdminLabels.replyEditor
const HIDE = koReviewsAdminLabels.hide
const LATE = 180_000

const BODY = '배송이 빠르고 포장이 꼼꼼했어요 e2e 후기'
const REPLY_BODY = '소중한 후기 감사합니다 e2e 답글'
const HIDE_REASON = 'e2e 광고성 내용'

let browser: Browser
let context: BrowserContext
let page: Page
beforeAll(async () => {
  ;({ browser, context, page } = await launch())
  if (fakeTossUrl) await routeTossSdk(context, fakeTossUrl)
})
afterAll(async () => {
  try {
    // 이 파일이 남긴 것을 되돌린다: 숨긴 리뷰를 되살리고, 구독을 닫고, 알림을 읽음으로(뒤 파일의 「안 읽은 알림 없음」 가정)
    const reviewId = await userReviewId()
    if (reviewId)
      await api(
        apiUrl,
        await tokenOf(apiUrl, ADMIN),
        'PUT',
        `/admin/reviews/${reviewId}/moderation`,
        {
          status: 'PUBLISHED',
        },
      )
    await endLiveSubscription(apiUrl, DEMO)
    await readAllNotifications(apiUrl, DEMO)
  } finally {
    await browser?.close()
  }
})

let probe: Promise<boolean> | undefined
/** 이 백엔드에 리뷰(`GET /reviews/config`)가 있는가 - 404 만 「없다」 */
const reviewsOn = () =>
  (probe ??= tokenOf(apiUrl).then(async (token) => {
    const answer = await api(apiUrl, token, 'GET', '/reviews/config')
    if (answer.status === 404) return false
    if (answer.status !== 200) throw new Error(`GET /reviews/config → ${answer.status}`)
    return true
  }))

const run = (name: string, fn: () => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!toss || !(await subscriptionsOn(apiUrl)) || !(await reviewsOn())) return ctx.skip()
      await fn()
    },
    LATE,
  )

/** user 의 `product:basic` 리뷰 id - API 로 읽는다(없으면 null) */
async function userReviewId(): Promise<string | null> {
  const token = await tokenOf(apiUrl, DEMO)
  const mine = await api(apiUrl, token, 'GET', '/reviews/me')
  if (mine.status !== 200) return null
  const found = (
    mine.json.values as Array<{ id: string; targetType: string; targetId: string }>
  ).find((r) => r.targetType === 'product' && r.targetId === 'basic')
  return found?.id ?? null
}

const balanceOf = async (token: string) =>
  (await api(apiUrl, token, 'GET', '/points')).json.value.balance as number
const unreadOf = async (token: string) =>
  (await api(apiUrl, token, 'GET', '/notifications/unread-count')).json.value.count as number

/** 다른 계정으로 로그인한 새 브라우저 창 - 쓴 뒤 `close()` */
async function accountPage(account: { email: string; password: string }) {
  const own = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
  })
  own.setDefaultTimeout(15_000)
  const ownPage = await own.newPage()
  await signIn(ownPage, baseUrl, account)
  return { page: ownPage, close: () => own.close() }
}

/** 리뷰 한 줄(article) - 본문으로 찾는다 */
const reviewItem = (p: Page, text: string) => p.getByRole('article').filter({ hasText: text })

describe('reviews: buy, write, help, report, read signed-out, reply, hide', () => {
  run(
    '① a buyer writes a review: the summary reads 1 · 5.0, the review is 구매 인증, and the reward 100 points arrives',
    async () => {
      await toss!.set({ reset: true })
      await endLiveSubscription(apiUrl, DEMO)
      const token = await tokenOf(apiUrl, DEMO)
      const pointsBefore = await balanceOf(token)
      await signIn(page, baseUrl, DEMO)

      // 가짜 결제사로 베이직 구독 - 앱의 결제 리스너가 구매 신호(`ReviewPurchases.record`)를 넣는다
      await page.goto(`${baseUrl}/subscribe`)
      await page.getByRole('button', { name: /구독하기.*베이직/ }).click()
      await page.waitForURL(/\/subscriptions\/return\?/)
      await pwExpect(resultTitle(page, paymentLabels.result.paid.title)).toBeVisible()

      await page.goto(`${baseUrl}/products/basic`)
      await page.getByRole('radio', { name: L.rating.point(5), exact: true }).check()
      await page.getByLabel(L.form.body).fill(BODY)
      await page.getByRole('button', { name: L.form.submit, exact: true }).click()

      const mine = reviewItem(page, BODY)
      await pwExpect(mine).toBeVisible()
      await pwExpect(mine.getByText(L.item.verified, { exact: true })).toBeVisible()
      await pwExpect(page.getByText(L.summary.count(1), { exact: true })).toBeVisible()
      await pwExpect(page.getByText('5.0', { exact: true }).first()).toBeVisible()
      // 이제 쓸 수 없다 - 이미 썼다
      await pwExpect(page.getByText(L.writeBlocked.ALREADY_WRITTEN)).toBeVisible()

      // 보상: 일꾼을 거쳐 포인트 +100, 알림함에 「100포인트」
      await pwExpect
        .poll(() => balanceOf(token), { timeout: 60_000 })
        .toBeGreaterThanOrEqual(pointsBefore + 100)
      await page.getByRole('button', { name: /^알림/ }).click()
      await pwExpect(page.getByText(/100\s*포인트/).first()).toBeVisible()
    },
  )

  run(
    '② a user without a purchase sees why they cannot write; they can mark helpful and report spam',
    async () => {
      const other = await accountPage(SECOND)
      try {
        const p = other.page
        await p.goto(`${baseUrl}/products/basic`)
        await pwExpect(p.getByText(L.writeBlocked.PURCHASE_REQUIRED)).toBeVisible()
        await pwExpect(p.getByLabel(L.form.body)).toHaveCount(0)

        const item = reviewItem(p, BODY)
        await pwExpect(item).toBeVisible()
        // 도움돼요 - 눌리고(aria-pressed) 숫자가 1
        await item.getByRole('button', { name: /^도움돼요/ }).click()
        await pwExpect(item.getByRole('button', { name: /도움돼요 1$/ })).toHaveAttribute(
          'aria-pressed',
          'true',
        )
        // 신고(스팸)
        await item.getByRole('button', { name: /리뷰 더보기$/ }).click()
        await p.getByRole('menuitem', { name: L.item.report }).click()
        const dialog = p.getByRole('dialog', { name: L.report.title })
        await dialog.getByRole('radio', { name: L.report.reasons.SPAM }).check()
        await dialog.getByRole('button', { name: L.report.submit }).click()
        await pwExpect(item.getByText(L.report.sent)).toBeVisible()
      } finally {
        await other.close()
      }
    },
  )

  run(
    '④ signed out, the product screen still shows the review (and says to sign in to write)',
    async () => {
      const guest = await browser.newContext({
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        viewport: { width: 1280, height: 800 },
      })
      guest.setDefaultTimeout(15_000)
      try {
        const p = await guest.newPage()
        await p.goto(`${baseUrl}/products/basic`)
        await dismissConsent(p)
        await pwExpect(reviewItem(p, BODY)).toBeVisible()
        await pwExpect(p.getByText(L.summary.count(1), { exact: true })).toBeVisible()
        await pwExpect(p.getByText(L.writeBlocked.SIGN_IN)).toBeVisible()
        // 로그인 전에는 도움돼요 · 신고 단추가 없다
        await pwExpect(p.getByRole('button', { name: /^도움돼요/ })).toHaveCount(0)
      } finally {
        await guest.close()
      }
    },
  )

  run(
    '③ the operator sees the report chip, replies, then hides with a reason: the author is told, the product shows no reviews, the author sees 숨겨짐',
    async () => {
      const userToken = await tokenOf(apiUrl, DEMO)
      const unreadBefore = await unreadOf(userToken)
      const operator = await accountPage(ADMIN)
      try {
        const op = operator.page
        await op.goto(`${baseUrl}/admin/reviews`)
        const table = op.getByRole('table', { name: A.caption })
        const row = table.getByRole('row').filter({ hasText: BODY })
        await pwExpect(row).toBeVisible()
        await pwExpect(
          row.getByText(A.reasonCount(A.reasons.SPAM, 1), { exact: true }),
        ).toBeVisible()

        // 답글 - 리뷰당 하나
        await row.getByRole('button', { name: new RegExp(`^${A.reply}: `) }).click()
        const replyDialog = op.getByRole('dialog', { name: REPLY.title })
        await replyDialog.getByLabel(new RegExp(`^${REPLY.body}`)).fill(REPLY_BODY)
        await replyDialog.getByRole('button', { name: REPLY.save }).click()
        await pwExpect(replyDialog).toBeHidden()
        await pwExpect(row.getByText(A.hasReply)).toBeVisible()

        // 숨기기 - 사유가 있어야 눌린다
        await row.getByRole('button', { name: new RegExp(`^${A.hide}: `) }).click()
        const hideDialog = op.getByRole('dialog', { name: HIDE.title })
        const submit = hideDialog.getByRole('button', { name: HIDE.submit, exact: true })
        await pwExpect(submit).toBeDisabled()
        await hideDialog.getByLabel(new RegExp(`^${HIDE.reason}`)).fill(HIDE_REASON)
        await submit.click()
        await pwExpect(hideDialog).toBeHidden()
        await pwExpect(row).toHaveCount(0) // 신고 큐에서 빠졌다

        // 「숨김」 큐에는 사유와 함께 있고 되살릴 수 있다
        await op.getByLabel(A.queueLabel).selectOption({ label: A.queues.hidden })
        const hidden = op
          .getByRole('table', { name: A.caption })
          .getByRole('row')
          .filter({ hasText: BODY })
        await pwExpect(hidden.getByText(A.hiddenReason(HIDE_REASON))).toBeVisible()
        await pwExpect(
          hidden.getByRole('button', { name: new RegExp(`^${A.restore}: `) }),
        ).toBeVisible()
      } finally {
        await operator.close()
      }

      // 작성자에게 숨김 알림이 간다
      await pwExpect
        .poll(() => unreadOf(userToken), { timeout: 60_000 })
        .toBeGreaterThan(unreadBefore)
      // 상품 화면에는 리뷰가 없다(평균도 사라진다)
      const reader = await accountPage(SECOND)
      try {
        await reader.page.goto(`${baseUrl}/products/basic`)
        await pwExpect(reader.page.getByText(L.summary.empty)).toBeVisible()
        await pwExpect(reviewItem(reader.page, BODY)).toHaveCount(0)
      } finally {
        await reader.close()
      }
      // 작성자는 자기 리뷰를 「숨겨짐 + 사유」로 본다 (아직 위의 첫 페이지가 user 로 로그인해 있다)
      await page.goto(`${baseUrl}/products/basic`)
      const mine = reviewItem(page, BODY)
      await pwExpect(mine.getByText(L.item.hiddenMine)).toBeVisible()
      await pwExpect(mine.getByText(L.item.hiddenReason(HIDE_REASON))).toBeVisible()
    },
  )
})
