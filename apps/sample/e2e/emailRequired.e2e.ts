import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { acceptLegalGate, agreeToLegal, auth, dismissConsent, ko, launch, legal } from './helpers'
import { signOut } from './boardSteps'
import { subjectsFor, waitForCode, waitForLink } from './mail'

/*
 * 이메일 필수(`skeleton.account.email.required`) + 연락받을 이메일(`contact-email.enabled`) — 백엔드 샘플이 둘 다 켜 둔다.
 *  1) 주소를 주지 않는 가짜 LINE 사용자(= 카카오 · 네이버 · X 와 같은 주소 없는 계정)가 로그인하면 앱 대신 「이메일을 등록해 주세요」가 덮는다 —
 *     허용 목록 밖의 API 는 403 `ACCOUNT.EMAIL_REQUIRED` · 게시판 주소로 바로 들어가도 같은 화면 · 오류 토스트 없음 · 한 번에 하나(이메일 → 약관)
 *     → 번호가 안 오는 주소(이미 남이 쓰는 주소) 안내 → 메일함의 인증번호 → 약관 → 홈 → 이제 게시판 API 가 열린다.
 *  2) 연락받을 이메일: 설정에서 등록(그 주소로 간 인증번호) → 설정 요약에 보인다 → **비밀번호 찾기에 그 주소를 넣으면 메일이 가지 않는다**(계정 이메일은 간다) → 지운다.
 * 가짜 제공자가 없으면(`fakeUrl` 빈 문자열) 1) 은 건너뛴다.
 * 1시간이 지난 첫 등록의 제공자 재동의(`REAUTH_REQUIRED`)는 마지막 로그인 시각에 달려 있어 표준 실행으로는 만들 수 없다 — `E2E_EMAIL_REAUTH_WINDOW=PT0S` 로 백엔드를 띄운 실행에서만 도는 `emailReauth.e2e.ts` 가 시험한다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const stamp = Date.now()
const seen = new Set<string>()

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
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

/** 로그인한 이 탭의 토큰으로 API 를 부른다 — 상태 코드와 오류 코드 */
async function callApi(path: string) {
  return page.evaluate(async (url) => {
    const token = window.localStorage.getItem('sample.accessToken')
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json().catch(() => ({}))
    return { status: response.status, code: (body as { code?: string }).code ?? null }
  }, `${baseUrl}/api/v1${path}`)
}

/** 화면에서 가장 위에 보이는 막(`role=dialog`)의 제목 — 한 번에 하나만 보이는지 */
const topDialogTitle = () =>
  page.evaluate(() => {
    const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
    return hit?.closest('[role="dialog"]')?.querySelector('h1,h2')?.textContent ?? null
  })

const registered = `e2e-reg-${stamp}@example.com`
const gate = () => page.getByRole('dialog', { name: auth.emailRequiredTitle })

