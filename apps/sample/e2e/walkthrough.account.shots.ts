import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { BrowserContext, Locator, Page } from 'playwright'
import { describe, inject, it } from 'vitest'
import { agreeToLegal, auth, dismissConsent, launch } from './helpers'
import { waitForCode, waitForLink } from './mail'

/*
 * 계정 수명주기 증거(FINAL-3 — 인증번호) — 진짜 백엔드 · 진짜 메일(mailpit)로 여정을 밟으며 스크린샷을 남긴다:
 * 가입 → 인증번호 입력(빈 칸 · 틀린 번호와 남은 횟수 · 맞으면 바로 로그인) · 메일함의 인증번호 메일 · 이메일 변경의 코드 단계 ·
 * 다시 인증을 같은 자리에서 코드로 · 삭제 확인(코드 + 글자) · 다크 · 모바일 390 · 영어.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample walkthrough`. `captions.md` 에 파일 → 한 줄 설명(이미지 한 장에 한 줄).
 */
const baseUrl = inject('baseUrl')
const mailUrl = inject('mailUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []

async function shot(page: Page, file: string, caption: string, target?: Locator) {
  await page.waitForTimeout(600)
  if (target) await target.screenshot({ path: join(out, file) })
  else await page.screenshot({ path: join(out, file), fullPage: false })
  captions.push([file, caption])
}

/** 인증번호 칸에 6자리를 친다(첫 칸에서 시작 — 다 채우면 버튼 없이 제출된다) */
async function enterCode(page: Page, scope: Page | Locator, code: string) {
  await scope.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(code)
}

describe('account walkthrough (FINAL-3 codes)', () => {
  it('sign-up by code → signed in; mail; email change code step; re-auth and delete by code; dark · mobile · English', async () => {
    mkdirSync(out, { recursive: true })
    const stamp = Date.now()
    const email = `evidence-${stamp}@example.com`
    const emailNext = `evidence-next-${stamp}@example.com`
    const passwordless = `evidence-link-${stamp}@example.com`
    const passwordlessNext = `evidence-link-next-${stamp}@example.com`
    const password = 'Correct-horse-9'
    const seen = new Set<string>()
    const { browser, context, page } = await launch()
    const extra: BrowserContext[] = []
    try {
      // ── 가입 → 코드 입력 ────────────────────────────────────────────────
      await page.goto(`${baseUrl}/sign-up`)
      await dismissConsent(page)
      await page.getByLabel(auth.email).fill(email)
      await page.getByLabel(auth.password).first().fill(password)
      await shot(
        page,
        '01-sign-up-form.png',
        '가입 — 주소와 비밀번호(서버 정책 체크리스트 · 강도 막대)를 쓰고 「계정 만들기」. 이 시점에는 계정이 아직 없다.',
      )
      await agreeToLegal(page, inject('apiUrl'))
      await page.getByRole('button', { name: auth.signUpSubmit }).click()
      await page.getByRole('heading', { name: auth.codeTitle }).waitFor()
      await shot(
        page,
        '02-code-entry-empty.png',
        '가입 직후 — 같은 화면에서 인증번호 6자리를 받는다(빈 칸). 어느 주소로 보냈는지 · 스팸함 안내 · 새 코드 받기 · 주소를 잘못 썼을 때 처음부터.',
      )
      await enterCode(page, page, '000000')
      await page.getByRole('alert').waitFor()
      await shot(
        page,
        '03-code-wrong-attempts-left.png',
        '틀린 번호 — 「남은 시도 4번」을 보여 주고 칸을 비워 다시 칠 수 있게 한다(서버는 번호당 5번까지 받는다).',
      )
      const mail = await waitForCode(mailUrl, email, 'verify', { seen })
      const mailPage = await context.newPage()
      await mailPage.goto(`${mailUrl}/view/${mail.id}`)
      await mailPage.waitForLoadState('networkidle').catch(() => undefined)
      await shot(
        mailPage,
        '04-mailpit-code-mail.png',
        '메일함(mailpit) — 가입 인증번호 메일. 링크가 아니라 6자리 번호가 제목과 본문에 있고, 「누구에게도 알려주지 마세요」 안내가 붙는다.',
      )
      await mailPage.close()
      await enterCode(page, page, mail.code)
      await page.getByRole('heading', { name: /안녕하세요/ }).waitFor()
      await shot(
        page,
        '05-signed-in-after-code.png',
        '맞는 번호를 넣으면 별도 로그인 없이 바로 로그인된 대시보드로 간다(응답이 토큰 — 가입이 끝나는 순간 로그인).',
      )

      // ── 이메일 변경: 새 주소의 인증번호 단계 ───────────────────────────
      await page.goto(`${baseUrl}/account`)
      const region = (name: string, on: Page = page) => on.getByRole('region', { name })
      const emailSection = region(auth.sectionEmail)
      await emailSection.getByLabel(auth.emailNew).fill(emailNext)
      await emailSection.getByLabel(auth.currentPassword).fill(password)
      await emailSection.getByRole('button', { name: auth.emailChangeSubmit }).click()
      await emailSection.getByText(auth.emailPendingTitle).waitFor()
      await page.reload()
      await emailSection.getByText(auth.emailPendingTitle).waitFor()
      await shot(
        page,
        '06-email-change-code-step.png',
        '이메일 변경 — 새 주소로 간 6자리를 이 화면에서 입력하는 단계. 새로고침해도 서버(me.pendingEmail)가 알려 줘서 그대로 열린다.',
        emailSection,
      )

      // ── 비밀번호 없는 계정: 코드로 다시 인증(그 자리에서) · 삭제(코드 + 글자) ──────
      const pl = await browser.newContext({
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        viewport: { width: 1280, height: 800 },
      })
      extra.push(pl)
      const plPage = await pl.newPage()
      await plPage.goto(`${baseUrl}/login`)
      await dismissConsent(plPage).catch(() => undefined)
      await plPage.getByRole('button', { name: auth.signInMagicLink }).click()
      await plPage.getByLabel(auth.email).fill(passwordless)
      await plPage.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
      const link = await waitForLink(mailUrl, passwordless, 'magic-link', { seen })
      await plPage.goto(`${baseUrl}${link.path}`)
      await plPage.getByRole('heading', { name: /안녕하세요/ }).waitFor()
      await plPage.goto(`${baseUrl}/account`)
      const plEmail = region(auth.sectionEmail, plPage)
      await plEmail.getByLabel(auth.emailNew).fill(passwordlessNext)
      await plEmail.getByRole('button', { name: auth.reauthCodeSend }).click()
      const reauth = await waitForCode(mailUrl, passwordless, 'reauth', { seen })
      await plEmail.getByText(auth.reauthCodeSent(passwordless)).waitFor()
      await enterCode(plPage, plEmail, reauth.code)
      await plEmail.getByText(auth.reauthCodeEntered).waitFor()
      await shot(
        plPage,
        '07-reauth-by-code-in-place.png',
        '다시 인증 — 비밀번호 없는 계정은 「인증번호 받기」 → 메일의 6자리를 같은 자리에서 입력(링크 왕복 없음). 번호를 넣으면 아래 「이메일 바꾸기」가 켜진다.',
        plEmail,
      )
      const plDelete = region(auth.sectionDelete, plPage)
      await plDelete.getByRole('button', { name: auth.reauthCodeSend }).click()
      const deleteCode = await waitForCode(mailUrl, passwordless, 'delete', { seen })
      await plDelete.getByText(auth.reauthCodeSent(passwordless)).waitFor()
      await enterCode(plPage, plDelete, deleteCode.code)
      await plDelete.getByRole('button', { name: auth.deleteButton }).click()
      const dialog = plPage.getByRole('dialog')
      await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
      await shot(
        plPage,
        '08-delete-confirmation-code-and-phrase.png',
        '계정 삭제 — 삭제용 인증번호(다시 인증 번호와 별개)를 입력하고, 「삭제」를 직접 쳐야 켜지는 확인 창. 뒤의 구역에는 데이터가 지워지기까지의 유예 안내가 있다.',
      )
      await dialog.getByRole('button', { name: auth.cancel }).first().click()

      // ── 다크 · 모바일 390 · 영어(같은 코드 단계) ───────────────────────────
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto(`${baseUrl}/account`)
      await emailSection.getByText(auth.emailPendingTitle).waitFor()
      await shot(
        page,
        '09-dark-code-step.png',
        '다크 모드 — 이메일 변경의 코드 단계가 어두운 테마에서도 같은 구조와 대비로 보인다(칸 테두리 · 오류 색 포함).',
        emailSection,
      )
      await page.emulateMedia({ colorScheme: 'light' })

      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${baseUrl}/account`)
      await emailSection.getByText(auth.emailPendingTitle).waitFor()
      await emailSection.scrollIntoViewIfNeeded()
      await shot(
        page,
        '10-mobile-390-code-step.png',
        '모바일 390px — 인증번호 6칸이 한 줄에 들어가고(가로 스크롤 없음) 숫자 키패드가 뜨도록 inputMode 가 numeric 이다.',
      )

      const english = await browser.newContext({
        locale: 'en-US',
        timezoneId: 'UTC',
        viewport: { width: 1280, height: 800 },
      })
      extra.push(english)
      const en = await english.newPage()
      await en.goto(`${baseUrl}/login`)
      await dismissConsent(en).catch(() => undefined)
      await en.getByLabel('Email').fill(email)
      await en.getByLabel('Password').first().fill(password)
      await en.getByRole('button', { name: 'Sign in', exact: true }).click()
      await en.waitForURL((url) => !url.pathname.startsWith('/login'))
      await en.goto(`${baseUrl}/account`)
      await en.getByRole('heading', { name: 'Enter the code for your new address' }).waitFor()
      await shot(
        en,
        '11-english-code-step.png',
        '영어 — 브라우저 언어가 영어면 같은 코드 단계가 영어로(문구는 labels prop, 앱이 번역해 넘긴다).',
        en.getByRole('region', { name: 'Email address' }),
      )
    } finally {
      writeFileSync(
        join(out, 'captions.md'),
        `# 계정 수명주기(FINAL-3 인증번호) — 진짜 백엔드 · 진짜 메일 증거\n\n${captions.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
      for (const c of extra) await c.close().catch(() => undefined)
      await browser.close()
    }
  })
})
