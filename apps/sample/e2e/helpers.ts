import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { koAuthLabels } from '@skeleton/auth'
import { i18n, type MessageKey } from '../src/i18n'

/** 인증 화면 문구(한국어) — 패키지의 사전이라 앱 사전이 아니다 */
export const auth = koAuthLabels

/** 화면 문구(한국어) — 브라우저가 `ko-KR` 로 뜨므로 앱이 한국어로 그린다. 어느 문구를 찾는지 사전의 키로 읽힌다 */
export const ko = (key: MessageKey, values?: Record<string, string | number>) =>
  i18n.tIn('ko', key, values)

export const DEMO = { email: 'user@example.com', password: 'password' }

export async function launch(
  options: { recordVideoDir?: string; colorScheme?: 'light' | 'dark' } = {},
) {
  const browser: Browser = await chromium.launch()
  const context: BrowserContext = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
    colorScheme: options.colorScheme ?? 'light',
    ...(options.recordVideoDir
      ? { recordVideo: { dir: options.recordVideoDir, size: { width: 1280, height: 800 } } }
      : {}),
  })
  context.setDefaultTimeout(15_000)
  const page: Page = await context.newPage()
  return { browser, context, page }
}

/** 동의 배너가 떠 있으면 「모두 거부」 — 새 브라우저의 첫 방문은 배너가 화면 아래를 덮어 클릭을 가로챈다(사람도 한 번은 답해야 한다) */
export async function dismissConsent(page: Page) {
  const reject = page.getByRole('button', { name: ko('consent.rejectAll') })
  if (await reject.isVisible()) await reject.click()
}

/** 화면 로그인 — 랜딩(`/`)에서 헤더의 「로그인」 링크로 들어가 이메일 · 비밀번호를 입력(기본: 시드 체험 계정) */
export async function signIn(page: Page, baseUrl: string, account = DEMO) {
  await page.goto(baseUrl)
  await dismissConsent(page)
  await page.getByRole('link', { name: ko('header.signIn'), exact: true }).click()
  await fillSignIn(page, account)
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}

export async function fillSignIn(page: Page, account: { email: string; password: string }) {
  await page.getByLabel(auth.email).fill(account.email)
  await page.getByLabel(auth.password, { exact: false }).first().fill(account.password)
  await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
}

type SeedNote = {
  title: string
  body?: string
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  pinned?: boolean
}

/** 시드용 — 화면을 거치지 않고 API 로 노트를 만든다(로그인 → 토큰 → POST /notes) */
export async function seedNotes(apiUrl: string, notes: SeedNote[]) {
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO),
  })
  const { value } = (await login.json()) as { value: { accessToken: string } }
  const created: Array<{ id: string; title: string }> = []
  for (const [index, note] of notes.entries()) {
    const response = await fetch(`${apiUrl}/api/v1/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${value.accessToken}`,
        'Idempotency-Key': `e2e-${Date.now()}-${index}`,
      },
      body: JSON.stringify({ body: '', ...note }),
    })
    if (response.status !== 201)
      throw new Error(`seed failed: ${response.status} ${await response.text()}`)
    created.push((await response.json()).value)
  }
  return created
}