describe('an address-less account (LINE gives no email) is stopped by the register-your-email screen', () => {
  run('signing in with LINE shows the full-screen step instead of the app', async () => {
    await control({
      line: { sub: `U-req-${stamp}`, name: '주소 없는 사용자', email: '' },
      deny: false,
    })
    await page.goto(`${baseUrl}/login`)
    await dismissConsent(page)
    await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
    await pwExpect(gate()).toBeVisible()
    await pwExpect(gate().getByText(auth.emailRequiredBody)).toBeVisible()
    await pwExpect(
      gate().getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) }),
    ).toBeVisible()
    // 눌리는 것은 모두 단추다 — 인증번호 받기(채움) · 로그아웃 · 계정 삭제
    await pwExpect(gate().getByRole('button', { name: auth.emailRequiredSend })).toBeVisible()
    await pwExpect(gate().getByRole('button', { name: auth.emailRequiredSignOut })).toBeVisible()
    await pwExpect(gate().getByRole('button', { name: auth.emailRequiredDelete })).toBeVisible()
    // 제목에 포커스 — 낭독이 제목부터 읽는다
    await pwExpect(gate().getByRole('heading', { level: 1 })).toBeFocused()
  })

  run(
    'the server shut the API: 403 ACCOUNT.EMAIL_REQUIRED outside the allow list, me says emailRequired',
    async () => {
      pwExpect(await callApi('/boards/config')).toEqual({
        status: 403,
        code: 'ACCOUNT.EMAIL_REQUIRED',
      })
      pwExpect(await callApi('/notes')).toEqual({ status: 403, code: 'ACCOUNT.EMAIL_REQUIRED' })
      const me = await page.evaluate(async (url) => {
        const token = window.localStorage.getItem('sample.accessToken')
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        return (await response.json()).value as { emailRequired?: boolean; email: string | null }
      }, `${baseUrl}/api/v1/account/me`)
      pwExpect(me.emailRequired).toBe(true)
      pwExpect(me.email).toBeNull()
      // 허용 목록: 약관 조회 · 세션은 열려 있다
      pwExpect((await callApi('/auth/sessions')).status).toBe(200)
    },
  )

  run('entering the board by its address shows the same screen, and no error toast', async () => {
    await page.goto(`${baseUrl}/board`)
    await pwExpect(gate()).toBeVisible()
    pwExpect(await topDialogTitle()).toBe(auth.emailRequiredTitle)
    await page.waitForTimeout(1500) // 뒤 화면의 쿼리가 403 을 쏟아냈다면 토스트가 떴을 시간
    await pwExpect(page.locator('[data-sonner-toast]')).toHaveCount(0)
    // 약관은 이메일 다음 — 이메일을 등록하기 전에는 약관 막이 아예 뜨지 않는다
    await pwExpect(
      page.getByRole('dialog', {
        name: new RegExp(`${legal.reconsentTitle}|${legal.firstConsentTitle}`),
      }),
    ).toHaveCount(0)
  })

  run(
    'an address that cannot be right is explained in place, the button stays pressable',
    async () => {
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      await pwExpect(gate().getByRole('button', { name: auth.problemEmailMissing })).toBeVisible()
      await gate()
        .getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) })
        .fill('nope')
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      await pwExpect(gate().getByRole('button', { name: auth.problemEmailInvalid })).toBeVisible()
    },
  )

  run(
    'an address another account owns: the same code screen, a hint, and no code arrives',
    async () => {
      // 남이 쓰는 주소 — 백엔드가 시드한 체험 계정의 주소
      const taken = 'user@example.com'
      const field = gate().getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) })
      await field.fill(taken)
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      await pwExpect(gate().getByText(auth.emailRequiredCodeTitle)).toBeVisible()
      await pwExpect(
        gate().getByText(/번호가 안 오면 그 주소로 이미 가입한 계정이 있을 수 있어요/),
      ).toBeVisible()
      // 메일함에는 인증번호가 가지 않는다 — 가입된 주소에는 「이미 계정이 있어요」 메일만
      await page.waitForTimeout(2500)
      const subjects = await subjectsFor(mailUrl, taken)
      pwExpect(
        subjects.some((s) => /^새 이메일 확인 인증번호|Your code to confirm the new email/.test(s)),
      ).toBe(false)
      // 주소 고치기 — 입력 칸으로 돌아간다
      await gate().getByRole('button', { name: auth.emailRequiredFixAddress }).click()
      await pwExpect(
        gate().getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) }),
      ).toBeFocused()
    },
  )

  run(
    'the right address: the code from the mailbox ends it; terms come next, one at a time',
    async () => {
      await gate()
        .getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) })
        .fill(registered)
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      await pwExpect(gate().getByText(auth.emailRequiredCodeBody(registered))).toBeVisible()
      await pwExpect(gate().getByText(/^남은 시간/)).toBeVisible()
      const code = await waitForCode(mailUrl, registered, 'email-change', { seen })
      await gate().getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await pwExpect(gate()).toHaveCount(0)
      // 이메일이 끝나면 약관(있는 백엔드) — 이메일 막이 걷힌 뒤에 보인다
      await acceptLegalGate(page, apiUrl)
      await pwExpect(page.getByRole('dialog')).toHaveCount(0)
    },
  )

  run(
    'now the app opens: the board and its API answer, the account shows the address',
    async () => {
      await page.goto(`${baseUrl}/board`)
      await pwExpect(page.getByRole('button', { name: ko('board.write') })).toBeVisible()
      pwExpect((await callApi('/boards/config')).status).toBe(200)
      await pwExpect(gate()).toHaveCount(0)
      await page.goto(`${baseUrl}/account`)
      await pwExpect(
        page
          .getByRole('region', { name: auth.sectionEmail })
          .locator('strong')
          .filter({ hasText: registered }),
      ).toBeVisible()
      // 계정 이메일은 지울 수 없다고 말한다 · 쓰임을 말한다
      await pwExpect(page.getByText(auth.emailCannotRemove)).toBeVisible()
      await pwExpect(page.getByText(auth.emailRole)).toBeVisible()
    },
  )
})

