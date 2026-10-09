import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Locator, Page } from 'playwright'
import { describe, inject, it } from 'vitest'
import {
  acceptLegalGate,
  agreeToLegal,
  auth,
  chooseLoginIdViaGate,
  dismissConsent,
  fillLoginId,
  ko,
  launch,
  uniqueLoginId,
} from './helpers'
import { waitForCode } from './mail'

/*
 * 설정이 카드 3장 · 항목 한 줄씩이고 목록 · 입력은 대화상자로 뜨는 모습 증거 — 진짜 백엔드 · 진짜 메일 · 가짜 LINE 으로 설정을 밟으며 스크린샷을 남긴다:
 * 1280px(설정 전체 · 로그인 수단 · 기기 · 약관 대화상자 · 이메일 없는 계정) / 375px(설정 · 대화상자 2종) + 320px 가로 밀림 측정.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample walkthrough` (가짜 제공자가 꺼져 있으면 마지막 장면은 건너뛴다). `captions.md` 에 파일 → 한 줄 설명.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []
const seen = new Set<string>()
const stamp = Date.now()
const mail = `e2e-shots-${stamp}@example.com`
const password = 'Passw0rd!x9'
// 약관 동의 줄의 이름 · 단추(`@skeleton/legal` ko 사전)
const legalTitle = '약관 동의'
const legalView = '보기'

async function shot(page: Page, file: string, caption: string, target?: Locator, fullPage = false) {
  await page.waitForTimeout(600)
  if (target) await target.screenshot({ path: join(out, file) })
  else await page.screenshot({ path: join(out, file), fullPage })
  captions.push([file, caption])
}

describe('settings dialogs walkthrough', () => {
  it('captures the settings read states and every dialog, desktop and phone', async () => {
    mkdirSync(out, { recursive: true })
    const { browser, page } = await launch()
    try {
      // 메일 가입 계정 하나(비밀번호 있음)
      await page.goto(`${baseUrl}/sign-up`)
      await dismissConsent(page)
      await page.getByLabel(auth.email).fill(mail)
      await page.getByLabel(auth.displayName).fill('설정 증거')
      await fillLoginId(page, uniqueLoginId('shots'))
      await page.getByLabel(auth.password).first().fill(password)
      await page.getByLabel(auth.passwordConfirm).fill(password)
      await agreeToLegal(page, apiUrl)
      await page.getByRole('button', { name: auth.signUpSubmit }).click()
      const verify = await waitForCode(mailUrl, mail, 'verify', { seen })
      await page.getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(verify.code)
      await page.getByRole('heading', { level: 1, name: /안녕하세요/ }).waitFor()

      const group = (name: string) => page.getByRole('group', { name })
      const overflows = () =>
        page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      const open = async (row: string, button: string) => {
        await group(row).getByRole('button', { name: button }).click()
        return page.getByRole('dialog').last()
      }

      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(`${baseUrl}/account`)
      await group(ko('account.localeSection')).waitFor()
      await shot(
        page,
        '01-desktop-settings.png',
        '1280px 설정 전체 - 카드 3장(계정 · 로그인·보안 · 환경), 카드 안은 항목 한 줄씩(이름 · 현재 값 · 테두리 단추). 위험한 삭제만 위험색.',
        undefined,
        true,
      )

      await open(auth.sectionMethods, `${auth.sectionMethods} ${auth.rowManage}`)
      await shot(
        page,
        '02-desktop-methods-dialog.png',
        '로그인 수단 「관리」 - 수단 목록과 연결 단추가 대화상자 안에 있다(줄에는 수단 이름만).',
      )
      await page.keyboard.press('Escape')

      await open(auth.sectionSessions, `${auth.sectionSessions} ${auth.rowView}`)
      await shot(
        page,
        '03-desktop-sessions-dialog.png',
        '로그인한 기기 「보기」 - 기기 목록과 로그아웃이 대화상자 안에 있다(줄에는 기기 수만).',
      )
      await page.keyboard.press('Escape')

      await open(legalTitle, `${legalTitle} ${legalView}`)
      await shot(
        page,
        '04-desktop-consents-dialog.png',
        '약관 동의 「보기」 - 동의 목록 · 선택 동의 토글 · 이력이 대화상자 안에 있다.',
      )
      await page.keyboard.press('Escape')

      // 375px · 320px
      await page.setViewportSize({ width: 375, height: 800 })
      await page.goto(`${baseUrl}/account`)
      await group(ko('account.localeSection')).waitFor()
      const over375 = await overflows()
      await shot(
        page,
        '06-phone-settings.png',
        `375px 설정 - 줄은 이름이 위, 값과 단추가 아래로 접힌다. 가로로 밀림: ${over375}`,
        undefined,
        true,
      )
      await open(auth.sectionMethods, `${auth.sectionMethods} ${auth.rowManage}`)
      await shot(page, '07-phone-methods-dialog.png', '375px 로그인 수단 대화상자.')
      await page.keyboard.press('Escape')
      await open(auth.sectionSessions, `${auth.sectionSessions} ${auth.rowView}`)
      await shot(page, '08-phone-sessions-dialog.png', '375px 로그인한 기기 대화상자.')
      await page.keyboard.press('Escape')
      await page.setViewportSize({ width: 320, height: 700 })
      await page.goto(`${baseUrl}/account`)
      await group(ko('account.localeSection')).waitFor()
      captions.push(['(측정)', `320px 설정 - 가로로 밀림: ${await overflows()}`])

      // 이메일 없는 소셜 계정: 로그인 수단은 열려 있고 비밀번호 · 연락받을 이메일은 접힌다
      if (fakeUrl) {
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.evaluate(() => window.localStorage.clear())
        await fetch(`${fakeUrl}/control`, {
          method: 'POST',
          body: JSON.stringify({
            line: { sub: `U-shots-${stamp}`, name: '연결 증거', email: '' },
            deny: false,
          }),
        })
        await page.goto(`${baseUrl}/login`)
        await dismissConsent(page)
        await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
        await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId('shotsline'), true)
        await acceptLegalGate(page, apiUrl, true)
        await page.getByRole('heading', { level: 1, name: /안녕하세요/ }).waitFor()
        await page.goto(`${baseUrl}/account`)
        await group(auth.sectionMethods).waitFor()
        await shot(
          page,
          '05-desktop-address-less.png',
          '이메일 없는 LINE 계정의 설정 - 계정 이메일은 「없음 · 이메일 등록」, 비밀번호 줄은 「이메일을 등록한 뒤에」 + 이메일 등록 단추, 로그인 수단은 그대로 「관리」.',
          undefined,
          true,
        )
      }
    } finally {
      await browser.close()
    }
    writeFileSync(
      join(out, 'captions.md'),
      captions.map(([file, text]) => `- ${file} - ${text}`).join('\n') + '\n',
    )
  })
})
