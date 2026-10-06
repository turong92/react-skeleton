import { inject } from 'vitest'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { koAuthLabels } from '@skeleton/auth'
import { koLegalLabels } from '@skeleton/legal'
import { i18n, type MessageKey } from '../src/i18n'

/** 인증 화면 문구(한국어) — 패키지의 사전이라 앱 사전이 아니다 */
export const auth = koAuthLabels

/** 약관 동의 문구(한국어) — `@skeleton/legal` 의 사전 */
export const legal = koLegalLabels

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

/**
 * 시드 계정(가입 화면을 거치지 않은 체험 · 운영자 계정)은 동의 기록이 없다 — legal 모듈이 있는 백엔드에서는 화면 로그인 직후 동의 화면이 막는다.
 * 그 여정을 시험하는 것이 아닌 곳에서는 API 로 먼저 동의해 둔다(없는 백엔드에서는 아무 일도 하지 않는다)
 */
async function consentViaApi(account: { email: string; password: string }) {
  const apiUrl = inject('apiUrl')
  if (!(await legalOn(apiUrl))) return
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  if (!login.ok) return // 틀린 비밀번호를 시험하는 곳
  const token = (await login.json()).value.accessToken as string
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const mine = (await (await fetch(`${apiUrl}/api/v1/legal/consents/me`, { headers })).json()).value
  if (!mine.blocked) return
  await fetch(`${apiUrl}/api/v1/legal/consents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      consents: mine.missing.map((m: { type: string; version: string }) => ({
        type: m.type,
        version: m.version,
      })),
      source: 'consent',
    }),
  })
}

export async function fillSignIn(page: Page, account: { email: string; password: string }) {
  await consentViaApi(account)
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

let legalProbe: Promise<boolean> | undefined
/** 이 백엔드에 legal 모듈(`GET /legal/documents`)이 있는가 — 한 번만 묻는다. 없으면 약관 화면 · 동의 단계는 일어나지 않는다(출시된 백엔드) */
export function legalOn(apiUrl: string): Promise<boolean> {
  legalProbe ??= fetch(`${apiUrl}/api/v1/legal/documents`).then(
    (response) => response.ok,
    () => false,
  )
  return legalProbe
}

/** 가입 폼: 약관 체크리스트가 있으면 「전체 동의」 — legal 모듈이 없는 백엔드에서는 아무 일도 하지 않는다 */
export async function agreeToLegal(page: Page, apiUrl: string) {
  if (!(await legalOn(apiUrl))) return
  const all = page.getByRole('checkbox', { name: legal.agreeAll })
  await all.waitFor()
  await all.check()
}

/** 링크 · 소셜로 처음 들어온 계정은 동의가 없어 동의 화면이 앞을 막는다 — 있으면 모두 동의하고 이어 간다(legal 모듈이 없으면 아무 일도 하지 않는다) */
export async function acceptLegalGate(page: Page, apiUrl: string) {
  if (!(await legalOn(apiUrl))) return
  const gate = page.getByRole('dialog', {
    name: new RegExp(`${legal.reconsentTitle}|${legal.firstConsentTitle}`),
  })
  try {
    await gate.waitFor({ timeout: 10_000 })
  } catch {
    return // 이미 동의한 계정
  }
  await gate.getByRole('checkbox', { name: legal.agreeAll }).check()
  await gate.getByRole('button', { name: legal.reconsentSubmit }).click()
  await gate.waitFor({ state: 'detached' })
}
