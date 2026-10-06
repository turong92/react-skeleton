import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Page } from 'playwright'
import { describe, inject, it } from 'vitest'
import { auth, dismissConsent, launch, legal, legalOn } from './helpers'
import { waitForCode, waitForLink } from './mail'

/*
 * 법적 문서 · 동의 증거 — legal 모듈이 있는 백엔드로: 가입 체크리스트 · 문서 다이얼로그 · 첫 로그인 동의 화면(재동의와 같은 화면) · 설정의 동의 절.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample exec vitest run --config vitest.e2e.config.ts e2e/walkthrough.legal.shots.ts`
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []

async function shot(page: Page, file: string, caption: string) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(out, file), fullPage: false })
  captions.push([file, caption])
}

describe('legal walkthrough', () => {
  it('sign-up checklist · document dialog · first sign-in consent · settings', async (ctx) => {
    if (!(await legalOn(apiUrl))) return ctx.skip()
    mkdirSync(out, { recursive: true })
    const stamp = Date.now()
    const email = `evidence-legal-${stamp}@example.com`
    const first = `evidence-legal-first-${stamp}@example.com`
    const seen = new Set<string>()
    const { browser, page } = await launch()
    try {
      await page.goto(`${baseUrl}/sign-up`)
      await dismissConsent(page)
      await page.getByLabel(auth.email).fill(email)
      await page.getByLabel(auth.password).first().fill('Correct-horse-9')
      await page.getByRole('checkbox', { name: /\[필수\] .*이용약관/ }).check()
      await shot(
        page,
        '20-sign-up-consents.png',
        '가입 — 서버의 문서 목록으로 만든 동의 체크리스트: 필수 둘(이용약관 · 개인정보)과 선택 하나(마케팅, 꺼진 채), 「전체 동의」는 일부만 켜져 mixed 상태.',
      )
      await page.getByRole('button', { name: /이용약관.* 보기/ }).click()
      await page
        .getByRole('dialog', { name: /이용약관/ })
        .getByText(/제1조/)
        .first()
        .waitFor()
      await shot(
        page,
        '21-document-dialog.png',
        '「보기」 — 서버가 준 마크다운을 다이얼로그로(판 · 시행일 · 「샘플 문서예요」 표시). 닫으면 포커스가 누른 「보기」로 돌아온다.',
      )
      await page
        .getByRole('dialog', { name: /이용약관/ })
        .getByRole('button', { name: legal.close })
        .click()
      await page.getByRole('checkbox', { name: legal.agreeAll }).check()
      await page.getByRole('button', { name: auth.signUpSubmit }).click()
      const code = await waitForCode(mailUrl, email, 'verify', { seen })
      await page.getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await page.getByRole('heading', { level: 1, name: /안녕하세요/ }).waitFor()
      await page.goto(`${baseUrl}/account`)
      const section = page.getByRole('region', { name: legal.settingsTitle })
      await section.waitFor()
      await section.scrollIntoViewIfNeeded()
      await section.getByRole('button', { name: legal.history }).click()
      await section.getByRole('table').waitFor()
      await shot(
        page,
        '23-consent-settings.png',
        '설정의 「약관 동의」 — 문서마다 상태 · 동의한 판과 시각 · 보기, 필수는 철회 불가 안내, 선택(마케팅)은 스위치로 철회/다시 동의, 아래에 이력.',
      )
      // 링크로 처음 들어온 계정 — 동의 화면이 앞을 막는다
      await page.evaluate(() => window.localStorage.clear())
      await page.goto(`${baseUrl}/login`)
      await page.getByRole('button', { name: auth.signInMagicLink }).click()
      await page.getByLabel(auth.email).fill(first)
      await page.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
      const link = await waitForLink(mailUrl, first, 'magic-link', { seen })
      await page.goto(`${baseUrl}${link.path}`)
      await page.getByRole('dialog', { name: legal.firstConsentTitle }).waitFor()
      await shot(
        page,
        '22-reconsent-interstitial.png',
        '링크로 처음 들어온 계정(동의 기록 없음) — 앱 위를 덮는 동의 화면. 새 판이 시행됐을 때(403 LEGAL.RECONSENT_REQUIRED)도 같은 화면이고, 동의하면 막혔던 호출이 그대로 이어진다.',
      )
    } finally {
      await browser.close()
      writeFileSync(
        join(out, 'captions-legal.md'),
        `# 약관 · 동의 — 진짜 legal 백엔드 증거\n\n${captions.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
    }
  })
})
