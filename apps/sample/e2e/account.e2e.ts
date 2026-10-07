import {
  expect as baseExpect,
  type Browser,
  type Locator,
  type Page,
  type Route,
} from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  acceptLegalGate,
  agreeToLegal,
  auth,
  dismissConsent,
  fillSignIn,
  ko,
  launch,
  signUpConsents,
} from './helpers'
import { subjectsFor, waitForCode, waitForLink } from './mail'

/*
 * 계정 수명주기 여정 (계약 FINAL-3 — 인증번호) — 로그인 방법은 백엔드(`GET /auth/methods`)에서 알아낸다 → 가입(정책 힌트) → 메일로 받은 6자리를 같은 화면에서 입력
 * (틀리면 남은 횟수 · 새 코드 받기 · 맞으면 **바로 로그인**) → 갱신 도중 페이지가 이동해도 세션이 이어짐 → 액세스 토큰이 깨져도 갱신으로 이어짐 → 비밀번호 변경 →
 * 이메일 변경(새 주소로 간 인증번호를 같은 세션에서 입력 · 새로고침 뒤에도 서버가 말해 주는 「대기」 · 다른 기기 세션은 끊기고 이 세션은 남는다) → 다른 기기 세션 보기 · 끊기 →
 * 비밀번호 없는 계정(링크 로그인): 이메일 변경 · 첫 비밀번호가 메일로 받은 인증번호를 **그 자리에서 입력**해 다시 인증 → 연결 해제(다시 인증) → 계정 삭제(삭제 인증번호 + 글자 확인) →
 * 가입 선점 시나리오(공격자가 먼저 가입을 시작해도 주인의 인증번호로 끝낸 계정에는 공격자의 비밀번호가 안 통한다) → 운영자 표. 진짜 백엔드 · 진짜 브라우저 · 진짜 메일(mailpit).
 * 한 흐름이라 단계가 앞 단계의 결과에 기댄다. 링크가 남은 메일은 링크 로그인 · 비밀번호 재설정뿐이다.
 */
// 개발 서버의 첫 방문(모듈 변환)이 부하가 큰 기계에서는 5초(기본)를 넘길 수 있다 — 첫 화면을 기다리는 단언만 아니라 모두 넉넉히
const pwExpect = baseExpect.configure({ timeout: 20_000 })
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
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

const heading = (name: string | RegExp, level = 1) => page.getByRole('heading', { level, name })
const region = (name: string, on: Page = page) => on.getByRole('region', { name })
const token = (key: string) => page.evaluate((k) => window.localStorage.getItem(k), key)
const refreshToken = async () =>
  JSON.parse((await token('sample.refresh')) ?? '{}').refreshToken as string
/**
 * 삭제가 받아들여지면 `/account` 에 남지 않고 로그아웃 상태의 안내(`/account-deleted`)로 간다 — 머리글도 로그아웃 상태.
 * 샘플은 서버가 self-restore 를 켜 둬 「그 전에 다시 로그인하면 취소할 수 있어요」 도 말한다. 「로그인 화면으로」 로 로그인 화면까지 간다
 */
async function expectAccountDeletedLanding() {
  await pwExpect(heading(auth.accountDeletedTitle)).toBeVisible()
  await pwExpect(page).toHaveURL(/\/account-deleted$/)
  await pwExpect(page.getByText(auth.accountDeletedRestoreNote)).toBeVisible()
  await pwExpect(
    page.getByRole('banner').getByRole('button', { name: ko('header.signOut') }),
  ).toHaveCount(0)
  await page.getByRole('link', { name: auth.accountDeletedAction }).click()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** 인증번호 칸에 6자리를 친다(첫 칸에서 시작 — 한 자리마다 다음 칸으로 넘어가고, 다 채우면 버튼 없이 제출된다) */
async function enterCode(scope: Page | Locator, code: string) {
  await scope.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(code)
}

/** 같은 기기에서 API 로 로그인한다(세션 목록에 이름이 보인다) */
async function apiLogin(account: { email: string; password: string }, device?: string) {
  const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(device ? { 'X-Device-Name': device } : {}) },
    body: JSON.stringify(account),
  })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

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

