import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { acceptLegalGate, auth, dismissConsent, launch } from './helpers'
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
    const signInWithLine = async (target: Page) => {
      await target.goto(`${baseUrl}/login`)
      await dismissConsent(target)
      await target.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await pwExpect(target.getByRole('dialog', { name: auth.emailRequiredTitle })).toBeVisible()
    }
    await signInWithLine(page)
    // 다른 기기(두 번째 컨텍스트)가 같은 계정으로 로그인해 이 세션을 닫는다 - 이 탭의 액세스 토큰은 아직 살아 있다
    const other = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' })
    try {
      const otherPage = await other.newPage()
      await signInWithLine(otherPage)
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
    const gate = page.getByRole('dialog', { name: auth.emailRequiredTitle })
    await gate
      .getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) })
      .fill(address)
    await gate.getByRole('button', { name: auth.emailRequiredSend }).click()
    await pwExpect(gate.getByText(auth.emailReauthNeeded('LINE'))).toBeVisible()
    await pwExpect(
      gate.getByRole('button', { name: auth.reauthProviderButton('LINE') }),
    ).toBeVisible()
  })

  run(
    'the button sends the person straight to LINE (a NEW verifier), and back to the settings with the code step',
    async () => {
      const authorize = page.waitForRequest((r) => r.url().startsWith(`${fakeUrl}/line/authorize`))
      await page
        .getByRole('dialog', { name: auth.emailRequiredTitle })
        .getByRole('button', { name: auth.reauthProviderButton('LINE') })
        .click()
      const q = new URL((await authorize).url()).searchParams
      pwExpect(q.get('redirect_uri')).toBe(`${baseUrl}/account/link-callback`)
      pwExpect(q.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
      await pwExpect(page).toHaveURL(/\/account$/)
      // 설정(이메일 등록 전): 이메일 등록과 계정 삭제만
      await pwExpect(page.getByText(auth.emailRequiredSettingsNotice)).toBeVisible()
      await pwExpect(page.getByRole('heading', { name: auth.sectionMethods })).toHaveCount(0)
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
      await acceptLegalGate(page, apiUrl)
      await page.goto(baseUrl)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    },
  )
})
