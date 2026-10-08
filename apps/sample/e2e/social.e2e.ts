import { expect as baseExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { acceptLegalGate, agreeToLegal, auth, dismissConsent, fillSignIn, launch } from './helpers'
import { signOut } from './boardSteps'
import { waitForCode } from './mail'

/*
 * 글로벌 소셜 로그인(LINE · X) 여정 — 가짜 제공자(`fakeProviders.ts`, 기본으로 올라오는 소셜 백엔드)를 브라우저로 끝까지:
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

/*
 * 같은 이메일로 메일 가입한 계정이 있는데 그 이메일을 가진 소셜 사용자가 처음 로그인한다 — 자동으로 합치지 않는다(`409 ACCOUNT.SOCIAL_EMAIL_CONFLICT`).
 * 백엔드가 그 제공자의 이메일을 믿는 구성일 때만 일어난다 — e2e 백엔드는 가짜 LINE 의 `email_verified` 클레임을 믿도록(`email-trust: CLAIM`, 이 실행에서만) 올라가고,
 * 가짜 LINE 은 주소를 주는 사용자의 주소를 확인된 것으로 내보낸다. 끝까지: 메일 가입 → 같은 메일로 소셜 로그인(안내) → 로그인하러 가기 → 설정의 「연결을 이어서」 →
 * 연결(본인 확인: 현재 비밀번호) → 로그아웃 → 소셜로 로그인 → 홈. 가짜 제공자를 끄면(`E2E_FAKE_PROVIDERS=0`) 건너뛴다.
 */
describe('a social sign-in with the email of an existing account is guided, not merged', () => {
  const mail = `e2e-merge-${stamp}@example.com`
  const mailPassword = 'Passw0rd!x9'
  const account = { email: mail, password: mailPassword }

  run('a mail sign-up account exists (signed in at the end of the sign-up)', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(mail)
    await page.getByLabel(auth.displayName).fill('병합 시험')
    await page.getByLabel(auth.password).first().fill(mailPassword)
    await page.getByLabel(auth.passwordConfirm).fill(mailPassword)
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    const code = await waitForCode(mailUrl, mail, 'verify', { seen })
    await page.getByLabel(auth.codeDigit(1, 6)).click()
    await page.keyboard.type(code.code)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await signOut(page)
  })

  run('the same address through LINE shows the guide - no account is made or merged', async () => {
    await control({
      line: { sub: `U-conflict-${stamp}`, name: '충돌 사용자', email: mail },
      deny: false,
    })
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
    await pwExpect(page.getByRole('heading', { name: auth.callbackConflictTitle })).toBeVisible()
    await pwExpect(page.getByText(auth.callbackConflictBody('LINE'))).toBeVisible()
    await pwExpect(page.getByRole('button', { name: auth.callbackConflictHome })).toBeVisible()
    await pwExpect(page.getByRole('heading', { name: auth.callbackFailedTitle })).toHaveCount(0)
  })

  run('"로그인하러 가기" → sign in the old way → settings continues the LINE link', async () => {
    await page.getByRole('button', { name: auth.callbackConflictSignIn }).click()
    // 로그인 화면의 이메일 칸은 비어 있다(콜백이 이메일을 주지 않는다)
    await pwExpect(page.getByLabel(auth.email)).toHaveValue('')
    await fillSignIn(page, account)
    await acceptLegalGate(page, apiUrl)
    await pwExpect(page).toHaveURL(/\/account#methods$/)
    await pwExpect(page.getByText(auth.methodLinkContinue('LINE'))).toBeVisible()
    await pwExpect(page.getByRole('button', { name: auth.methodLink('LINE') })).toBeFocused()
  })

  run(
    'linking asks for the current password (proof) and ends in the settings with LINE linked',
    async () => {
      await page.getByRole('button', { name: auth.methodLink('LINE') }).click()
      await pwExpect(page.getByRole('heading', { name: auth.reauthTitle })).toBeVisible()
      await page.getByLabel(auth.currentPassword).fill(mailPassword)
      await page.getByRole('button', { name: auth.methodLink('LINE') }).click()
      await pwExpect(page.getByText(auth.methodLinkedNotice('LINE'))).toBeVisible()
      await pwExpect(page).toHaveURL(/\/account$/)
      // 보호된 화면(/account)에서 로그아웃하면 로그인 뒤 그 화면으로 돌아오는 것이 제품 동작이다(가려던 곳) — 홈에서 로그아웃해야 다음 로그인이 홈으로 끝난다
      await page.goto(baseUrl)
      await signOut(page)
    },
  )

  run('now the same LINE sign-in succeeds into the same account and ends at the home', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
    await acceptLegalGate(page, apiUrl)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await pwExpect(page.getByRole('heading', { name: auth.callbackFailedTitle })).toHaveCount(0)
    pwExpect(new URL(page.url()).pathname).toBe('/')
    // 로그인 수단에 메일(비밀번호)과 LINE 이 함께 있다 — 새 계정이 아니라 같은 계정
    await page.goto(`${baseUrl}/account`)
    const methods = page.getByRole('region', { name: auth.sectionMethods })
    await pwExpect(methods.getByText('LINE', { exact: true }).first()).toBeVisible()
    await pwExpect(
      page.getByRole('region', { name: auth.sectionEmail }).getByText(mail),
    ).toBeVisible()
    await control({ deny: false })
  })
})
