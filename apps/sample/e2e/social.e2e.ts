import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { acceptLegalGate, auth, dismissConsent, launch } from './helpers'
import { waitForCode } from './mail'

/*
 * 글로벌 소셜 로그인(LINE · X) 여정 — 가짜 제공자(`fakeProviders.ts`, `E2E_FAKE_PROVIDERS=1` 로 올린 소셜 백엔드)를 브라우저로 끝까지:
 * 버튼은 `GET /auth/methods` 의 순서 · 제공자 → 인가 주소는 백엔드가 알려 준 것(authorize) + PKCE S256 challenge + nonce(LINE) → 콜백(state 확인) → 로그인 요청에
 * `codeVerifier` · `nonce` → 주소 없는 계정(설정에 주소 없음 · 로그인 수단 LINE) → 「이메일 추가」는 LINE 동의를 **다시** 거쳐(새 verifier) 새 주소로 인증번호 → 취소 · 다른 탭 · 뒤로 가기.
 * 가짜 제공자는 진짜처럼 엄격하다(PKCE 없으면 거절 · 코드 한 번 · redirect_uri 글자까지 일치). 가짜 제공자가 없으면(`fakeUrl` 빈 문자열) 통째로 건너뛴다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const stamp = Date.now()
const seen = new Set<string>()

let browser: Browser
let context: BrowserContext
let page: Page
beforeAll(async () => {
  ;({ browser, context, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

const control = (patch: unknown) =>
  fetch(`${fakeUrl}/control`, { method: 'POST', body: JSON.stringify(patch) })

const run = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!fakeUrl) return ctx.skip()
    await fn()
  })

/** 브라우저가 가는 X 인가 주소(진짜 https://x.com/…)는 테스트가 가짜 X 로 돌린다 — 쿼리는 그대로 */
async function routeX(on: BrowserContext) {
  await on.route('https://x.com/i/oauth2/authorize*', (route) => {
    const query = new URL(route.request().url()).search
    return route.fulfill({ status: 302, headers: { Location: `${fakeUrl}/x/authorize${query}` } })
  })
}

describe('sign-in buttons come from discovery', () => {
  run(
    'LINE and X are offered (with their marks), in the order the backend lists them',
    async () => {
      await routeX(context)
      await page.goto(`${baseUrl}/login`)
      await dismissConsent(page)
      const line = page.getByRole('button', { name: 'LINE으로 계속하기' })
      const x = page.getByRole('button', { name: 'X로 계속하기' })
      await pwExpect(line).toBeVisible()
      await pwExpect(x).toBeVisible()
      await pwExpect(line.locator('svg[data-provider="line"]')).toBeVisible()
      await pwExpect(x.locator('svg[data-provider="x"]')).toBeVisible()
      const methods = await (await fetch(`${apiUrl}/api/v1/auth/methods`)).json()
      const order = methods.value.social.map((s: { provider: string }) => s.provider)
      const shown = await page
        .getByRole('button', { name: /으로 계속하기$|로 계속하기$/ })
        .evaluateAll((els) => els.map((e) => e.textContent))
      const labelOf: Record<string, string> = {
        line: 'LINE으로 계속하기',
        x: 'X로 계속하기',
        google: 'Google로 계속하기',
      }
      pwExpect(shown).toEqual(order.map((p: string) => labelOf[p]).filter(Boolean))
    },
  )
})

