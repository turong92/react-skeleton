import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { koPaymentLabels } from '@skeleton/payment'
import { consentViaApi, DEMO, ko, signIn } from './helpers'

/*
 * 결제 여정(payment.e2e.ts · paymentAdmin.e2e.ts)이 쓰는 단계 — 화면에서 사람이 하는 일(사용자의 응원 · 환불 요청, 운영자의 환불 · 거절 · 맞추기)은 화면으로, 사람이 아닌 일(시드 · 서버 상태 확인)은 API 로.
 * 화면 문구는 사전(`ko`)과 패키지의 한국어 문구(`koPaymentLabels`)에서 읽는다 — 문구를 고치면 시험이 따라온다.
 */

const pwExpect = baseExpect.configure({ timeout: 20_000 })

export const ADMIN = { email: 'admin@example.com', password: 'password' }
export const labels = koPaymentLabels

/** 화면의 금액 표기 — `3,000원` */
export const won = (amount: number) => `${amount.toLocaleString('en-US')}원`

type Account = { email: string; password: string }
export type ApiAnswer = { status: number; json: any } // eslint-disable-line @typescript-eslint/no-explicit-any -- 서버 응답을 시험이 읽는 자리 — 모양은 각 단정이 본다

export async function tokenOf(apiUrl: string, account: Account = DEMO): Promise<string> {
  await consentViaApi(account)
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  if (!login.ok) throw new Error(`login ${account.email} → ${login.status}`)
  return ((await login.json()) as { value: { accessToken: string } }).value.accessToken
}

/** `/api/v1` 아래 한 번 부른다. 본문이 JSON 이 아니면(204) `json` 은 `null` */
export async function api(
  apiUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<ApiAnswer> {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  return { status: response.status, json: text ? JSON.parse(text) : null }
}

/**
 * 이 경로가 이 백엔드에 있는가. **404 만 「없다」** — 로그인 실패 · 500 · 403 · 연결 실패는 던진다(깨진 응원 API 가 시나리오를 조용히 건너뛰어 초록이 되지 않게).
 */
async function routeExists(apiUrl: string, account: Account, path: string): Promise<boolean> {
  const answer = await api(apiUrl, await tokenOf(apiUrl, account), 'GET', path)
  if (answer.status === 200) return true
  if (answer.status === 404) return false
  throw new Error(`GET ${path} → ${answer.status} (404 would mean "this backend does not have it")`)
}

let probe: Promise<boolean> | undefined
/** 이 백엔드에 응원하기(`payment-jdbc` + 샘플의 `cheer/`)가 있는가 — 한 번만 묻는다. 없으면(404) 결제 시나리오는 건너뛴다(결제 없는 백엔드). 그 밖의 실패는 던진다 */
export function paymentOn(apiUrl: string): Promise<boolean> {
  probe ??= routeExists(apiUrl, DEMO, '/cheers/options')
  return probe
}

/**
 * 한 페이지에 한 번만 화면 로그인 — 한 파일의 시나리오들이 같은 페이지를 쓰는데 `signIn` 은 로그아웃 상태의 헤더 「로그인」 링크를 누른다.
 * 앞 시나리오가 남긴 로그인 때문에 둘째부터는 그 링크가 없어 던진다. 던진 로그인은 기억하지 않는다(다음 시나리오가 다시 해 본다)
 */
const signedIn = new WeakSet<Page>()
export async function ensureSignedIn(page: Page, baseUrl: string) {
  if (signedIn.has(page)) return
  await signIn(page, baseUrl)
  signedIn.add(page)
}

/** 서버가 정한 응원 금액 목록(`GET /cheers/options`) */
export async function cheerOptions(apiUrl: string, token: string) {
  const answer = await api(apiUrl, token, 'GET', '/cheers/options')
  if (answer.status !== 200) throw new Error(`GET /cheers/options → ${answer.status}`)
  return answer.json.values as Array<{ itemRef: string; amount: { amount: number } }>
}

/** 화면에서: 응원하기로 가서 금액을 고르고 「응원하기」를 누른다. 결제창(가짜)이 곧 돌려보낸다 */
export async function cheerFor(page: Page, baseUrl: string, amount: number) {
  await page.goto(`${baseUrl}/cheer`)
  await pwExpect(page.getByRole('heading', { level: 1, name: ko('cheer.title') })).toBeVisible()
  const choice = page.getByRole('radio', { name: won(amount) })
  await choice.click()
  await pwExpect(choice).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: ko('cheer.submit'), exact: true }).click()
}

/**
 * 안 고른 금액 칸에 손을 올리면 테두리 · 바탕이 달라진다 — 스토리가 못 보는 것(계산된 스타일)을 실제 브라우저에서 한 번 본다.
 * 응원하기 화면이 열려 있어야 한다. 아무것도 고르지 않은 칸 하나에 올렸다 뗀다.
 */
export async function choiceShowsHover(page: Page) {
  const choice = page.getByRole('radio').first()
  await pwExpect(choice).toHaveAttribute('aria-checked', 'false')
  const look = () =>
    choice.evaluate((el) => {
      const style = getComputedStyle(el)
      return { border: style.borderTopColor, background: style.backgroundColor }
    })
  await page.mouse.move(0, 0)
  const resting = await look()
  await choice.hover()
  await pwExpect.poll(look).not.toEqual(resting)
  await page.mouse.move(0, 0)
  await pwExpect.poll(look).toEqual(resting)
}

