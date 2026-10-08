import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { acceptLegalGate, auth, dismissConsent, launch } from './helpers'
import { waitForCode } from './mail'

/*
 * 첫 이메일 등록이 다시 인증(제공자 재동의)을 요구하는 길 — 마지막 로그인이 `email.first-registration-window`(기본 1시간)를 넘었을 때.
 * 그 시각은 서버가 로그인 때 적으므로 표준 구성으로는 만들 수 없다: 백엔드를 `E2E_EMAIL_REAUTH_WINDOW=PT0S`(면제 없음)로 띄우는 두 번째 판이 이 파일만 돈다 —
 * `pnpm e2e` 가 `e2e:main` 다음 `e2e:reauth` 로 차례로 돈다(CI 의 `pnpm e2e:sample` 도 같다). 한 판만: `pnpm --filter sample e2e:reauth`.
 * (그 구성에서는 면제를 시험하는 다른 파일이 맞지 않아 이 파일만 돈다. 가짜 제공자를 끄면 건너뛴다.)
 * 흐름: 주소 입력 → 서버가 REAUTH_REQUIRED → 「보안을 위해 LINE 로 한 번 더 확인해 주세요」 → 단추 → 계정 설정이 열리자마자 LINE 동의(새 PKCE verifier) →
 * 돌아오면 설정의 이메일 구역이 인증번호를 보낸다 → 메일함의 번호 → 막이 걷히고 모든 구역이 열린다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const on = !!fakeUrl
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
    await page.goto(`${baseUrl}/login`)
    await dismissConsent(page)
    await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
    const gate = page.getByRole('dialog', { name: auth.emailRequiredTitle })
    await pwExpect(gate).toBeVisible()
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