describe('sign-up by a 6-digit code, signed in at once', () => {
  it('sign-up shows the password policy hints, then asks for the code (no account exists yet)', async () => {
    await page.goto(`${baseUrl}/sign-up`)
    await page.getByLabel(auth.email).fill(email)
    await page.getByLabel(auth.displayName).fill('가입 시험 사용자') // 샘플 앱은 가입에서 닉네임을 받는다
    await page.getByLabel(auth.password).first().fill('abc')
    // 서버 정책(`GET /account/password/policy`)에서 읽은 규칙이 미충족으로 보인다
    await pwExpect(page.getByText(auth.passwordRule.TOO_SHORT)).toBeVisible()
    await pwExpect(
      page.getByRole('img', { name: new RegExp(auth.passwordStrength[1]) }),
    ).toBeVisible()
    await page.getByLabel(auth.password).first().fill(password)
    await page.getByLabel(auth.passwordConfirm).fill(password)
    await pwExpect(
      page.getByRole('img', { name: new RegExp(auth.passwordStrength[4]) }),
    ).toBeVisible()
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(heading(auth.codeTitle, 2)).toBeVisible()
    await pwExpect(page.getByText(email).first()).toBeVisible()
    await pwExpect(page.getByLabel(auth.password)).toHaveCount(0) // 비밀번호는 코드 단계에 남지 않는다
    // 계정은 아직 없다 — 이 주소로는 로그인할 수 없다
    pwExpect((await apiLogin({ email, password })).status).toBe(401)
  })

  it('the code survives a reload of the tab (the attempt id lives in sessionStorage; the password does not)', async () => {
    await page.reload()
    await pwExpect(heading(auth.codeTitle, 2)).toBeVisible()
    pwExpect(await page.evaluate(() => JSON.stringify(window.sessionStorage))).not.toContain(
      password,
    )
  })

  it('a wrong code says how many attempts are left and clears the cells', async () => {
    await enterCode(page, '000000')
    await pwExpect(page.getByRole('alert')).toContainText(auth.codeInvalid(4))
    await pwExpect(page.getByLabel(auth.codeDigit(1, 6))).toHaveValue('')
    await enterCode(page, '111111')
    await pwExpect(page.getByRole('alert')).toContainText(auth.codeInvalid(3))
  })

  it('"send a new code" mails a new code for the same attempt (after the 30 s cooldown) and restores the attempts', async () => {
    const first = await waitForCode(mailUrl, email, 'verify', { seen })
    await sleep(31_000) // 서버는 30초 안의 재전송을 조용히 무시한다
    await page.getByRole('button', { name: auth.codeResend }).click()
    await pwExpect(page.getByText(auth.codeResent)).toBeVisible()
    const second = await waitForCode(mailUrl, email, 'verify', { seen })
    pwExpect(second.id).not.toBe(first.id)
    await enterCode(page, '222222')
    await pwExpect(page.getByRole('alert')).toContainText(auth.codeInvalid(4)) // 횟수가 다시 5 에서
    await enterCode(page, second.code)
    // 맞으면 별도 로그인 없이 바로 로그인한다
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
    pwExpect(await token('sample.accessToken')).toBeTruthy()
    pwExpect(await token('sample.refresh')).toContain('refreshToken')
    pwExpect(await page.evaluate(() => window.sessionStorage.getItem('sample.signUp'))).toBeNull() // 진행 중이던 가입 기록은 지워졌다
  })

  it('the account exists now: the password from THIS sign-up attempt signs in', async () => {
    pwExpect((await apiLogin({ email, password })).status).toBe(200)
  })

  it('an old mailed verification link says it is no longer used (no dead end, nothing is sent to the server)', async () => {
    const calls: string[] = []
    page.on('request', (r) => r.url().includes('/api/v1/') && calls.push(r.url()))
    await page.goto(`${baseUrl}/verify-email?token=old`)
    await pwExpect(heading(auth.legacyLinkTitle)).toBeVisible()
    await pwExpect(page.getByText(auth.legacyLinkBody)).toBeVisible()
    pwExpect(calls.filter((url) => url.includes('verify-email'))).toEqual([])
    page.removeAllListeners('request')
    await page.goto(`${baseUrl}/`)
  })
})