/** 결제창이 돌려보낸 주소(`/payments/return?…`)에서 주문 id 를 읽는다 */
export async function returnedOrderId(page: Page): Promise<string> {
  await page.waitForURL(/\/payments\/return\?/)
  const orderId = new URL(page.url()).searchParams.get('orderId')
  if (!orderId) throw new Error(`no orderId in ${page.url()}`)
  return orderId
}

/** 결과 화면의 제목(h2) */
export const resultTitle = (page: Page, title: string) =>
  page.getByRole('heading', { level: 2, name: title })

let adminProbe: Promise<boolean> | undefined
/** 이 백엔드가 운영자 결제 경로(`skeleton.payment.admin.enabled`)를 여는가 — 한 번만 묻는다. 닫혀 있으면(404) 운영자 화면 시나리오는 건너뛴다. 그 밖의 실패는 던진다 */
export function adminPaymentsOn(apiUrl: string): Promise<boolean> {
  adminProbe ??= routeExists(apiUrl, ADMIN, '/admin/payments/refunds?status=REQUESTED')
  return adminProbe
}

/**
 * 운영자가 따로 로그인한 화면 — 사용자의 로그인과 섞이지 않게 새 브라우저 컨텍스트(로그인은 브라우저 저장소에 산다).
 * 쓴 뒤 `close()` 로 닫는다.
 */
export async function operatorPage(browser: Browser, baseUrl: string) {
  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
  })
  context.setDefaultTimeout(15_000)
  const page = await context.newPage()
  await signIn(page, baseUrl, ADMIN)
  return { page, close: () => context.close() }
}

/** 화면에서(사용자): 이 결제의 「환불 요청」 → 확인 창 → 「환불 요청함」. 돈은 안 움직인다 */
export async function askForRefund(page: Page, baseUrl: string, orderId: string) {
  await page.goto(`${baseUrl}/payments/${orderId}`)
  await page.getByRole('button', { name: labels.summary.requestRefund, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: labels.refundDialog.confirm }).click()
  await pwExpect(dialog).toBeHidden()
  await pwExpect(page.getByText(labels.refundStatus.REQUESTED).first()).toBeVisible()
}

/** 운영자 화면의 환불 요청 탭에서 이 결제의 요청 줄 */
export function refundRequestRow(page: Page, orderId: string) {
  return page
    .getByRole('table', { name: labels.admin.requests.caption })
    .getByRole('row')
    .filter({ hasText: orderId })
}

const startingWith = (text: string) => new RegExp(`^${text}`)

/**
 * 화면에서(운영자): 환불 요청 탭 → 이 결제의 「요청대로 환불하기」 → 확인 창의 「환불하기」 → 줄이 사라진다.
 * (돈이 나가는 단추는 확인 창을 거친다 — 창을 건너뛰는 길은 없다)
 */
export async function operatorRefundsRequest(page: Page, baseUrl: string, orderId: string) {
  await page.goto(`${baseUrl}/admin/payments?tab=refunds`)
  const row = refundRequestRow(page, orderId)
  await row.getByRole('button', { name: startingWith(labels.admin.panel.approve) }).click()
  const dialog = page.getByRole('dialog', { name: labels.admin.refundDialog.approve.title })
  await dialog.getByRole('button', { name: labels.admin.refundDialog.confirm, exact: true }).click()
  await pwExpect(dialog).toBeHidden()
  await pwExpect(row).toHaveCount(0)
}

/** 화면에서(운영자): 환불 요청 탭 → 이 결제의 「요청 거절하기」 → 확인 창의 「거절하기」 → 줄이 사라진다 */
export async function operatorRejectsRequest(page: Page, baseUrl: string, orderId: string) {
  await page.goto(`${baseUrl}/admin/payments?tab=refunds`)
  const row = refundRequestRow(page, orderId)
  await row.getByRole('button', { name: startingWith(labels.admin.panel.reject) }).click()
  const dialog = page.getByRole('dialog', { name: labels.admin.refundDialog.reject.title })
  await dialog
    .getByRole('button', { name: labels.admin.refundDialog.reject.confirm, exact: true })
    .click()
  await pwExpect(dialog).toBeHidden()
  await pwExpect(row).toHaveCount(0)
}

/** 화면에서(운영자): 전체 탭에서 결제 번호로 찾아 「자세히」로 한 건 화면에 간다 */
export async function operatorOpensPayment(page: Page, baseUrl: string, orderId: string) {
  await page.goto(`${baseUrl}/admin/payments`)
  await page.getByLabel(labels.admin.orders.search, { exact: true }).fill(orderId)
  await page.getByRole('button', { name: labels.admin.orders.searchSubmit, exact: true }).click()
  const row = page
    .getByRole('table', { name: labels.admin.orders.caption })
    .getByRole('row')
    .filter({ hasText: orderId })
  await row.getByRole('link', { name: startingWith(labels.admin.orders.details) }).click()
  await page.waitForURL(new RegExp(`/admin/payments/${orderId}$`))
  await pwExpect(
    page.getByRole('heading', { level: 1, name: ko('admin.payments.detailTitle') }),
  ).toBeVisible()
}
