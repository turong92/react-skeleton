import { expect as pwExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { auth, dismissConsent, fillSignIn, ko, launch } from './helpers'
import { waitForLink } from './mail'

/*
 * 계정 수명주기 여정 — 가입(정책 힌트) → 메일 확인 → 인증 전 로그인 거절 → 메일 링크로 인증 → 로그인 → 액세스 토큰이 깨져도 갱신으로 이어짐(회전) →
 * 비밀번호 변경 → 다른 기기 세션 보기 · 끊기 → 링크 로그인(매직링크) → 운영자 표 → 계정 삭제 → 삭제된 계정은 로그인 불가.
 * 진짜 백엔드 · 진짜 브라우저 · 진짜 메일(mailpit). 한 흐름이라 단계가 앞 단계의 결과에 기댄다.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')

const stamp = Date.now()
const email = `e2e-${stamp}@example.com`
const password = 'Correct-horse-9'
const nextPassword = 'Another-pass-2026'
const seen = new Set<string>()

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

const heading = (name: string | RegExp, level = 1) => page.getByRole('heading', { level, name })
const region = (name: string) => page.getByRole('region', { name })
const token = (key: string) => page.evaluate((k) => window.localStorage.getItem(k), key)

describe('account lifecycle against the real backend', () => {
  it('sign-up shows the password policy hints, then asks to check the email', async () => {
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(email)
    await page.getByLabel(auth.password).first().fill('abc')
    // 서버 정책(`GET /account/password/policy`)에서 읽은 규칙이 미충족으로 보인다
    await pwExpect(page.getByText(auth.passwordRule.TOO_SHORT)).toBeVisible()
    await pwExpect(
      page.getByRole('img', { name: new RegExp(auth.passwordStrength[1]) }),
    ).toBeVisible()
    await page.getByLabel(auth.password).first().fill(password)
    await pwExpect(
      page.getByRole('img', { name: new RegExp(auth.passwordStrength[4]) }),
    ).toBeVisible()
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(heading(auth.checkEmailTitle, 2)).toBeVisible()
    await pwExpect(page.getByText(email)).toBeVisible()
  })

  it('an unverified address cannot sign in and is offered a new verification mail', async () => {
    await page.goto(`${baseUrl}/login`)
    await fillSignIn(page, { email, password })
    await pwExpect(page.getByRole('alert')).toContainText(auth.errorEmailNotVerified)
    await pwExpect(page.getByRole('button', { name: auth.signInResendVerification })).toBeVisible()
  })

  it('the mailed link verifies the address (one POST on mount), a second visit says the link is used up', async () => {
    const link = await waitForLink(mailUrl, email, 'verify-email', { seen })
    await page.goto(`${baseUrl}${link.path}`)
    await pwExpect(page.getByText(auth.verifyEmailDone)).toBeVisible()
    await page.goto(`${baseUrl}${link.path}`) // 같은 링크를 다시 — 한 번만 쓸 수 있다
    await pwExpect(heading(auth.verifyEmailInvalidTitle)).toBeVisible()
  })

  it('signs in and lands on the dashboard; the tokens are stored', async () => {
    await page.goto(`${baseUrl}/login`)
    await fillSignIn(page, { email, password })
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
    pwExpect(await token('skeleton.accessToken')).toBeTruthy()
    pwExpect(await token('skeleton.refresh')).toContain('refreshToken')
  })

  it('a broken access token is replaced silently: the request is retried after one refresh and the refresh token rotates', async () => {
    const before = JSON.parse((await token('skeleton.refresh')) ?? '{}').refreshToken as string
    await page.evaluate(() =>
      window.localStorage.setItem('skeleton.accessToken', 'header.e30.expired'),
    )
    const refreshCalls: string[] = []
    page.on(
      'request',
      (r) => r.url().includes('/api/v1/auth/refresh') && refreshCalls.push(r.url()),
    )
    const refreshed = page.waitForResponse((r) => r.url().includes('/api/v1/auth/refresh'))
    await page.goto(`${baseUrl}/notes`)
    await refreshed // 화면은 갱신보다 먼저 그려진다 — 갱신 응답이 와서 저장될 때까지 기다린다(그 전에 이동하면 회전한 토큰을 잃는다)
    await page.waitForFunction(
      (before) => !window.localStorage.getItem('skeleton.refresh')?.includes(before),
      before,
    )
    await pwExpect(heading(ko('notes.title'))).toBeVisible()
    const after = JSON.parse((await token('skeleton.refresh')) ?? '{}').refreshToken as string
    pwExpect(after).not.toBe(before) // 회전
    pwExpect(await token('skeleton.accessToken')).not.toBe('header.e30.expired')
    pwExpect(refreshCalls).toHaveLength(1) // 여러 요청이 동시에 401 이어도 갱신은 한 번
    page.removeAllListeners('request')
  })

  it('account settings: a wrong current password is refused, the right one changes it', async () => {
    await page.goto(`${baseUrl}/account`)
    const section = region(auth.sectionPassword)
    await section.getByLabel(auth.currentPassword).fill('wrong-password-1')
    await section.getByLabel(auth.newPassword).fill(nextPassword)
    await section.getByRole('button', { name: auth.passwordChangeSubmit }).click()
    await pwExpect(section.getByText(auth.errorCurrentPassword)).toBeVisible()
    await section.getByLabel(auth.currentPassword).fill(password)
    await section.getByRole('button', { name: auth.passwordChangeSubmit }).click()
    await pwExpect(section.getByText(auth.passwordChanged)).toBeVisible()
  })

  it('sessions: another device shows up, and signing it out removes it', async () => {
    const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Name': 'Second device' },
      body: JSON.stringify({ email, password: nextPassword }),
    })
    pwExpect(login.status).toBe(200)
    await page.reload()
    const section = region(auth.sectionSessions)
    await pwExpect(section.getByText('Second device')).toBeVisible()
    await pwExpect(section.getByText(auth.sessionsCurrent)).toBeVisible()
    await section.getByRole('button', { name: auth.sessionsRevoke, exact: true }).first().click()
    await pwExpect(section.getByText('Second device')).toHaveCount(0)
  })

  it('profile: language and time zone are saved to the account', async () => {
    const section = region(auth.sectionProfile)
    await section.getByLabel(auth.displayName).fill('E2E 사용자')
    await section.getByLabel(auth.profileTimeZone).selectOption('Asia/Seoul')
    await section.getByRole('button', { name: auth.save }).click()
    await pwExpect(section.getByText(auth.profileSaved)).toBeVisible()
  })

  it('delete: password re-authentication, then a typed confirmation; afterwards the account cannot sign in', async () => {
    const section = region(auth.sectionDelete)
    await pwExpect(section.getByText(/30/)).toBeVisible() // 유예 기간 안내
    await section.getByLabel(auth.currentPassword).fill(nextPassword)
    await section.getByRole('button', { name: auth.deleteButton }).click()
    const dialog = page.getByRole('dialog')
    const confirm = dialog.getByRole('button', { name: auth.deleteConfirm })
    await pwExpect(confirm).toBeDisabled()
    await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
    await confirm.click()
    await pwExpect(heading(auth.signInTitle)).toBeVisible() // 삭제되면 이 기기도 로그아웃
    await fillSignIn(page, { email, password: nextPassword })
    await pwExpect(page.getByRole('alert')).toContainText(auth.errorInvalidCredentials)
  })
})

describe('sign in with an email link (magic link)', () => {
  const linkEmail = `e2e-link-${stamp}@example.com`
  it('requests a link, opens it from the mail and is signed in — without any password', async () => {
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: auth.signInMagicLink }).click()
    await pwExpect(page.getByLabel(auth.password)).toHaveCount(0)
    await page.getByLabel(auth.email).fill(linkEmail)
    await page.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
    await pwExpect(heading(auth.magicLinkSentTitle, 2)).toBeVisible()
    const link = await waitForLink(mailUrl, linkEmail, 'magic-link', { seen })
    await page.goto(`${baseUrl}${link.path}`)
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
  })
})

describe('operator tools (opt-in @skeleton/auth/admin)', () => {
  it('an administrator sees the accounts table; a normal user gets the blocked notice, not a sign-out', async () => {
    await page
      .getByRole('button', { name: ko('header.signOut') })
      .first()
      .click()
    await page.goto(`${baseUrl}/login`)
    await fillSignIn(page, { email: 'user@example.com', password: 'password' })
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
    await page.goto(`${baseUrl}/admin/accounts`)
    await pwExpect(heading(auth.blockedTitle)).toBeVisible()
    await page
      .getByRole('button', { name: ko('header.signOut') })
      .first()
      .click()
    await page.goto(`${baseUrl}/login`)
    await fillSignIn(page, { email: 'admin@example.com', password: 'password' })
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
    await page.goto(`${baseUrl}/admin/accounts`)
    await pwExpect(page.getByRole('table', { name: auth.adminCaption })).toBeVisible()
    await pwExpect(page.getByText('user@example.com')).toBeVisible()
    await page.getByLabel(auth.adminSearch).fill(email)
    await pwExpect(page.getByText(email)).toBeVisible()
    await pwExpect(page.getByText(auth.adminStatus.DELETED)).toBeVisible()
  })
})
