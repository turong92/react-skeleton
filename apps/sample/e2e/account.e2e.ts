import {
  expect as pwExpect,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { auth, dismissConsent, fillSignIn, ko, launch } from './helpers'
import { waitForLink } from './mail'

/*
 * 계정 수명주기 여정 (계약 FINAL-2) — 로그인 방법은 백엔드(`GET /auth/methods`)에서 알아낸다 → 가입(정책 힌트) → 메일 확인 → 인증 전 로그인 거절 → 메일 링크로 인증 →
 * 로그인 → 갱신 도중 페이지가 이동해도(응답을 잃어도) 세션이 이어짐(유예 안의 멱등 회전) → 액세스 토큰이 깨져도 갱신으로 이어짐(회전) → 비밀번호 변경 →
 * 이메일 변경(새로고침 뒤에도 서버가 말해 주는 「확인 대기」) → 새 주소의 링크로 확정(모든 세션 종료) → 다른 기기 세션 보기 · 끊기 →
 * 비밀번호 없는 계정(링크 로그인): 이메일 변경 · 첫 비밀번호가 본인 확인 메일의 링크를 거친다(다른 기기에서 열면 안내 · 같은 브라우저의 새 탭이면 하려던 탭이 이어 간다) →
 * 계정 삭제 → 운영자 표. 진짜 백엔드 · 진짜 브라우저 · 진짜 메일(mailpit). 한 흐름이라 단계가 앞 단계의 결과에 기댄다.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')

const stamp = Date.now()
const email = `e2e-${stamp}@example.com`
const emailNext = `e2e-next-${stamp}@example.com`
const password = 'Correct-horse-9'
const nextPassword = 'Another-pass-2026'
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

const heading = (name: string | RegExp, level = 1) => page.getByRole('heading', { level, name })
const region = (name: string, on: Page = page) => on.getByRole('region', { name })
const token = (key: string) => page.evaluate((k) => window.localStorage.getItem(k), key)
const refreshToken = async () =>
  JSON.parse((await token('skeleton.refresh')) ?? '{}').refreshToken as string

describe('sign-in methods are discovered from the backend', () => {
  it('the login page asks GET /auth/methods; until the answer arrives it shows a loading state, never the wrong methods', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => (release = resolve))
    const asked: string[] = []
    await page.route('**/api/v1/auth/methods', async (route) => {
      asked.push(route.request().url())
      await gate // 답을 붙잡아 둔다
      await route.continue()
    })
    await page.goto(`${baseUrl}/login`)
    await dismissConsent(page)
    await pwExpect(page.getByText(auth.methodsLoading)).toBeAttached()
    await pwExpect(page.getByLabel(auth.password)).toHaveCount(0) // 환경변수 기본값 같은 것을 깜박이지 않는다
    await pwExpect(page.getByRole('button', { name: auth.signInMagicLink })).toHaveCount(0)
    release()
    // 샘플 백엔드는 비밀번호 + 이메일 링크(소셜 제공자 없음)
    await pwExpect(page.getByLabel(auth.password).first()).toBeVisible()
    await pwExpect(page.getByRole('button', { name: auth.signInMagicLink })).toBeVisible()
    await pwExpect(page.getByRole('button', { name: /Google|구글/ })).toHaveCount(0)
    pwExpect(asked).toHaveLength(1)
    await page.unroute('**/api/v1/auth/methods')
  })

  it('when the answer cannot be had, a default is shown with a retry — and the retry finds the real methods', async () => {
    await page.route('**/api/v1/auth/methods', (route) => route.abort('failed'))
    await page.goto(`${baseUrl}/sign-up`)
    await page.goto(`${baseUrl}/login`)
    await pwExpect(page.getByText(auth.methodsFailed)).toBeVisible()
    await pwExpect(page.getByLabel(auth.password).first()).toBeVisible() // 기본: 비밀번호만
    await pwExpect(page.getByRole('button', { name: auth.signInMagicLink })).toHaveCount(0)
    await page.unroute('**/api/v1/auth/methods')
    await page.getByRole('button', { name: auth.methodsRetry }).click()
    await pwExpect(page.getByRole('button', { name: auth.signInMagicLink })).toBeVisible()
    await pwExpect(page.getByText(auth.methodsFailed)).toHaveCount(0)
  })
})