describe('account lifecycle against the real backend', () => {
  it('navigation during a refresh: the response is lost, the next page presents the previous token within the 10 s grace and the session carries on', async () => {
    await page.goto(`${baseUrl}/`)
    const before = await refreshToken()
    await page.evaluate(() =>
      window.localStorage.setItem('sample.accessToken', 'header.e30.expired'),
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
      window.localStorage.setItem('sample.accessToken', 'header.e30.expired'),
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
      (before) => !window.localStorage.getItem('sample.refresh')?.includes(before),
      before,
    )
    await pwExpect(heading(ko('notes.title'))).toBeVisible()
    const after = await refreshToken()
    pwExpect(after).not.toBe(before) // 회전
    pwExpect(await token('sample.accessToken')).not.toBe('header.e30.expired')
    pwExpect(refreshCalls).toHaveLength(1) // 여러 요청이 동시에 401 이어도 갱신은 한 번
    page.removeAllListeners('request')
  })

  it('a 429 AUTH.TOO_MANY_REFRESHES keeps the session: no sign-out, the same error is shown while backing off, and no new refresh request goes out', async () => {
    const refreshCalls: string[] = []
    page.on(
      'request',
      (r) => r.url().includes('/api/v1/auth/refresh') && refreshCalls.push(r.url()),
    )
    await page.route('**/api/v1/auth/refresh', (route) =>
      route.fulfill({
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
        body: JSON.stringify({
          code: 'AUTH.TOO_MANY_REFRESHES',
          title: 'Too many refreshes',
          status: 429,
          timestamp: new Date().toISOString(),
          data: { retryAfterSeconds: 60 },
        }),
      }),
    )
    const refresh = await refreshToken()
    await page.evaluate(() =>
      window.localStorage.setItem('sample.accessToken', 'header.e30.expired'),
    )
    await page.goto(`${baseUrl}/notes`)
    await pwExpect.poll(() => refreshCalls.length).toBeGreaterThanOrEqual(1)
    const calls = refreshCalls.length
    await page.reload() // 한 번 더 — 기다리는 동안이라 서버를 부르지 않는다(탭마다 새 갱신기라면 한 번 더 갈 수 있다)
    await page.waitForTimeout(500)
    pwExpect(await refreshToken()).toBe(refresh) // 세션은 그대로 — 자격을 비우지 않았다
    pwExpect(refreshCalls.length).toBeLessThanOrEqual(calls + 1)
    await pwExpect(page).not.toHaveURL(/\/login/) // 로그인 화면으로 쫓겨나지 않는다
    await page.unroute('**/api/v1/auth/refresh')
    page.removeAllListeners('request')
  })

  it('account settings: a wrong current password is refused, the right one changes it', async () => {
    await page.goto(`${baseUrl}/account`)
    await pwExpect(heading(auth.settingsTitle)).toBeVisible()
    const section = region(auth.sectionPassword)
    await section.getByLabel(auth.currentPassword).fill('wrong-password-1')
    await section.getByLabel(auth.newPassword).fill(nextPassword)
    await section.getByLabel(auth.passwordConfirm).fill(nextPassword)
    await section.getByRole('button', { name: auth.passwordChangeSubmit }).click()
    await pwExpect(section.getByText(auth.errorCurrentPassword)).toBeVisible()
    await section.getByLabel(auth.currentPassword).fill(password)
    await section.getByRole('button', { name: auth.passwordChangeSubmit }).click()
    await pwExpect(section.getByText(auth.passwordChanged)).toBeVisible()
  })

  it('email change: the code step comes from the server (still there after a reload), a wrong code shows the attempts left', async () => {
    const section = region(auth.sectionEmail)
    await pwExpect(section.getByText(auth.emailPendingTitle)).toHaveCount(0)
    await section.getByLabel(auth.emailNew).fill(emailNext)
    await section.getByLabel(auth.currentPassword).fill('wrong-password-1')
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(section.getByText(auth.errorCurrentPassword)).toBeVisible()
    await section.getByLabel(auth.currentPassword).fill(nextPassword)
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toBeVisible()
    await page.reload()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toBeVisible()
    await pwExpect(section.getByText(new RegExp(emailNext)).first()).toBeVisible()
    await enterCode(section, '000000')
    await pwExpect(section.getByText(auth.codeInvalid(4)).first()).toBeVisible()
  })

  it('the code goes to the NEW address; entering it in this session switches the address — this session stays signed in, the other devices are signed out', async () => {
    // 이 주소로 간 인증번호 메일이 있고, 옛 주소에는 「변경 요청」 알림만 있다(코드는 없다)
    const code = await waitForCode(mailUrl, emailNext, 'email-change', { seen })
    pwExpect(
      (await subjectsFor(mailUrl, email)).some((s) =>
        /새 이메일 확인 인증번호|Your code to confirm the new email/.test(s),
      ),
    ).toBe(false)
    // 다른 기기(같은 계정의 다른 세션) — 변경이 확정되면 끊긴다
    pwExpect((await apiLogin({ email, password: nextPassword }, 'Second device')).status).toBe(200)
    const section = region(auth.sectionEmail)
    await enterCode(section, code.code)
    await pwExpect(section.getByText(auth.emailChanged)).toBeVisible()
    await pwExpect(section.getByText(emailNext, { exact: true })).toBeVisible()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toHaveCount(0)
    // 이 세션은 로그인된 채다 — 새로고침해도 설정이 열린다
    await page.reload()
    await pwExpect(heading(auth.settingsTitle)).toBeVisible()
    await pwExpect(region(auth.sectionSessions).getByText('Second device')).toHaveCount(0)
    // 옛 주소로는 로그인할 수 없고 새 주소로는 된다
    pwExpect((await apiLogin({ email, password: nextPassword })).status).toBe(401)
    pwExpect((await apiLogin({ email: emailNext, password: nextPassword })).status).toBe(200)
  })

  it('sessions: another device shows up, and signing it out removes it', async () => {
    pwExpect(
      (await apiLogin({ email: emailNext, password: nextPassword }, 'Third device')).status,
    ).toBe(200)
    await page.goto(`${baseUrl}/account`)
    const section = region(auth.sectionSessions)
    await pwExpect(section.getByText('Third device')).toBeVisible()
    // 「이 기기」 배지(정확히) — 로컬 IP 는 「이 기기(로컬)」 로 읽혀 부분 일치로는 여럿이 걸린다
    await pwExpect(section.getByText(auth.sessionsCurrent, { exact: true })).toBeVisible()
    // 가입 인증(코드)으로 로그인한 이 세션도 기기 이름(X-Device-Name)을 갖는다 — 「알 수 없는 기기」가 아니다
    await pwExpect(
      section
        .getByRole('listitem')
        .filter({ has: page.getByText(auth.sessionsCurrent, { exact: true }) }),
    ).not.toContainText(auth.sessionsUnknownDevice)
    await section.getByRole('button', { name: auth.sessionsRevoke, exact: true }).first().click()
    await pwExpect(section.getByText('Third device')).toHaveCount(0)
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
    await expectAccountDeletedLanding()
    await pwExpect(heading(auth.signInTitle)).toBeVisible() // 안내의 「로그인 화면으로」 — 이 기기는 이미 로그아웃
    // 서버가 self-restore 를 켜 둔 샘플: 삭제 유예 중인 계정이 맞는 비밀번호로 로그인하면 세션 대신 「탈퇴를 취소할까요?」 — 취소하지 않는 한 쓸 수 없다
    await fillSignIn(page, { email: emailNext, password: nextPassword })
    await pwExpect(heading(auth.deletionPendingTitle)).toBeVisible()
    pwExpect(await token('sample.accessToken')).toBeNull()
  })
})