describe('contact email: a second, optional address for notices (never for sign-in or password reset)', () => {
  const account = `e2e-contact-${stamp}@example.com`
  const contact = `e2e-news-${stamp}@example.com`
  const password = 'Correct-horse-9'

  it('a mail sign-up account exists', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(account)
    await page.getByLabel(auth.displayName).fill('연락 시험')
    await page.getByLabel(auth.password).first().fill(password)
    await page.getByLabel(auth.passwordConfirm).fill(password)
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    const code = await waitForCode(mailUrl, account, 'verify', { seen })
    await page.getByLabel(auth.codeDigit(1, 6)).click()
    await page.keyboard.type(code.code)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await pwExpect(gate()).toHaveCount(0) // 주소가 있는 계정은 막지 않는다
  })

  it('settings: two sections - the account email says what it is for, the contact email is optional and empty', async () => {
    await page.goto(`${baseUrl}/account`)
    const accountEmail = page.getByRole('region', { name: auth.sectionEmail })
    await pwExpect(accountEmail.getByText(account)).toBeVisible()
    await pwExpect(accountEmail.getByText(auth.emailRole)).toBeVisible()
    const section = page.getByRole('region', { name: auth.sectionContactEmail })
    await pwExpect(section.getByText(auth.contactEmailNone)).toBeVisible()
    await pwExpect(section.getByRole('button', { name: auth.contactEmailAdd })).toBeVisible()
  })

  it('register: address → the code goes to THAT address → saved', async () => {
    const section = page.getByRole('region', { name: auth.sectionContactEmail })
    await section.getByRole('button', { name: auth.contactEmailAdd }).click()
    await section.getByLabel(auth.contactEmailField).fill(contact)
    await section.getByRole('button', { name: auth.contactEmailSend }).click()
    await pwExpect(section.getByText(auth.contactEmailCodeBody(contact))).toBeVisible()
    const code = await waitForCode(mailUrl, contact, 'contact-email', { seen })
    await section.getByLabel(auth.codeDigit(1, 6)).click()
    await page.keyboard.type(code.code)
    await pwExpect(section.getByText(auth.contactEmailSaved)).toBeVisible()
    await pwExpect(section.locator('strong').filter({ hasText: contact })).toBeVisible()
    // 계정 이메일은 그대로
    await pwExpect(
      page.getByRole('region', { name: auth.sectionEmail }).getByText(account),
    ).toBeVisible()
  })

  it('the settings summary shows both: the account email and where notices go', async () => {
    await page.goto(`${baseUrl}/settings`)
    await pwExpect(page.getByText(ko('settings.contactEmail'))).toBeVisible()
    await pwExpect(page.getByText(contact)).toBeVisible()
  })

  it('asking for a password reset with the contact address sends nothing; with the account email a reset mail comes', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/forgot-password`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(contact)
    await page.getByRole('button', { name: auth.forgotSubmit }).click()
    await pwExpect(page.getByText(auth.forgotSentBody(contact))).toBeVisible() // 화면은 늘 같은 말(계정이 있는지 알려 주지 않는다)
    await page.waitForTimeout(3000)
    const subjects = await subjectsFor(mailUrl, contact)
    // 이 주소로 간 메일은 연락받을 이메일 확인 인증번호 하나뿐 — 재설정 메일은 없다
    pwExpect(subjects).toHaveLength(1)
    pwExpect(subjects[0]).toMatch(
      /연락받을 이메일 확인 인증번호|Your code to confirm the contact email/,
    )
    // 대조: 같은 요청을 계정 이메일로 하면 재설정 메일이 온다(메일 경로가 살아 있다는 증거)
    await page.goto(`${baseUrl}/forgot-password`)
    await page.getByLabel(auth.email).fill(account)
    await page.getByRole('button', { name: auth.forgotSubmit }).click()
    const link = await waitForLink(mailUrl, account, 'reset-password', { seen })
    pwExpect(link.path).toContain('/reset-password?token=')
  })

  it('remove: signing in again, the address is still there; one press removes it and notices go back to the account email', async () => {
    await page.goto(`${baseUrl}/login`)
    await page.getByLabel(auth.email).fill(account)
    await page.getByLabel(auth.password, { exact: false }).first().fill(password)
    await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
    await acceptLegalGate(page, apiUrl)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await page.goto(`${baseUrl}/account`)
    const section = page.getByRole('region', { name: auth.sectionContactEmail })
    await pwExpect(section.locator('strong').filter({ hasText: contact })).toBeVisible()
    await section.getByRole('button', { name: auth.contactEmailRemove }).click()
    await pwExpect(section.getByText(auth.contactEmailRemoved)).toBeVisible()
    await pwExpect(section.getByText(auth.contactEmailNone)).toBeVisible()
    await page.reload()
    await pwExpect(
      page.getByRole('region', { name: auth.sectionContactEmail }).getByText(auth.contactEmailNone),
    ).toBeVisible()
    await page.goto(baseUrl)
    await signOut(page)
  })
})