describe('account lifecycle against the real backend', () => {
  it('sign-up shows the password policy hints, then asks to check the email', async () => {
    await page.goto(`${baseUrl}/sign-up`)
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

  it('navigation during a refresh: the response is lost, the next page presents the previous token within the 10 s grace and the session carries on', async () => {
    const before = await refreshToken()
    await page.evaluate(() =>
      window.localStorage.setItem('skeleton.accessToken', 'header.e30.expired'),
    )
    const presented: string[] = []
    page.on('request', (r) => {
      if (r.url().includes('/api/v1/auth/refresh')) presented.push(r.postData() ?? '')
    })
    // 갱신 요청이 서버에 닿아 회전하게 두되 응답은 붙잡는다 — 그 사이 페이지가 떠난다
    let held: Route | undefined
    await page.route('**/api/v1/auth/refresh', async (route) => {
      if (held) return route.continue()
      await route.fetch() // 서버는 회전했다 …
      held = route
    })
    await page.goto(`${baseUrl}/notes`)
    await pwExpect.poll(() => held !== undefined).toBe(true)
    await page.goto(`${baseUrl}/account`) // … 응답이 닿기 전에 페이지가 떠났다(진짜 이동)
    await held?.abort().catch(() => undefined)
    await page.unroute('**/api/v1/auth/refresh')
    // 이동한 페이지가 같은(옛) 리프레시 토큰으로 다시 갱신 — 유예 안이라 같은 후속 토큰을 받는다
    await pwExpect(heading(auth.settingsTitle)).toBeVisible()
    await pwExpect(page).toHaveURL(/\/account$/)
    pwExpect(await refreshToken()).not.toBe(before)
    pwExpect(presented.length).toBeGreaterThanOrEqual(2)
    pwExpect(new Set(presented.slice(0, 2)).size).toBe(1) // 두 번 모두 같은 옛 토큰
    page.removeAllListeners('request')
  })

  it('a broken access token is replaced silently: the request is retried after one refresh and the refresh token rotates', async () => {
    const before = await refreshToken()
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
    const after = await refreshToken()
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

  it('email change: the pending change comes from the server, so it is still there after a reload', async () => {
    const section = region(auth.sectionEmail)
    await pwExpect(section.getByText(auth.emailPendingTitle)).toHaveCount(0)
    await section.getByLabel(auth.emailNew).fill(emailNext)
    await section.getByLabel(auth.currentPassword).fill(nextPassword)
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toBeVisible()
    await page.reload()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toBeVisible()
    await pwExpect(section.getByText(new RegExp(emailNext))).toBeVisible()
  })

  it('the new address confirms the change: every session ends (this one too) and only the new address signs in', async () => {
    const link = await waitForLink(mailUrl, emailNext, 'confirm-email-change', { seen })
    await page.goto(`${baseUrl}${link.path}`)
    await pwExpect(page.getByText(auth.confirmEmailChangeDone)).toBeVisible()
    await page.goto(`${baseUrl}/account`)
    await pwExpect(heading(auth.signInTitle)).toBeVisible() // 모든 세션이 닫혔다
    await fillSignIn(page, { email, password: nextPassword })
    await pwExpect(page.getByRole('alert')).toContainText(auth.errorInvalidCredentials)
    await fillSignIn(page, { email: emailNext, password: nextPassword })
    await page.waitForURL((url) => !url.pathname.startsWith('/login')) // 가려던 곳(/account)으로 돌아간다
    await pwExpect(heading(auth.settingsTitle)).toBeVisible()
  })

  it('sessions: another device shows up, and signing it out removes it', async () => {
    const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Name': 'Second device' },
      body: JSON.stringify({ email: emailNext, password: nextPassword }),
    })
    pwExpect(login.status).toBe(200)
    await page.goto(`${baseUrl}/account`)
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
    await fillSignIn(page, { email: emailNext, password: nextPassword })
    await pwExpect(page.getByRole('alert')).toContainText(auth.errorInvalidCredentials)
  })
})

describe('a passwordless account (email link) re-authenticates by mail before the sensitive actions', () => {
  const linkEmail = `e2e-link-${stamp}@example.com`
  const linkNext = `e2e-link-next-${stamp}@example.com`
  const firstPassword = 'First-pass-2026!'

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

  it('settings know there is no password (no "current password" field) and say a confirmation mail comes first', async () => {
    await page.goto(`${baseUrl}/account`)
    const password = region(auth.passwordSetTitle)
    await pwExpect(password).toBeVisible()
    await pwExpect(password.getByLabel(auth.currentPassword)).toHaveCount(0)
    await pwExpect(password.getByText(auth.reauthHint)).toBeVisible()
  })

  it('email change: the server demands re-authentication, a mail goes out; a link opened on ANOTHER device only gets guidance', async () => {
    const section = region(auth.sectionEmail)
    await section.getByLabel(auth.emailNew).fill(linkNext)
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(section.getByText(auth.reauthSentTitle)).toBeVisible()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toHaveCount(0) // 아직 아무것도 요청되지 않았다
    const first = await waitForLink(mailUrl, linkEmail, 'confirm-reauth', { seen })

    // 다른 기기(다른 브라우저 컨텍스트 — sessionStorage · 채널이 공유되지 않는다)
    const other = await browser.newContext({ locale: 'ko-KR' })
    const otherPage = await other.newPage()
    await otherPage.goto(`${baseUrl}${first.path}`)
    await pwExpect(otherPage.getByText(auth.confirmReauthStashed)).toBeVisible()
    await pwExpect(otherPage.getByRole('link', { name: auth.confirmReauthSettings })).toBeVisible()
    await other.close()
  })

  it('same browser, new tab: the tab that started the action picks the link up and finishes — the pending change then comes from the server', async () => {
    const section = region(auth.sectionEmail)
    await section.getByRole('button', { name: auth.reauthResend }).click()
    const second = await waitForLink(mailUrl, linkEmail, 'confirm-reauth', { seen })
    const tab = await context.newPage()
    await tab.goto(`${baseUrl}${second.path}`)
    await pwExpect(tab.getByText(auth.confirmReauthHandedOff)).toBeVisible()
    await tab.close()
    await pwExpect(page.getByText(auth.confirmReauthEmailChanged)).toBeVisible()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toBeVisible()
    await page.reload()
    await pwExpect(section.getByText(new RegExp(linkNext))).toBeVisible()
  })

  it('first password: re-authentication by mail, then one more submit sets it; the account then has a password', async () => {
    const section = region(auth.passwordSetTitle)
    await section.getByLabel(auth.newPassword).fill(firstPassword)
    await section.getByRole('button', { name: auth.passwordChangeSubmit }).click()
    await pwExpect(section.getByText(auth.reauthSentTitle)).toBeVisible()
    const link = await waitForLink(mailUrl, linkEmail, 'confirm-reauth', { seen })
    const tab = await context.newPage()
    await tab.goto(`${baseUrl}${link.path}`)
    await pwExpect(tab.getByText(auth.confirmReauthHandedOff)).toBeVisible()
    await tab.close()
    await pwExpect(section.getByText(auth.reauthReadyTitle)).toBeVisible() // 토큰이 와 있다 — 한 번 더 제출
    await section.getByRole('button', { name: auth.passwordChangeSubmit }).click()
    // 계정이 비밀번호를 갖게 되면 절 제목이 「비밀번호 정하기」 → 「비밀번호」 로 바뀐다 — 절이 아니라 페이지에서 찾는다
    await pwExpect(page.getByText(auth.passwordChanged)).toBeVisible()
    await page.reload()
    await pwExpect(region(auth.sectionPassword).getByLabel(auth.currentPassword)).toBeVisible()
  })

  it('the account can now be deleted with its new password', async () => {
    const section = region(auth.sectionDelete)
    await section.getByLabel(auth.currentPassword).fill(firstPassword)
    await section.getByRole('button', { name: auth.deleteButton }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
    await dialog.getByRole('button', { name: auth.deleteConfirm }).click()
    await pwExpect(heading(auth.signInTitle)).toBeVisible()
  })
})

describe('operator tools (opt-in @skeleton/auth/admin)', () => {
  it('an administrator sees the accounts table; a normal user gets the blocked notice, not a sign-out', async () => {
    await page.goto(`${baseUrl}/login`)
    await fillSignIn(page, { email: 'user@example.com', password: 'password' })
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
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
    await page.getByLabel(auth.adminSearch).fill('user@example.com') // 목록은 쪽으로 나뉜다 — 검색으로 찾는다
    await pwExpect(page.getByText('user@example.com', { exact: true })).toBeVisible()
    await page.getByLabel(auth.adminSearch).fill(emailNext)
    await pwExpect(page.getByText(emailNext)).toBeVisible()
    await pwExpect(
      page.getByRole('row', { name: new RegExp(emailNext) }).getByText(auth.adminStatus.DELETED),
    ).toBeVisible()
  })

  it('the list endpoint refuses a page size over 100 (400); the client never asks for one', async () => {
    const admin = await fetch(`${apiUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password' }),
    })
    const { value } = (await admin.json()) as { value: { accessToken: string } }
    const call = (query: string) =>
      fetch(`${apiUrl}/api/v1/admin/accounts?${query}`, {
        headers: { Authorization: `Bearer ${value.accessToken}` },
      })
    pwExpect((await call('size=101')).status).toBe(400)
    pwExpect((await call('page=-1')).status).toBe(400)
    pwExpect((await call('size=100&page=0')).status).toBe(200)
  })
})
