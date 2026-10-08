import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  acceptLegalGate,
  agreeToLegal,
  auth,
  chooseLoginIdViaGate,
  dismissConsent,
  fillLoginId,
  fillSignIn,
  ko,
  launch,
  uniqueLoginId,
} from './helpers'
import { signOut } from './boardSteps'
import { waitForCode } from './mail'

/*
 * 첫 이메일 등록이 다시 인증(제공자 재동의)을 요구하는 길 - 「그 로그인이 연 세션, 1시간」 밖의 세션에서 시도할 때(백엔드 `email.first-registration-window`).
 * 표준 구성에서 만든다(면제 창을 0 으로 바꾼 별도 백엔드가 필요 없다): 같은 LINE 계정으로 **두 번째 브라우저 컨텍스트**가 로그인해 첫 번째 세션을 닫는다
 * (`DELETE /auth/sessions?keepCurrent=true` - 허용 목록의 `/auth/**`). 닫힌 세션은 면제가 없다 - 첫 컨텍스트의 액세스 토큰은 아직 살아 있어 주소를 보내 보면 `403 REAUTH_REQUIRED`.
 * 흐름: 주소 입력 -> 서버가 REAUTH_REQUIRED -> 「보안을 위해 한 번 더 확인해 주세요 ... LINE」 -> 단추 -> 계정 설정이 열리자마자 LINE 동의(새 PKCE verifier) ->
 * 돌아오면 설정의 이메일 구역이 인증번호를 보낸다 -> 메일함의 번호 -> 막이 걷히고 모든 구역이 열린다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const on = !!fakeUrl // 가짜 제공자를 끄면(E2E_FAKE_PROVIDERS=0) 소셜 시나리오는 건너뛴다
const stamp = Date.now()
const address = `e2e-reauth-${stamp}@example.com`
const seen = new Set<string>()

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

const run = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!on) return ctx.skip()
    await fn()
  })

describe('the first email after the exemption window: the provider confirms once more', () => {
  run('the screen explains it and offers the provider as a filled button', async () => {
    await fetch(`${fakeUrl}/control`, {
      method: 'POST',
      body: JSON.stringify({
        line: { sub: `U-reauth-${stamp}`, name: '재동의 시험', email: '' },
        deny: false,
      }),
    })
    // 첫 로그인: 아이디 → 약관 → 홈. 이메일은 쓰려 할 때 묻는다
    await page.goto(`${baseUrl}/login`)
    await dismissConsent(page)
    await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
    await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId('reauth'), true)
    await acceptLegalGate(page, apiUrl, true)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    // 다른 기기(두 번째 컨텍스트)가 같은 계정으로 로그인해 이 세션을 닫는다 - 이 탭의 액세스 토큰은 아직 살아 있다
    const other = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
    try {
      const otherPage = await other.newPage()
      await otherPage.goto(`${baseUrl}/login`)
      await dismissConsent(otherPage)
      await otherPage.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await otherPage.waitForFunction(() => !!window.localStorage.getItem('sample.accessToken'))
      const token = await otherPage.evaluate(() =>
        window.localStorage.getItem('sample.accessToken'),
      )
      const closed = await fetch(`${apiUrl}/api/v1/auth/sessions?keepCurrent=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      pwExpect(closed.status).toBe(204)
    } finally {
      await other.close()
    }
    // 이 탭에서 처음 쓰려 한다 - 쓰기 때의 이메일 막이 뜬다
    await page.goto(`${baseUrl}/board`)
    await page
      .getByRole('button', { name: ko('board.write'), exact: true })
      .first()
      .click()
    const gate = page.getByRole('dialog', { name: auth.emailRequiredWriteTitle })
    await gate
      .getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) })
      .fill(address)
    await gate.getByRole('button', { name: auth.emailRequiredSend }).click()
    await pwExpect(gate.getByText(auth.emailReauthNeeded('LINE'))).toBeVisible()
    // 제공자를 다녀오면 쓰던 내용이 사라진다 - 떠나기 전에 그렇게 말한다
    await pwExpect(gate.getByText(auth.emailRequiredReauthLosesDraft('LINE'))).toBeVisible()
    await pwExpect(
      gate.getByRole('button', { name: auth.reauthProviderButton('LINE') }),
    ).toBeVisible()
  })

  run(
    'the button sends the person straight to LINE (a NEW verifier), and back to the settings with the code step',
    async () => {
      const authorize = page.waitForRequest((r) => r.url().startsWith(`${fakeUrl}/line/authorize`))
      await page
        .getByRole('dialog', { name: auth.emailRequiredWriteTitle })
        .getByRole('button', { name: auth.reauthProviderButton('LINE') })
        .click()
      const q = new URL((await authorize).url()).searchParams
      pwExpect(q.get('redirect_uri')).toBe(`${baseUrl}/account/link-callback`)
      pwExpect(q.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
      await pwExpect(page).toHaveURL(/\/account$/)
      // 설정(이메일 등록 전): 주소가 먼저라 비밀번호 · 로그인 수단은 「이메일을 등록한 뒤에 할 수 있어요」 카드로 접혀 있다
      await pwExpect(page.getByText(auth.settingsNeedsEmail).first()).toBeVisible()
      const section = page.getByRole('region', { name: auth.sectionEmail })
      await pwExpect(section.getByLabel(auth.codeDigit(1, 6))).toBeVisible() // 인증번호 단계가 이어진다
    },
  )

  run(
    'the code from the mailbox finishes it: every section opens and the app is reachable',
    async () => {
      const code = await waitForCode(mailUrl, address, 'email-change', { seen })
      await page.getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await pwExpect(page.getByText(auth.emailChanged)).toBeVisible()
      await pwExpect(page.getByRole('heading', { name: auth.sectionMethods })).toBeVisible()
      await pwExpect(page.getByText(auth.settingsNeedsEmail)).toHaveCount(0)
      await page.goto(baseUrl)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    },
  )
})

/*
 * 오래된 세션에서 「이 계정 지우고 로그인 화면으로」: 서버가 버리기에도 제공자 재동의를 요구한다(스펙 9.5 - 쓰기 때 방식에서는 보통 이 길이다).
 * 막 -> 계정 설정 -> LINE 동의 -> 돌아오면 설정이 버리기를 이어 부르고, 끝나면 **패키지의 `AccountPage`** 가 로그아웃하고 로그인 화면으로 보낸다.
 * `/account` 는 `RequireAuth` 아래라 로그아웃이 끝나기 전에 이동하면 가드가 「돌아올 곳」 state 로 연결 의도를 덮는다 - 로그인하면 설정의 로그인 방법(`#methods`)에서 LINE 연결을 이어 가야 한다.
 */
