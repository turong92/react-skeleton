import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect as pwExpect, type Page } from 'playwright/test'
import { describe, inject, it } from 'vitest'
import { auth, dismissConsent, fillSignIn, ko, launch } from './helpers'
import { waitForLink } from './mail'

/*
 * 계정 수명주기 증거 — 진짜 백엔드 · 진짜 메일로 여정을 밟으며 스크린샷을 남긴다(라이트 → 다크 · 모바일 390 · 영어 · 운영자 표).
 * 로그인에 소셜 · 링크 옵션이 보이도록 앱을 `VITE_AUTH_METHODS=password,magic-link,google VITE_SOCIAL_GOOGLE_CLIENT_ID=demo` 로 띄운다(소셜 버튼은 보이기만 한다 — 눌러도 제공자 설정이 없다).
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> VITE_AUTH_METHODS=… pnpm --filter sample walkthrough`. `captions.md` 에 파일 → 한 줄 설명.
 */
const baseUrl = inject('baseUrl')
const mailUrl = inject('mailUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []

async function shot(
  page: Page,
  file: string,
  caption: string,
  target?: ReturnType<Page['getByRole']>,
) {
  await page.waitForTimeout(500)
  if (target) await target.screenshot({ path: join(out, file) })
  else await page.screenshot({ path: join(out, file), fullPage: false })
  captions.push([file, caption])
}

describe('account walkthrough', () => {
  it('walks sign-up → verify → login → settings → delete confirmation, then dark · mobile · English · admin', async () => {
    mkdirSync(out, { recursive: true })
    const email = `evidence-${Date.now()}@example.com`
    const password = 'Correct-horse-9'
    const seen = new Set<string>()
    const { browser, page } = await launch()
    try {
      await page.goto(baseUrl)
      await dismissConsent(page)
      await shot(
        page,
        '01-landing.png',
        '랜딩 — 첫 화면의 「시작하기」 버튼이 이제 가입으로 이어진다(헤더의 「로그인」은 그대로).',
      )

      await page.getByRole('link', { name: ko('landing.primary'), exact: true }).click()
      await page.getByLabel(auth.email).fill(email)
      await page.getByLabel(auth.password).first().fill('abc12')
      await shot(
        page,
        '02-sign-up-policy-hints.png',
        '가입 — 비밀번호를 치는 동안 서버 정책(최소 길이 · 문자 · 숫자 · 이메일 일부 금지)이 체크리스트와 강도 막대로 보인다. 아직 못 채운 항목은 「○」.',
      )
      await page.getByLabel(auth.password).first().fill(password)
      await page.getByRole('button', { name: auth.signUpSubmit }).click()
      await page.getByRole('heading', { name: auth.checkEmailTitle }).waitFor()
      await shot(
        page,
        '03-check-your-email.png',
        '가입 직후 — 「메일함을 확인해 주세요」. 어느 주소로 보냈는지, 스팸함 안내, 다시 보내기(쿨다운)와 처음부터 가기.',
      )

      const link = await waitForLink(mailUrl, email, 'verify-email', { seen })
      await page.goto(`${baseUrl}${link.path}`)
      await page.getByText(auth.verifyEmailDone).waitFor()
      await shot(
        page,
        '04-verify-success.png',
        '메일의 링크를 열면 이메일 인증이 끝난다 — 「이메일을 인증했어요」와 로그인으로 가는 링크.',
      )

      await page.goto(`${baseUrl}/login`)
      await shot(
        page,
        '05-login-methods.png',
        '로그인 — 이 앱이 켠 방법이 모두 보인다: 구글로 계속하기(소셜) · 비밀번호 폼 · 「이메일로 로그인 링크 받기」(매직링크). 방법은 설정(VITE_AUTH_METHODS)이 정한다.',
      )
      await fillSignIn(page, { email, password })
      await page.getByRole('heading', { level: 1 }).first().waitFor()

      await page.goto(`${baseUrl}/account`)
      const region = (name: string) => page.getByRole('region', { name })
      await region(auth.sectionProfile).waitFor()
      await shot(
        page,
        '06-settings-profile.png',
        '계정 설정 · 프로필 — 표시 이름 · 언어 · 시간대를 계정에 저장한다.',
        region(auth.sectionProfile),
      )
      await shot(
        page,
        '07-settings-password.png',
        '계정 설정 · 비밀번호 — 현재 비밀번호 + 새 비밀번호(정책 힌트). 바꾸면 다른 기기는 로그아웃된다.',
        region(auth.sectionPassword),
      )
      await shot(
        page,
        '08-settings-sign-in-methods.png',
        '계정 설정 · 로그인 수단 — 지금 쓰는 수단 목록. 마지막 하나는 떼기 버튼 대신 이유를 보여 준다.',
        region(auth.sectionMethods),
      )
      await shot(
        page,
        '09-settings-sessions.png',
        '계정 설정 · 로그인한 기기 — 이 기기 표시, 마지막 사용, 하나씩 · 한꺼번에 로그아웃.',
        region(auth.sectionSessions),
      )
      await region(auth.sectionDelete).getByLabel(auth.currentPassword).fill(password)
      await region(auth.sectionDelete).getByRole('button', { name: auth.deleteButton }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
      await shot(
        page,
        '10-delete-confirmation.png',
        '계정 삭제 — 비밀번호로 다시 인증한 뒤, 「삭제」를 직접 쳐야 켜지는 확인 창. 뒤의 구역에는 데이터가 지워지기까지의 유예 기간 안내가 있다.',
      )
      await dialog.getByRole('button', { name: auth.cancel }).first().click()

      // 다크 · 모바일 · 영어 · 운영자
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto(`${baseUrl}/account`)
      await region(auth.sectionPassword).waitFor()
      await shot(
        page,
        '11-dark-settings.png',
        '다크 모드 — 같은 계정 설정이 어두운 테마에서도 같은 구조와 대비로 보인다.',
      )
      await page.emulateMedia({ colorScheme: 'light' })

      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${baseUrl}/account`)
      await region(auth.sectionPassword).waitFor()
      await shot(
        page,
        '12-mobile-390-settings.png',
        '모바일 390px — 계정 설정이 한 열로 접히고 목차 칩이 가로로 이어진다.',
      )
      await page.goto(`${baseUrl}/sign-up`)
      await shot(
        page,
        '13-mobile-390-sign-up.png',
        '모바일 390px — 가입 화면도 한 열(가로 스크롤 없음).',
      )

      const english = await browser.newContext({
        locale: 'en-US',
        timezoneId: 'UTC',
        viewport: { width: 1280, height: 800 },
      })
      const en = await english.newPage()
      await en.goto(`${baseUrl}/login`)
      await dismissConsent(en).catch(() => undefined)
      await en.getByLabel('Email').fill(email)
      await en.getByLabel('Password').first().fill(password)
      await en.getByRole('button', { name: 'Sign in', exact: true }).click()
      await en.goto(`${baseUrl}/account`)
      await en.getByRole('heading', { name: 'Active sessions' }).waitFor()
      await shot(
        en,
        '14-english-settings.png',
        '영어 — 브라우저 언어가 영어면 같은 화면이 영어로(문구는 labels prop, 앱이 번역해 넘긴다).',
      )
      await english.close()

      const admin = await browser.newContext({
        locale: 'ko-KR',
        viewport: { width: 1280, height: 800 },
      })
      const ad = await admin.newPage()
      await ad.goto(`${baseUrl}/login`)
      await dismissConsent(ad).catch(() => undefined)
      await fillSignIn(ad, { email: 'admin@example.com', password: 'password' })
      await ad.getByRole('heading', { level: 1 }).first().waitFor()
      await ad.goto(`${baseUrl}/admin/accounts`)
      await ad.getByRole('table', { name: auth.adminCaption }).waitFor()
      await pwExpect(ad.getByText(email)).toBeVisible()
      await shot(
        ad,
        '15-admin-accounts.png',
        '운영자 계정 표(@skeleton/auth/admin) — ADMIN 으로 로그인했을 때만. 검색 · 상태 필터 · 줄마다 ⋯ 메뉴(정지 · 해제 · 복구 · 역할).',
      )
      await admin.close()
    } finally {
      writeFileSync(
        join(out, 'captions.md'),
        `# 계정 수명주기 — 진짜 백엔드 · 진짜 메일 증거\n\n${captions.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
      await browser.close()
    }
  })
})