describe('a passwordless account (email link) re-authenticates by a mailed code, entered in place', () => {
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
    await acceptLegalGate(page, apiUrl) // legal 모듈이 있는 백엔드: 링크로 처음 들어온 계정은 동의부터
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
  })

  it('settings know there is no password (no "current password" field) and offer the mailed code instead', async () => {
    await page.goto(`${baseUrl}/account`)
    const passwordSection = region(auth.passwordSetTitle)
    await pwExpect(passwordSection).toBeVisible()
    await pwExpect(passwordSection.getByLabel(auth.currentPassword)).toHaveCount(0)
    await pwExpect(passwordSection.getByRole('button', { name: auth.reauthCodeSend })).toBeVisible()
  })

  it('email change: "email me a code" → the 6 digits are typed right there → the code for the NEW address follows (survives a reload)', async () => {
    const section = region(auth.sectionEmail)
    await section.getByLabel(auth.emailNew).fill(linkNext)
    await section.getByRole('button', { name: auth.reauthCodeSend }).click()
    await pwExpect(section.getByText(auth.reauthCodeSent(linkEmail))).toBeVisible()
    // 비밀번호 없는 계정이 코드 없이 요청하면 서버가 거절한다 — 코드를 입력하기 전에 누르면 보내지 않고 이유를 말한다(제출 뒤 문제 목록)
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(section.getByText(auth.problemProofMissing).first()).toBeVisible()
    const reauth = await waitForCode(mailUrl, linkEmail, 'reauth', { seen })
    await enterCode(section, '000000')
    await pwExpect(section.getByText(auth.reauthCodeEntered)).toBeVisible()
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(section.getByText(auth.codeInvalid(4)).first()).toBeVisible() // 서버가 틀린 코드를 가려 준다
    await enterCode(section, reauth.code)
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(section.getByText(auth.emailPendingTitle)).toBeVisible()
    await page.reload()
    await pwExpect(section.getByText(new RegExp(linkNext)).first()).toBeVisible()
    const confirm = await waitForCode(mailUrl, linkNext, 'email-change', { seen })
    await enterCode(section, confirm.code)
    await pwExpect(section.getByText(auth.emailChanged)).toBeVisible()
    await pwExpect(section.getByText(linkNext, { exact: true })).toBeVisible()
  })

  it('first password: a new mailed code is typed in place, then the password is set; the account then signs in with it', async () => {
    const section = region(auth.passwordSetTitle)
    await section.getByRole('button', { name: auth.reauthCodeSend }).click()
    const reauth = await waitForCode(mailUrl, linkNext, 'reauth', { seen })
    await enterCode(section, reauth.code)
    await section.getByLabel(auth.newPassword).fill(firstPassword)
    await section.getByLabel(auth.passwordConfirm).fill(firstPassword)
    await section.getByRole('button', { name: auth.passwordChangeSubmit }).click()
    // 계정이 비밀번호를 갖게 되면 절 제목이 「비밀번호 정하기」 → 「비밀번호」 로 바뀐다 — 절이 아니라 페이지에서 찾는다
    await pwExpect(page.getByText(auth.passwordChanged)).toBeVisible()
    pwExpect((await apiLogin({ email: linkNext, password: firstPassword })).status).toBe(200)
    await page.reload()
    await pwExpect(region(auth.sectionPassword).getByLabel(auth.currentPassword)).toBeVisible()
  })

  it('unlink: removing a sign-in method needs re-authentication — the dialog asks for the password and stays open on a wrong one', async () => {
    const section = region(auth.sectionMethods)
    const mail = section.getByRole('listitem').filter({ hasText: auth.methodNames.magic_link })
    await mail.getByRole('button', { name: auth.methodUnlink }).click()
    const dialog = page.getByRole('dialog')
    await pwExpect(dialog.getByRole('button', { name: auth.methodUnlink })).toBeDisabled()
    await dialog.getByLabel(auth.currentPassword).fill('wrong-password-1')
    await dialog.getByRole('button', { name: auth.methodUnlink }).click()
    await pwExpect(dialog.getByText(auth.errorCurrentPassword)).toBeVisible()
    await dialog.getByLabel(auth.currentPassword).fill(firstPassword)
    await dialog.getByRole('button', { name: auth.methodUnlink }).click()
    await pwExpect(section.getByText(auth.methodUnlinked)).toBeVisible()
    await pwExpect(
      section.getByRole('listitem').filter({ hasText: auth.methodNames.magic_link }),
    ).toHaveCount(0)
  })

  it('the account can still be deleted with its password (the code route is shown with the next account)', async () => {
    const section = region(auth.sectionDelete)
    await section.getByLabel(auth.currentPassword).fill(firstPassword)
    await section.getByRole('button', { name: auth.deleteButton }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
    await dialog.getByRole('button', { name: auth.deleteConfirm }).click()
    await expectAccountDeletedLanding()
    await pwExpect(heading(auth.signInTitle)).toBeVisible()
  })
})

