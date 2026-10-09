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
import { operatorPage } from './paymentSteps'

/*
 * 설정의 입력 동작이 대화상자로 뜨는 모습 증거 — 진짜 백엔드 · 진짜 메일 · 가짜 LINE 으로 설정을 밟으며 스크린샷을 남긴다:
 * 1280px(설정 전체 · 대화상자 5종 · 로그아웃 확인 · 구역 칩 이동 · 이메일 없는 계정의 수단 연결) / 375px(설정 · 대화상자 2종).
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

      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(`${baseUrl}/account`)
      const region = (name: string) => page.getByRole('region', { name })
      await region(ko('account.localeSection')).waitFor()
      await shot(
        page,
        '01-desktop-settings-read-state.png',
        '1280px 설정 전체 - 각 구역은 현재 값 + 단추만 보인다(입력 칸이 없다). 구역의 주 행동은 채워진 단추 하나, 위험한 삭제는 위험색.',
        undefined,
        true,
      )

      await region(ko('account.localeSection'))
        .getByRole('button', { name: ko('account.localeEdit') })
        .click()
      await shot(
        page,
        '02-desktop-profile-dialog.png',
        '프로필 수정 - 닉네임 · 언어 · 시간대 양식이 모달 대화상자로 뜬다. 뒤 페이지는 그 자리에 그대로다.',
      )
      await page.keyboard.press('Escape')

      await region(auth.sectionEmail).getByRole('button', { name: auth.emailChangeSubmit }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(auth.emailNew).fill(`e2e-shots-next-${stamp}@example.com`)
      await dialog.getByLabel(auth.currentPassword).fill(password)
      await shot(
        page,
        '03-desktop-email-dialog-form.png',
        '계정 이메일 변경 - 새 주소와 현재 비밀번호(본인 확인)를 대화상자 안에서 입력한다.',
      )
      await dialog.getByRole('button', { name: auth.emailChangeSubmit }).click()
      await dialog.getByText(auth.emailPendingTitle).waitFor()
      await shot(
        page,
        '04-desktop-email-dialog-code.png',
        '같은 대화상자 안에서 인증번호 단계로 이어진다(새 주소로 간 6자리).',
      )
      await page.keyboard.press('Escape')
      await shot(
        page,
        '05-desktop-email-continue-button.png',
        '닫은 뒤 · 새로고침 뒤에도 서버가 기억한 대기 상태는 팝업이 저절로 뜨지 않고 구역의 「인증번호 입력 이어 하기」 단추로 보인다.',
        region(auth.sectionEmail),
      )

      await region(auth.sectionPassword)
        .getByRole('button', { name: auth.passwordChangeSubmit })
        .click()
      await shot(page, '06-desktop-password-dialog.png', '비밀번호 바꾸기 대화상자.')
      await page.keyboard.press('Escape')

      await region(auth.sectionDelete).getByRole('button', { name: auth.deleteButton }).click()
      await page.getByRole('dialog').getByLabel(auth.currentPassword).fill(password)
      await shot(
        page,
        '07-desktop-delete-dialog.png',
        '계정 삭제 - 본인 확인과 「삭제」 직접 입력이 한 대화상자 안에 있고, 둘이 끝나기 전에는 삭제 단추가 꺼져 있다.',
      )
      await page.keyboard.press('Escape')

      // 구역 칩으로 이동 - 구역 제목이 고정 머리 밑에 깔리지 않는다
      const metrics = async (name: string) =>
        page.evaluate((id) => {
          const header = document.querySelector('header')!.getBoundingClientRect()
          const target = document.getElementById(id)!.getBoundingClientRect()
          const list = document.querySelector('nav[aria-label] ul, ul')
          return {
            headerBottom: Math.round(header.bottom),
            sectionTop: Math.round(target.top),
            overlapped: target.top < header.bottom,
            pageOverflowsX: document.documentElement.scrollWidth > window.innerWidth,
            chipRowWidth: list ? Math.round(list.getBoundingClientRect().width) : null,
            name: id,
          }
        }, name)
      await page.getByRole('link', { name: auth.sectionSessions }).click()
      await page.waitForTimeout(800)
      const desk = await metrics('sessions')
      await shot(
        page,
        '08-desktop-chip-jump.png',
        `구역 칩(「${auth.sectionSessions}」)으로 이동한 뒤 - 구역 제목이 머리 바로 밑에 선다. 측정: ${JSON.stringify(desk)}`,
      )

      // 375px
      await page.setViewportSize({ width: 375, height: 800 })
      await page.goto(`${baseUrl}/account`)
      await region(ko('account.localeSection')).waitFor()
      await shot(
        page,
        '09-phone-settings.png',
        '375px 설정 - 구역 칩은 한 줄 가로 스크롤, 페이지는 옆으로 밀리지 않는다.',
      )
      await page.getByRole('link', { name: auth.sectionSessions }).click()
      await page.waitForTimeout(800)
      const phone = await metrics('sessions')
      await shot(page, '10-phone-chip-jump.png', `375px 칩 이동 뒤. 측정: ${JSON.stringify(phone)}`)
      await region(auth.sectionPassword)
        .getByRole('button', { name: auth.passwordChangeSubmit })
        .click()
      await shot(
        page,
        '11-phone-password-dialog.png',
        '375px 비밀번호 대화상자 - 화면 안에 들고 옆으로 밀리지 않는다.',
      )
      await page.keyboard.press('Escape')

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
        await region(auth.sectionMethods).waitFor()
        await shot(
          page,
          '12-desktop-address-less-methods.png',
          '이메일 없는 LINE 계정의 설정 - 비밀번호 · 연락받을 이메일은 「이메일을 등록한 뒤에」 로 접히고, 로그인 수단은 열려 있어 다른 소셜(X)을 연결할 수 있다.',
          undefined,
          true,
        )
      }
      // 운영자 계정에게만 상단 메뉴에 운영 화면 항목이 보인다
      const operator = await operatorPage(browser, baseUrl)
      try {
        await operator.page.goto(baseUrl)
        await operator.page.getByRole('link', { name: '결제 관리' }).waitFor()
        await shot(
          operator.page,
          '13-operator-menu-desktop.png',
          '운영자 계정으로 로그인하면 상단 메뉴에 「결제 관리」 「계정 관리」가 보인다(일반 계정에는 없다).',
        )
        await operator.page.setViewportSize({ width: 375, height: 800 })
        await shot(
          operator.page,
          '14-operator-menu-375.png',
          '375px - 메뉴는 한 줄 가로 스크롤이고 페이지는 옆으로 밀리지 않는다.',
        )
      } finally {
        await operator.close()
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
