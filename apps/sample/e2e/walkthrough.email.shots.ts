import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Locator, Page } from 'playwright'
import { describe, inject, it } from 'vitest'
import { acceptLegalGate, auth, dismissConsent, launch } from './helpers'
import { waitForCode } from './mail'

/*
 * 이메일 필수 증거 — 진짜 백엔드(`email.required` · `contact-email.enabled`) · 진짜 메일(mailpit) · 가짜 LINE(주소를 안 준다)으로 밟으며 한국어 화면을 남긴다:
 * 강제 화면(데스크톱 · 375) → 이미 쓰인 주소 안내 → 인증번호 입력 → (등록 전) 설정: 이메일 등록과 삭제만 → 등록 뒤 설정의 두 이메일 구역(연락받을 이메일 없음 · 입력 중 · 있음).
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample walkthrough`. `captions-email.md` 에 파일 → 한 줄 설명.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []
const seen = new Set<string>()

async function shot(page: Page, file: string, caption: string, target?: Locator) {
  await page.waitForTimeout(700)
  if (target) await target.screenshot({ path: join(out, file) })
  else await page.screenshot({ path: join(out, file), fullPage: false })
  captions.push([file, caption])
}

const gate = (page: Page) => page.getByRole('dialog', { name: auth.emailRequiredTitle })
const field = (page: Page) =>
  gate(page).getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) })

describe('email required walkthrough', () => {
  it('gate (desktop · 375) → taken address hint → code → settings before/after → contact email', async (ctx) => {
    if (!fakeUrl) return ctx.skip()
    mkdirSync(out, { recursive: true })
    const stamp = Date.now()
    const address = `evidence-reg-${stamp}@example.com`
    const contact = `evidence-news-${stamp}@example.com`
    await fetch(`${fakeUrl}/control`, {
      method: 'POST',
      body: JSON.stringify({
        line: { sub: `U-evidence-email-${stamp}`, name: '시험', email: '' },
        deny: false,
      }),
    })
    const { browser, page } = await launch()
    try {
      await page.goto(`${baseUrl}/login`)
      await dismissConsent(page)
      await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
      await gate(page).waitFor()
      await shot(
        page,
        '01-email-required-desktop.png',
        '이메일을 등록해 주세요 — 주소 없는 계정(LINE)이 로그인하면 앱 대신 덮는 전면 화면. 이유 한 줄 · 채운 「인증번호 받기」 · 로그아웃 · 내 계정 삭제.',
      )
      await page.setViewportSize({ width: 375, height: 760 })
      await shot(
        page,
        '02-email-required-375.png',
        '같은 화면 375px — 가로로 밀리지 않고 단추가 칸을 채운다.',
      )
      await page.setViewportSize({ width: 1280, height: 800 })

      // 이미 남이 쓰는 주소
      await field(page).fill('user@example.com')
      await gate(page).getByRole('button', { name: auth.emailRequiredSend }).click()
      await gate(page).getByText(auth.emailRequiredCodeTitle).waitFor()
      await shot(
        page,
        '03-taken-address-hint-desktop.png',
        '이미 다른 계정이 쓰는 주소를 적으면 — 서버는 똑같이 받아 주고 번호는 가지 않는다. 번호 입력 아래에 「번호가 안 오면 그 주소로 이미 가입한 계정이 있을 수 있어요…」 안내.',
      )
      await page.setViewportSize({ width: 375, height: 800 })
      await shot(page, '04-taken-address-hint-375.png', '같은 안내 375px.')
      await page.setViewportSize({ width: 1280, height: 800 })
      await gate(page).getByRole('button', { name: auth.emailRequiredFixAddress }).click()

      // 맞는 주소 — 인증번호 입력
      await field(page).fill(address)
      await gate(page).getByRole('button', { name: auth.emailRequiredSend }).click()
      await gate(page).getByText(auth.emailRequiredCodeTitle).waitFor()
      await waitForCode(mailUrl, address, 'email-change', { seen }) // 이 번호는 쓰지 않는다 — 아래에서 새로 받는다(옛 번호를 집지 않게 본 것으로 표시)
      await shot(
        page,
        '05-code-entry-desktop.png',
        '인증번호 입력 — 서버가 준 만료 시각으로 남은 시간을 센다. 다시 받기 · 주소 고치기. (아래 「안 오면」 안내는 늘 있다.)',
      )
      await page.setViewportSize({ width: 375, height: 800 })
      await shot(
        page,
        '06-code-entry-375.png',
        '인증번호 입력 375px — 여섯 칸이 줄어들어 가로로 밀리지 않는다.',
      )
      await page.setViewportSize({ width: 320, height: 700 })
      await shot(page, '07-code-entry-320.png', '인증번호 입력 320px.')
      await page.setViewportSize({ width: 1280, height: 800 })

      // 이미 계정이 있나요? - 빈 계정을 지우는 길(위험색 테두리) · 확인 한 번
      const discard = gate(page).getByRole('button', { name: auth.emailRequiredDiscard })
      await discard.scrollIntoViewIfNeeded()
      await shot(
        page,
        '07b-discard-path-desktop.png',
        '「이미 계정이 있나요?」 - 이 주소로 이미 가입한 계정이 있으면 지금 만든 빈 계정을 지우고 그 계정으로 로그인해 설정에서 연결한다. 위험색 테두리.',
      )
      await page.setViewportSize({ width: 375, height: 800 })
      await discard.scrollIntoViewIfNeeded()
      await shot(page, '07c-discard-path-375.png', '「이미 계정이 있나요?」 375px.')
      await discard.click()
      await page.getByRole('dialog', { name: auth.emailRequiredDiscardConfirmTitle }).waitFor()
      await shot(
        page,
        '07d-discard-confirm-375.png',
        '지우기 확인 375px - 유예 없이 되돌릴 수 없다고 말하고 한 번 더 묻는다.',
      )
      await page.setViewportSize({ width: 1280, height: 800 })
      await shot(page, '07e-discard-confirm-desktop.png', '지우기 확인.')
      await page
        .getByRole('dialog', { name: auth.emailRequiredDiscardConfirmTitle })
        .getByRole('button', { name: auth.cancel })
        .click()

      // 등록 전 설정: 이메일 등록과 삭제만
      await page.goto(`${baseUrl}/account`)
      await page.getByText(auth.emailRequiredSettingsNotice).waitFor()
      await shot(
        page,
        '08-settings-before-email.png',
        '이메일 등록 전의 계정 설정 — 이메일 등록과 계정 삭제 구역만(나머지는 서버가 403).',
      )

      // 돌아가 통과
      await page.goto(baseUrl)
      await gate(page).waitFor()
      // 새로고침해도 서버가 기억한 대기 중 변경(`me.pendingEmail`)으로 인증번호 단계가 돌아온다 - 주소 입력으로 돌아가지 않는다
      await gate(page).getByText(auth.emailRequiredCodeTitle).waitFor()
      await shot(
        page,
        '07f-code-step-restored-after-reload.png',
        '새로고침한 뒤 - 서버가 기억한 대기 중 이메일 변경으로 인증번호 단계가 그대로 돌아온다.',
      )
      await gate(page).getByRole('button', { name: auth.emailRequiredFixAddress }).click()
      await field(page).fill(address)
      await gate(page).getByRole('button', { name: auth.emailRequiredSend }).click()
      const code = await waitForCode(mailUrl, address, 'email-change', { seen })
      await gate(page).getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await gate(page).waitFor({ state: 'detached' })
      await acceptLegalGate(page, apiUrl, true)
      await page.getByRole('heading', { level: 1, name: /안녕하세요/ }).waitFor()

      // 설정의 두 이메일 구역
      await page.goto(`${baseUrl}/account`)
      const accountEmail = page.getByRole('region', { name: auth.sectionEmail })
      const contactSection = page.getByRole('region', { name: auth.sectionContactEmail })
      await contactSection.waitFor()
      // 고정 머리글 아래에 구역 윗부분이 가리지 않게 — 계정 이메일 구역이 화면 위쪽에 오도록 맞춘다
      const showBoth = () =>
        accountEmail.evaluate((el) => {
          el.scrollIntoView({ block: 'start' })
          window.scrollBy(0, -84)
        })
      await showBoth()
      await shot(
        page,
        '09-settings-two-emails-none.png',
        '설정의 두 이메일 구역 — 「계정 이메일」(쓰임 한 줄 · 지울 수 없다는 문구) / 「연락받을 이메일」(선택 · 없으면 「계정 이메일로 받아요」 · 채운 「연락받을 이메일 등록」).',
      )
      await shot(page, '10-account-email.png', '계정 이메일 구역.', accountEmail)
      await contactSection.getByRole('button', { name: auth.contactEmailAdd }).click()
      await contactSection.getByLabel(auth.contactEmailField).fill(contact)
      await shot(
        page,
        '11-contact-email-entering.png',
        '연락받을 이메일 등록 — 주소를 적고 「인증번호 받기」.',
        contactSection,
      )
      await contactSection.getByRole('button', { name: auth.contactEmailSend }).click()
      await contactSection.getByText(auth.contactEmailCodeTitle).waitFor()
      await shot(
        page,
        '12-contact-email-code.png',
        '그 주소로 간 인증번호 입력(같은 입력).',
        contactSection,
      )
      const contactCode = await waitForCode(mailUrl, contact, 'contact-email', { seen })
      await contactSection.getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(contactCode.code)
      await contactSection.getByText(auth.contactEmailSaved).waitFor()
      await showBoth()
      await shot(
        page,
        '13-settings-two-emails-set.png',
        '연락받을 이메일이 등록된 설정 — 알림 받는 곳 · 보안 메일은 늘 계정 이메일 · 눌리는 「바꾸기」 「지우기」.',
      )
      await page.setViewportSize({ width: 375, height: 800 })
      await contactSection.evaluate((el) => {
        el.scrollIntoView({ block: 'start' })
        window.scrollBy(0, -170)
      })
      await shot(page, '14-settings-two-emails-375.png', '같은 두 구역 375px.')
      // 새 문구: 비밀번호 재설정 · 모든 기기 로그아웃이 연락받을 이메일을 지운다
      const sessionsSection = page.getByRole('region', { name: auth.sectionSessions })
      await sessionsSection.scrollIntoViewIfNeeded()
      await shot(
        page,
        '15-sessions-contact-note-375.png',
        '활성 세션 구역 375px - 모든 기기에서 로그아웃하면 연락받을 이메일도 지워진다는 한 줄.',
        sessionsSection,
      )
    } finally {
      await browser.close()
      writeFileSync(
        join(out, 'captions.md'),
        `# 이메일 필수 — 실제 스택 한국어 화면\n\n${captions.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
    }
  })
})