describe('delete a passwordless account with a mailed code and a typed phrase', () => {
  const goneEmail = `e2e-gone-${stamp}@example.com`

  it('"email me a code" for the DELETE code (a separate code), a wrong one shows the attempts left, the right one + the phrase schedules the deletion', async () => {
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: auth.signInMagicLink }).click()
    await page.getByLabel(auth.email).fill(goneEmail)
    await page.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
    const link = await waitForLink(mailUrl, goneEmail, 'magic-link', { seen })
    await page.goto(`${baseUrl}${link.path}`)
    await acceptLegalGate(page, apiUrl)
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
    await page.goto(`${baseUrl}/account`)
    const section = region(auth.sectionDelete)
    await pwExpect(section.getByLabel(auth.currentPassword)).toHaveCount(0)
    // 코드 전에도 눌린다 — 보내지 않고 이유를 말한다(`FormProblems`)
    await section.getByRole('button', { name: auth.deleteButton }).click()
    await pwExpect(section.getByText(auth.problemProofMissing).first()).toBeVisible()
    await pwExpect(page.getByRole('dialog')).toHaveCount(0)
    await section.getByRole('button', { name: auth.reauthCodeSend }).click()
    const code = await waitForCode(mailUrl, goneEmail, 'delete', { seen })
    await enterCode(section, '000000')
    await section.getByRole('button', { name: auth.deleteButton }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
    await dialog.getByRole('button', { name: auth.deleteConfirm }).click()
    await pwExpect(section.getByText(auth.codeInvalid(4)).first()).toBeVisible()
    await enterCode(section, code.code)
    await section.getByRole('button', { name: auth.deleteButton }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
    await dialog.getByRole('button', { name: auth.deleteConfirm }).click()
    await expectAccountDeletedLanding()
    await pwExpect(heading(auth.signInTitle)).toBeVisible()
  })
})