describe('LINE: PKCE + nonce on the way out and back, an address-less account, adding an email through a second consent', () => {
  const lineEmail = `e2e-line-${stamp}@example.com`

  run(
    'the authorize request carries S256 challenge and nonce; the login request carries the verifier and nonce; the account has no address',
    async () => {
      await control({ line: { sub: `U-line-${stamp}`, name: 'LINE 사용자' }, deny: false })
      await page.goto(`${baseUrl}/login`)
      const authorize = page.waitForRequest((r) => r.url().startsWith(`${fakeUrl}/line/authorize`))
      const login = page.waitForRequest((r) => r.url().endsWith('/auth/social/line/login'))
      await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      const q = new URL((await authorize).url()).searchParams
      pwExpect(q.get('code_challenge_method')).toBe('S256')
      pwExpect(q.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
      pwExpect(q.get('nonce')).toBeTruthy()
      pwExpect(q.get('scope')).toBe('openid profile email')
      pwExpect(q.get('response_type')).toBe('code')
      pwExpect(q.get('redirect_uri')).toBe(`${baseUrl}/auth/callback`)
      const body = (await login).postDataJSON() as Record<string, string>
      pwExpect(body.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
      pwExpect(body.nonce).toBe(q.get('nonce'))
      pwExpect(body.redirectUri).toBe(q.get('redirect_uri')) // 인가 요청과 글자까지 같다
      await acceptLegalGate(page, apiUrl) // legal 모듈이 있는 백엔드: 소셜로 처음 들어오면 동의부터
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      // 인가 코드 · state 는 주소창에 남지 않는다
      pwExpect(page.url()).not.toContain('code=')
      // sessionStorage 의 state · verifier 는 한 번 쓰고 지워졌다
      pwExpect(
        await page.evaluate(() =>
          Object.keys(window.sessionStorage).filter((k) => k.startsWith('sample.social')),
        ),
      ).toEqual([])
    },
  )

  run(
    'settings of an address-less account: no empty email, LINE listed as the sign-in method',
    async () => {
      await page.goto(`${baseUrl}/account`)
      const email = page.getByRole('region', { name: auth.sectionEmail })
      await pwExpect(email.getByText(auth.emailNone)).toBeVisible()
      await pwExpect(email.getByText(auth.emailUnverified)).toHaveCount(0)
      const methods = page.getByRole('region', { name: auth.sectionMethods })
      await pwExpect(methods.getByText('LINE', { exact: true }).first()).toBeVisible()
    },
  )

  run(
    '"이메일 추가" re-consents with LINE (a NEW verifier), then the code mailed to the new address finishes it',
    async () => {
      const email = page.getByRole('region', { name: auth.sectionEmail })
      await email.getByLabel(auth.emailNew).fill(lineEmail)
      const authorize = page.waitForRequest((r) => r.url().startsWith(`${fakeUrl}/line/authorize`))
      await email.getByRole('button', { name: /LINE 로 확인/ }).click()
      const q = new URL((await authorize).url()).searchParams
      pwExpect(q.get('redirect_uri')).toBe(`${baseUrl}/account/link-callback`) // 연결 · 재인증 콜백은 따로 등록한다
      pwExpect(q.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
      const code = await waitForCode(mailUrl, lineEmail, 'email-change', { seen })
      await page.getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await pwExpect(
        page
          .getByRole('region', { name: auth.sectionEmail })
          .locator('strong')
          .filter({ hasText: lineEmail }),
      ).toBeVisible()
    },
  )

  run(
    'a second sign-in with the same LINE user lands in the same account (now with its address)',
    async () => {
      await page.evaluate(() => window.localStorage.clear())
      await page.goto(`${baseUrl}/login`)
      await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      await page.goto(`${baseUrl}/account`)
      await pwExpect(
        page
          .getByRole('region', { name: auth.sectionEmail })
          .locator('strong')
          .filter({ hasText: lineEmail }),
      ).toBeVisible()
    },
  )
})

describe('X: PKCE without a nonce, 30-second codes are exchanged at once', () => {
  run(
    'the authorize request has S256 and NO nonce; sign-in works and the account has no address',
    async () => {
      await page.evaluate(() => window.localStorage.clear())
      await control({ x: { id: `x-${stamp}`, username: 'x_user' }, deny: false })
      await page.goto(`${baseUrl}/login`)
      const authorize = page.waitForRequest((r) => r.url().startsWith(`${fakeUrl}/x/authorize`))
      const login = page.waitForRequest((r) => r.url().endsWith('/auth/social/x/login'))
      await page.getByRole('button', { name: 'X로 계속하기' }).click()
      const q = new URL((await authorize).url()).searchParams
      pwExpect(q.get('code_challenge_method')).toBe('S256')
      pwExpect(q.has('nonce')).toBe(false)
      pwExpect(q.get('scope')).toContain('users.read')
      const body = (await login).postDataJSON() as Record<string, string>
      pwExpect(body.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
      pwExpect('nonce' in body).toBe(false)
      await acceptLegalGate(page, apiUrl)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible() // 콜백이 끝나고 토큰이 저장될 때까지
      await page.goto(`${baseUrl}/account`)
      await pwExpect(
        page.getByRole('region', { name: auth.sectionEmail }).getByText(auth.emailNone),
      ).toBeVisible()
      await pwExpect(
        page
          .getByRole('region', { name: auth.sectionMethods })
          .getByText('X', { exact: true })
          .first(),
      ).toBeVisible()
    },
  )
})

describe('callback robustness', () => {
  run('the user cancels at the provider: "cancelled", nothing changed, a way back', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await control({ deny: true })
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
    await pwExpect(page.getByRole('heading', { name: auth.callbackCancelledTitle })).toBeVisible()
    await pwExpect(page.getByRole('link', { name: auth.backToSignIn })).toBeVisible()
    await control({ deny: false })
  })

  run(
    'a callback opened in a tab that did not start the sign-in explains the tab rule (no request is made)',
    async () => {
      const other = await context.newPage()
      let called = 0
      other.on('request', (r) => r.url().includes('/auth/social/') && called++)
      await other.goto(`${baseUrl}/auth/callback?code=whatever&state=not-from-this-tab`)
      await pwExpect(other.getByText(auth.callbackStateBody)).toBeVisible()
      pwExpect(called).toBe(0)
      await other.close()
    },
  )

  run(
    'back to the callback address after a successful sign-in goes on instead of showing an error',
    async () => {
      await page.evaluate(() => window.localStorage.clear())
      await page.goto(`${baseUrl}/login`)
      await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await acceptLegalGate(page, apiUrl)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      await page.goto(`${baseUrl}/auth/callback`)
      await pwExpect(page.getByRole('heading', { name: auth.callbackFailedTitle })).toHaveCount(0)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    },
  )
})