describe('discarding after the exemption window: the provider confirms, then the sign-in carries the link intent to the settings', () => {
  const mail = `e2e-reauth-discard-${stamp}@example.com`
  const mailPassword = 'Passw0rd!x9'
  const sub = `U-reauth-discard-${stamp}`

  run('a mail account exists to sign back into', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(mail)
    await page.getByLabel(auth.displayName).fill('재동의 버리기')
    await fillLoginId(page, uniqueLoginId('rdmail'))
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

  run(
    'an old LINE session discards: the screen sends it to LINE, and after the round trip the sign-in page remembers the link',
    async () => {
      await fetch(`${fakeUrl}/control`, {
        method: 'POST',
        body: JSON.stringify({ line: { sub, name: '재동의 버리기', email: '' }, deny: false }),
      })
      await page.goto(`${baseUrl}/login`)
      await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId('rdline'), true)
      await acceptLegalGate(page, apiUrl, true)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      // 다른 기기가 같은 계정으로 로그인해 이 세션을 닫는다 - 이 세션은 「열린 지 1시간」 밖이다
      const other = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
      try {
        const otherPage = await other.newPage()
        await otherPage.goto(`${baseUrl}/login`)
        await dismissConsent(otherPage)
        await otherPage.getByRole('button', { name: 'LINE으로 계속하기' }).click()
        await otherPage.waitForFunction(() => !!window.localStorage.getItem('sample.accessToken'))
        const token = await otherPage.evaluate(() =>
          window.localStorage.getItem('sample.accessToken'),
        )
        const closed = await fetch(`${apiUrl}/api/v1/auth/sessions?keepCurrent=true`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        pwExpect(closed.status).toBe(204)
      } finally {
        await other.close()
      }
      await page.goto(`${baseUrl}/board`)
      await page
        .getByRole('button', { name: ko('board.write'), exact: true })
        .first()
        .click()
      const gate = page.getByRole('dialog', { name: auth.emailRequiredWriteTitle })
      await gate.getByRole('button', { name: auth.emailRequiredDiscard }).click()
      await page
        .getByRole('dialog', { name: auth.emailRequiredDiscardConfirmTitle })
        .getByRole('button', { name: auth.emailRequiredDiscardConfirm })
        .click()
      // 오래된 세션이라 버리기가 제공자 재동의를 요구한다 - 확인 창이 닫히고 그 제공자 단추가 나온다
      await gate.getByRole('button', { name: auth.reauthProviderButton('LINE') }).click()
      // 설정 -> LINE 동의 -> 돌아와 버리기를 이어 부르면 `AccountPage` 가 로그아웃하고 로그인 화면으로 보낸다
      await pwExpect(page).toHaveURL(/\/login/)
      pwExpect(
        await page.evaluate(() => window.localStorage.getItem('sample.accessToken')),
      ).toBeNull()
      await fillSignIn(page, { email: mail, password: mailPassword })
      await acceptLegalGate(page, apiUrl, false)
      // 연결 의도가 가드의 「돌아올 곳」에 덮이지 않았다 - 설정의 로그인 방법에서 LINE 연결을 이어 간다
      await pwExpect(page).toHaveURL(/\/account#methods$/)
      await pwExpect(page.getByText(auth.methodLinkContinue('LINE'))).toBeVisible()
    },
  )
})