describe('pre-hijack: an attacker who starts a sign-up for someone else’s address gets nothing', () => {
  const victim = `e2e-victim-${stamp}@example.com`
  const attackerPassword = 'Attacker-pass-2026'
  const ownerPassword = 'Owner-pass-2026!'

  it('the attacker starts a sign-up with their own password; the real owner then signs up and verifies with their OWN code — only the owner’s password works', async () => {
    // 공격자 — 주인의 주소로 자기 비밀번호를 걸어 가입을 먼저 시작한다(코드는 주인의 메일함으로 간다)
    const attack = await fetch(`${apiUrl}/api/v1/account/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: victim,
        password: attackerPassword,
        displayName: '선점 시험', // 샘플 백엔드는 가입에서 닉네임이 필수다
        ...(await signUpConsents(apiUrl)),
      }),
    })
    pwExpect(attack.status).toBe(202)
    const attackerId = ((await attack.json()) as { value: { signUpId: string } }).value.signUpId
    const attackersCode = await waitForCode(mailUrl, victim, 'verify', { seen })

    // 주인 — 같은 주소로 화면에서 가입하고 자기 메일의 새 코드로 끝낸다
    await page.goto(`${baseUrl}/sign-up`)
    await page.getByLabel(auth.email).fill(victim)
    await page.getByLabel(auth.displayName).fill('가입 시험 사용자') // 샘플 앱은 가입에서 닉네임을 받는다
    await page.getByLabel(auth.password).first().fill(ownerPassword)
    await page.getByLabel(auth.passwordConfirm).fill(ownerPassword)
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(heading(auth.codeTitle, 2)).toBeVisible()
    const ownersCode = await waitForCode(mailUrl, victim, 'verify', { seen })
    pwExpect(ownersCode.id).not.toBe(attackersCode.id)
    await enterCode(page, ownersCode.code)
    await pwExpect(heading(/안녕하세요/)).toBeVisible() // 주인은 바로 로그인

    // 공격자의 비밀번호는 통하지 않고, 주인의 것만 통한다
    pwExpect((await apiLogin({ email: victim, password: attackerPassword })).status).toBe(401)
    pwExpect((await apiLogin({ email: victim, password: ownerPassword })).status).toBe(200)
    // 공격자가 자기 시도로 코드를 내도 거절된다(그 주소는 이미 가입됐다 — 하나의 응답 410)
    const late = await fetch(`${apiUrl}/api/v1/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signUpId: attackerId, code: attackersCode.code }),
    })
    pwExpect(late.status).toBe(410)
    pwExpect(((await late.json()) as { code: string }).code).toBe('ACCOUNT.CODE_EXPIRED')
    // 그래도 공격자의 비밀번호는 여전히 통하지 않는다
    pwExpect((await apiLogin({ email: victim, password: attackerPassword })).status).toBe(401)
    await page.evaluate(() => window.localStorage.clear())
  })

  it('signing up with an address that is already registered looks the same as a new one (a code prompt), and no code is mailed to it', async () => {
    await page.goto(`${baseUrl}/sign-up`)
    await page.getByLabel(auth.email).fill(victim)
    await page.getByLabel(auth.displayName).fill('가입 시험 사용자') // 샘플 앱은 가입에서 닉네임을 받는다
    await page.getByLabel(auth.password).first().fill('Whatever-pass-2026')
    await page.getByLabel(auth.passwordConfirm).fill('Whatever-pass-2026')
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(heading(auth.codeTitle, 2)).toBeVisible() // 존재 여부를 숨긴다
    await enterCode(page, '123456')
    await pwExpect(page.getByRole('alert')).toContainText(auth.codeInvalid(4)) // 새 주소의 틀린 번호와 같은 모양
    // 가입된 주소에는 코드 대신 「이미 계정이 있어요」 알림이 간다 — 코드 메일은 그대로 둘뿐(공격자 시도 · 주인)
    await pwExpect
      .poll(async () =>
        (await subjectsFor(mailUrl, victim)).some((s) =>
          /이미 계정이 있어요|You already have an account/.test(s),
        ),
      )
      .toBe(true)
    pwExpect(
      (await subjectsFor(mailUrl, victim)).filter((s) =>
        /^(인증번호를 보내 드려요|Your verification code)$/.test(s),
      ),
    ).toHaveLength(2)
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
