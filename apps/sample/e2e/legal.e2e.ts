import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { auth, dismissConsent, ko, launch, legal, legalOn } from './helpers'
import { waitForCode, waitForLink } from './mail'

/*
 * 약관 · 동의 여정(백엔드 legal 모듈 — 계약 docs/legal-http-contract.md) — 모듈이 없는 백엔드(출시된 것)에서는 통째로 건너뛴다.
 * 가입 폼의 체크리스트(필수 못 넘김 · 문서 다이얼로그 · 보낸 `consents` 의 판 · 언어) → 가입한 계정은 동의가 기록돼 막지 않는다 → 설정의 동의 절(선택 동의 철회 · 이력) →
 * 링크로 처음 들어온 계정은 동의 화면이 막고 동의하면 이어진다 → (재동의 필터를 켠 백엔드, `E2E_LEGAL_RECONSENT=1`) 서버가 403 `LEGAL.RECONSENT_REQUIRED` 로 막은 호출이 동의 뒤 그대로 나간다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const stamp = Date.now()
const seen = new Set<string>()
const withFilter = process.env.E2E_LEGAL_RECONSENT === '1'

let browser: Browser
let page: Page
let on = false
beforeAll(async () => {
  on = await legalOn(apiUrl)
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

const email = `e2e-legal-${stamp}@example.com`
const password = 'Correct-horse-9'

describe('sign-up consent checklist', () => {
  run(
    'required items block the submit; the document opens in a dialog; the sign-up request carries the shown versions',
    async () => {
      await page.goto(`${baseUrl}/sign-up`)
      await dismissConsent(page)
      await page.getByLabel(auth.email).fill(email)
      await page.getByLabel(auth.password).first().fill(password)
      await page.getByLabel(auth.passwordConfirm).fill(password)
      await pwExpect(page.getByRole('checkbox', { name: legal.agreeAll })).toBeVisible()
      await pwExpect(page.getByRole('checkbox', { name: /\[필수\] .*이용약관/ })).toBeVisible()
      await pwExpect(page.getByRole('checkbox', { name: /\[필수\] .*개인정보/ })).toBeVisible()
      const marketing = page.getByRole('checkbox', { name: /\[선택\]/ })
      await pwExpect(marketing).not.toBeChecked() // 선택은 꺼진 채

      // 필수를 안 켜고 제출 — 서버로 가지 않고 줄에 오류
      let signUps = 0
      page.on('request', (r) => r.url().endsWith('/account/sign-up') && signUps++)
      await page.getByRole('button', { name: auth.signUpSubmit }).click()
      await pwExpect(page.getByText(legal.requiredError).first()).toBeVisible()
      pwExpect(signUps).toBe(0)

      // 문서 다이얼로그 — 서버의 마크다운, 판 · 효력일, 샘플 표시
      await page.getByRole('button', { name: /이용약관.* 보기/ }).click()
      const dialog = page.getByRole('dialog', { name: /이용약관/ })
      await pwExpect(dialog.getByText(/sample-1 판/)).toBeVisible()
      await pwExpect(dialog.getByText(/제1조/).first()).toBeVisible()
      await dialog.getByRole('button', { name: legal.close }).click()
      await pwExpect(dialog).toBeHidden()

      // 전체 동의 후 제출 — 요청에 종류 · 판 · 언어
      await page.getByRole('checkbox', { name: legal.agreeAll }).check()
      const sent = page.waitForRequest((r) => r.url().endsWith('/account/sign-up'))
      await page.getByRole('button', { name: auth.signUpSubmit }).click()
      const body = (await sent).postDataJSON() as {
        consents: Array<{ type: string; version: string; locale: string }>
      }
      pwExpect(body.consents.map((c) => c.type).sort()).toEqual(['marketing', 'privacy', 'terms'])
      pwExpect(body.consents.every((c) => c.version === 'sample-1' && c.locale === 'ko')).toBe(true)
      await pwExpect(page.getByRole('heading', { level: 2, name: auth.codeTitle })).toBeVisible()
    },
  )

  run(
    'verifying the code signs in at once and the account is already consented (no consent screen)',
    async () => {
      const code = await waitForCode(mailUrl, email, 'verify', { seen })
      await page.getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      await pwExpect(page.getByRole('dialog', { name: legal.firstConsentTitle })).toHaveCount(0)
      const token = await page.evaluate(() => window.localStorage.getItem('sample.accessToken'))
      const mine = await (
        await fetch(`${apiUrl}/api/v1/legal/consents/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).json()
      pwExpect(mine.value.blocked).toBe(false)
    },
  )

  run(
    'settings: agreed documents with their version, optional consent can be withdrawn and given again, history lists both',
    async () => {
      await page.goto(`${baseUrl}/account`)
      const section = page.getByRole('region', { name: legal.settingsTitle })
      await pwExpect(section.getByText(legal.state.CURRENT).first()).toBeVisible()
      await pwExpect(section.getByText(legal.cannotWithdraw).first()).toBeVisible() // 필수는 철회 불가
      const toggle = section.getByRole('switch')
      await pwExpect(toggle).toBeChecked()
      await toggle.click()
      await pwExpect(toggle).not.toBeChecked()
      await pwExpect(section.getByText(legal.state.WITHDRAWN)).toBeVisible()
      await section.getByRole('button', { name: legal.history }).click()
      const table = section.getByRole('table', { name: legal.history })
      await pwExpect(table.getByText(legal.historyAction.WITHDRAWN)).toBeVisible()
      await toggle.click()
      await pwExpect(toggle).toBeChecked()
    },
  )

  run('/terms shows the backend document (not the file) with its version', async () => {
    await page.goto(`${baseUrl}/terms`)
    await pwExpect(page.getByRole('heading', { level: 1 })).toContainText('이용약관')
    await pwExpect(page.getByText(/sample-1 판/).first()).toBeVisible()
  })
})

describe('first sign-in without a consent (link login creates the account with none)', () => {
  const first = `e2e-legal-first-${stamp}@example.com`
  run(
    'the consent screen covers the app; required rows must be ticked; then the app continues',
    async () => {
      await page.context().clearCookies()
      await page.evaluate(() => window.localStorage.clear())
      await page.goto(`${baseUrl}/login`)
      await page.getByRole('button', { name: auth.signInMagicLink }).click()
      await page.getByLabel(auth.email).fill(first)
      await page.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
      const link = await waitForLink(mailUrl, first, 'magic-link', { seen })
      await page.goto(`${baseUrl}${link.path}`)
      const gate = page.getByRole('dialog', { name: legal.firstConsentTitle })
      await pwExpect(gate).toBeVisible()
      await pwExpect(gate.getByText(legal.reconsentBodyFirstSignIn)).toBeVisible()
      await gate.getByRole('button', { name: legal.reconsentSubmit }).click() // 체크 없이
      await pwExpect(gate.getByText(legal.requiredError).first()).toBeVisible()
      await gate.getByRole('button', { name: /이용약관.* 보기/ }).click()
      await pwExpect(
        page
          .getByRole('dialog', { name: /이용약관/ })
          .getByText(/제1조/)
          .first(),
      ).toBeVisible()
      await page
        .getByRole('dialog', { name: /이용약관/ })
        .getByRole('button', { name: legal.close })
        .click()
      await gate.getByRole('checkbox', { name: /\[필수\] .*이용약관/ }).check()
      await gate.getByRole('checkbox', { name: /\[필수\] .*개인정보/ }).check()
      await gate.getByRole('button', { name: legal.reconsentSubmit }).click()
      await pwExpect(gate).toBeHidden()
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      await pwExpect(page.locator('[inert]')).toHaveCount(0)
    },
  )

  run('leaving the consent screen signs out', async () => {
    const other = `e2e-legal-leave-${stamp}@example.com`
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: auth.signInMagicLink }).click()
    await page.getByLabel(auth.email).fill(other)
    await page.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
    const link = await waitForLink(mailUrl, other, 'magic-link', { seen })
    await page.goto(`${baseUrl}${link.path}`)
    const gate = page.getByRole('dialog', { name: legal.firstConsentTitle })
    await pwExpect(gate).toBeVisible()
    await gate.getByRole('button', { name: legal.reconsentLeave }).click()
    await pwExpect(gate).toBeHidden()
    await pwExpect(page.getByRole('link', { name: ko('header.signIn') }).first()).toBeVisible()
  })
})

describe('re-consent filter (backend started with skeleton.legal.reconsent.enabled=true)', () => {
  const blocked = `e2e-legal-403-${stamp}@example.com`
  it('a call the server blocks with 403 LEGAL.RECONSENT_REQUIRED resumes after the agreement — the user is not signed out', async (ctx) => {
    if (!on || !withFilter) return ctx.skip()
    await page.evaluate(() => window.localStorage.clear())
    // 로그인 직후 확인(`/consents/me`)이 「문제없음」이라고 하게 가려서, 서버가 막는 쪽(403)만 시험한다
    await page.route('**/api/v1/legal/consents/me', (route) =>
      route.fulfill({
        json: { value: { blocked: false, items: [], missing: [] }, meta: { timestamp: 't' } },
      }),
    )
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: auth.signInMagicLink }).click()
    await page.getByLabel(auth.email).fill(blocked)
    await page.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
    const link = await waitForLink(mailUrl, blocked, 'magic-link', { seen })
    await page.goto(`${baseUrl}${link.path}`)
    // 링크가 로그인시키고 대시보드로 보낸다 — 대시보드의 보호된 호출이 동의가 없어 403 으로 막힌다(첫 로그인 확인은 위에서 가렸다)
    const gate = page.getByRole('dialog', { name: legal.firstConsentTitle })
    await pwExpect(gate).toBeVisible()
    await pwExpect(gate.getByText(legal.reconsentBodyFirstSignIn)).toBeVisible() // 한 번도 동의한 적이 없다(NOT_AGREED) — 처음 동의 문구
    await gate.getByRole('checkbox', { name: legal.agreeAll }).check()
    await gate.getByRole('button', { name: legal.reconsentSubmit }).click()
    await pwExpect(gate).toBeHidden()
    // 막혔던 목록 호출이 그대로 나가 화면이 채워진다 — 로그인 화면으로 쫓겨나지 않았다
    await page.unroute('**/api/v1/legal/consents/me')
    await pwExpect(page).not.toHaveURL(/\/login/)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await pwExpect(page.locator('[inert]')).toHaveCount(0)
  })
})
