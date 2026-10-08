import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Page } from 'playwright'
import { describe, inject, it } from 'vitest'
import { auth, dismissConsent, launch } from './helpers'

/*
 * 글로벌 소셜 로그인 증거 — 가짜 LINE · X(기본으로 올라오는 소셜 백엔드)로: 로그인 화면(Google · LINE · X — 라이트 · 다크 · 모바일 390) · 주소 없는 계정의 설정.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample exec vitest run --config vitest.e2e.config.ts e2e/walkthrough.social.shots.ts`
 */
const baseUrl = inject('baseUrl')
const fakeUrl = inject('fakeUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []

async function shot(page: Page, file: string, caption: string) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(out, file), fullPage: false })
  captions.push([file, caption])
}

describe('social sign-in walkthrough', () => {
  it('login screen with Google / LINE / X (light · dark · mobile) and the settings of an address-less account', async (ctx) => {
    if (!fakeUrl) return ctx.skip()
    mkdirSync(out, { recursive: true })
    const light = await launch()
    try {
      await light.page.goto(`${baseUrl}/login`)
      await dismissConsent(light.page)
      await light.page.getByRole('button', { name: 'X로 계속하기' }).waitFor()
      await shot(
        light.page,
        '10-login-providers-light.png',
        '로그인 — Google · LINE · X 버튼은 백엔드의 GET /auth/methods 가 준 제공자와 순서대로(마크는 제공자 코드로, 문구는 「Google로 / LINE으로 / X로 계속하기」). 라이트.',
      )
      await light.page.setViewportSize({ width: 390, height: 844 })
      await shot(
        light.page,
        '11-login-providers-mobile.png',
        '같은 화면, 모바일(390px) — 버튼이 한 줄씩 가득 차고 가로 스크롤이 없다.',
      )
    } finally {
      await light.browser.close()
    }
    const dark = await launch({ colorScheme: 'dark' })
    try {
      await dark.page.goto(`${baseUrl}/login`)
      await dismissConsent(dark.page)
      await dark.page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
      await dark.page.getByRole('button', { name: 'X로 계속하기' }).waitFor()
      await shot(
        dark.page,
        '12-login-providers-dark.png',
        '다크 — X 마크는 글자색을 따라 흰색, Google · LINE 마크는 브랜드 색 그대로.',
      )
    } finally {
      await dark.browser.close()
    }

    // 주소 없는 LINE 계정 — 이메일 필수 앱이면 앱 대신 「이메일을 등록해 주세요」
    await fetch(`${fakeUrl}/control`, {
      method: 'POST',
      body: JSON.stringify({
        line: { sub: `U-evidence-${Date.now()}`, name: 'LINE 사용자', email: '' },
        deny: false,
      }),
    })
    const { browser, page } = await launch()
    try {
      await page.goto(`${baseUrl}/login`)
      await dismissConsent(page)
      await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await page.getByRole('dialog', { name: auth.emailRequiredTitle }).waitFor()
      await shot(
        page,
        '13-email-required.png',
        'LINE 으로만 가입한 계정(주소 없음) — 이메일이 필수인 앱은 앱 대신 「이메일을 등록해 주세요」 전면 화면이 덮는다(주소 → 메일함의 인증번호 → 약관 → 홈).',
      )
    } finally {
      await browser.close()
      writeFileSync(
        join(out, 'captions-social.md'),
        `# 글로벌 소셜 로그인 — 가짜 LINE · X + 진짜 소셜 백엔드 증거\n\n${captions.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
    }
  })
})
