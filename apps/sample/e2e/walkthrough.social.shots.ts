import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Page } from 'playwright'
import { describe, inject, it } from 'vitest'
import { acceptLegalGate, auth, dismissConsent, launch } from './helpers'

/*
 * 글로벌 소셜 로그인 증거 — 가짜 LINE · X(`E2E_FAKE_PROVIDERS=1` 로 올린 소셜 백엔드)로: 로그인 화면(Google · LINE · X — 라이트 · 다크 · 모바일 390) · 주소 없는 계정의 설정.
 * 실행: `E2E_FAKE_PROVIDERS=1 E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample exec vitest run --config vitest.e2e.config.ts e2e/walkthrough.social.shots.ts`
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
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

    // 주소 없는 LINE 계정의 설정
    await fetch(`${fakeUrl}/control`, {
      method: 'POST',
      body: JSON.stringify({
        line: { sub: `U-evidence-${Date.now()}`, name: 'LINE 사용자' },
        deny: false,
      }),
    })
    const { browser, page } = await launch()
    try {
      await page.goto(`${baseUrl}/login`)
      await dismissConsent(page)
      await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await acceptLegalGate(page, apiUrl)
      await page.getByRole('heading', { level: 1, name: /안녕하세요/ }).waitFor()
      await page.goto(`${baseUrl}/account`)
      await page.getByRole('region', { name: auth.sectionEmail }).waitFor()
      await page.getByRole('region', { name: auth.sectionEmail }).scrollIntoViewIfNeeded()
      await page
        .getByRole('region', { name: auth.sectionEmail })
        .getByLabel(auth.emailNew)
        .fill('me@example.com')
      await shot(
        page,
        '13-settings-address-less.png',
        'LINE 으로만 가입한 계정의 설정 — 이메일 절은 빈 값 대신 「이 계정에는 이메일 주소가 없어요」, 「이메일 추가」는 LINE 동의를 다시 거친다(「LINE 로 확인」). 로그인 수단 목록에 LINE.',
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
