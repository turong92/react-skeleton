import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect as pwExpect, type Page } from 'playwright/test'
import { describe, inject, it } from 'vitest'
import { auth, dismissConsent, launch } from './helpers'
import { waitForLink } from './mail'

/*
 * 계약 FINAL-2 정렬 증거 — 진짜 백엔드 · 진짜 메일로: 고친 비밀번호 보기 토글(라이트 · 다크 · 모바일), 백엔드가 알려 준 로그인 방법(+ 못 받았을 때의 대체),
 * 비밀번호 없는 계정의 본인 확인 메일 왕복(요청 → 메일 → 도착 화면 → 작업 완료), 새로고침 뒤에도 남는 이메일 변경 확인 대기.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample exec vitest run --config vitest.e2e.config.ts e2e/walkthrough.account2.shots.ts`
 * (소셜 제공자 모듈이 없는 샘플 백엔드라 소셜 병합 알림 경로는 찍을 수 없다.) `captions.md` 에 파일 → 한 줄 설명.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []

async function shot(
  page: Page,
  file: string,
  caption: string,
  target?: ReturnType<Page['locator']>,
) {
  await page.waitForTimeout(400)
  if (target) await target.screenshot({ path: join(out, file) })
  else await page.screenshot({ path: join(out, file), fullPage: false })
  captions.push([file, caption])
}

/** 메일함(mailpit)에서 `to` 앞으로 온 가장 최근 메일의 ID */
async function latestMailId(to: string, subjectPart: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${mailUrl}/api/v1/messages`)).json()) as {
      messages?: Array<{ ID: string; To: Array<{ Address: string }>; Subject: string }>
    }
    const found = (list.messages ?? []).find(
      (m) => m.To.some((t) => t.Address === to) && m.Subject.includes(subjectPart),
    )
    if (found) return found.ID
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`no mail "${subjectPart}" for ${to}`)
}

describe('account FINAL-2 walkthrough', () => {
  it('login toggle: light, dark, mobile', async () => {
    mkdirSync(out, { recursive: true })
    for (const [scheme, viewport, file, caption] of [
      [
        'light',
        { width: 1280, height: 800 },
        '01-login-toggle-light.png',
        '로그인 — 비밀번호 칸 오른쪽에 「보기」 토글이 같은 줄에 붙어 있다(라이트, 데스크톱). 예전에는 입력칸 아래로 내려갔다.',
      ],
      [
        'dark',
        { width: 1280, height: 800 },
        '02-login-toggle-dark.png',
        '같은 화면의 다크 — 토글도 입력칸과 한 줄(비밀번호를 보이게 한 상태: 「숨기기」).',
      ],
      [
        'light',
        { width: 390, height: 844 },
        '03-login-toggle-mobile.png',
        '모바일(390px) — 좁아도 토글이 입력칸 옆에 머문다.',
      ],
    ] as const) {
      const { browser, context, page } = await launch({ colorScheme: scheme })
      try {
        await page.setViewportSize(viewport)
        await page.goto(`${baseUrl}/login`)
        await dismissConsent(page)
        await page.getByLabel(auth.password).first().fill('Correct-horse-9')
        if (scheme === 'dark') await page.getByRole('button', { name: auth.show }).click()
        await shot(page, file, caption)
      } finally {
        await context.close()
        await browser.close()
      }
    }
  })

  it('methods come from the backend; and a default with retry when they cannot be had', async () => {
    const { browser, page } = await launch()
    try {
      await page.goto(`${apiUrl}/api/v1/auth/methods`)
      await shot(
        page,
        '04-auth-methods-response.png',
        '백엔드의 GET /api/v1/auth/methods 응답 — 비밀번호 · 이메일 링크가 열려 있고 소셜 제공자는 없다(가입 열림 · 리프레시 전달 body).',
      )
      await page.goto(`${baseUrl}/login`)
      await dismissConsent(page)
      await pwExpect(page.getByRole('button', { name: auth.signInMagicLink })).toBeVisible()
      await shot(
        page,
        '05-methods-discovered.png',
        '로그인 화면 — 환경변수가 아니라 위 응답을 따라 비밀번호 폼과 「이메일로 로그인 링크 받기」가 그려진다(소셜 버튼 없음).',
      )
      await page.route('**/api/v1/auth/methods', (route) => route.abort('failed'))
      await page.goto(`${baseUrl}/login`)
      await pwExpect(page.getByText(auth.methodsFailed)).toBeVisible()
      await shot(
        page,
        '06-methods-failed-fallback.png',
        '방법을 못 물었을 때 — 기본(비밀번호만)을 보이고 「다시 시도」 줄을 둔다(틀린 방법이 깜박이지 않는다).',
      )
    } finally {
      await browser.close()
    }
  })

  it('re-authentication round trip of a passwordless account, and the pending email after a reload', async () => {
    const email = `evidence2-${Date.now()}@example.com`
    const nextEmail = `evidence2-next-${Date.now()}@example.com`
    const seen = new Set<string>()
    const { browser, context, page } = await launch()
    try {
      await page.goto(`${baseUrl}/login`)
      await dismissConsent(page)
      await page.getByRole('button', { name: auth.signInMagicLink }).click()
      await page.getByLabel(auth.email).fill(email)
      await page.getByRole('button', { name: auth.signInMagicLinkSubmit }).click()
      const magic = await waitForLink(mailUrl, email, 'magic-link', { seen })
      await page.goto(`${baseUrl}${magic.path}`)
      await page.waitForURL((url) => !url.pathname.startsWith('/magic-link'))
      await page.goto(`${baseUrl}/account`)
      const emailSection = page.getByRole('region', { name: auth.sectionEmail })
      await emailSection.getByLabel(auth.emailNew).fill(nextEmail)
      await emailSection.getByRole('button', { name: auth.emailChangeSubmit }).click()
      await pwExpect(emailSection.getByText(auth.reauthSentTitle)).toBeVisible()
      await shot(
        page,
        '07-reauth-requested.png',
        '비밀번호 없는 계정이 이메일을 바꾸려 하면 서버가 다시 인증을 요구(403 REAUTH_REQUIRED) — 화면은 「메일을 확인해 주세요」와 「링크 다시 보내기」를 보이고 입력은 남긴다.',
        emailSection,
      )

      const link = await waitForLink(mailUrl, email, 'confirm-reauth', { seen })
      const mailId = await latestMailId(email, '')
      const mailPage = await context.newPage()
      await mailPage.goto(`${mailUrl}/view/${mailId}.html`)
      await shot(
        mailPage,
        '08-reauth-mail.png',
        '계정 주소로 간 본인 확인 메일(mailpit) — 링크는 /confirm-reauth?token=… (30분, 한 번).',
      )
      await mailPage.close()

      const tab = await context.newPage()
      await tab.goto(`${baseUrl}${link.path}`)
      await pwExpect(tab.getByText(auth.confirmReauthHandedOff)).toBeVisible()
      await shot(
        tab,
        '09-reauth-landing-handed-off.png',
        '링크는 새 탭에서 열린다 — 도착 화면이 토큰을 하려던 작업이 있는 탭에 넘기고 「알아서 이어 가요 — 이 탭은 닫아도 돼요」.',
      )
      await tab.close()

      await pwExpect(page.getByText(auth.confirmReauthEmailChanged)).toBeVisible()
      await pwExpect(emailSection.getByText(auth.emailPendingTitle)).toBeVisible()
      await shot(
        page,
        '10-reauth-completed.png',
        '원래 탭이 토큰을 받아 이메일 변경 요청을 마쳤다 — 「새 주소로 링크를 보냈어요」 알림과 「변경을 확인해 주세요」(서버가 말해 준 대기 상태).',
      )
      await page.reload()
      await pwExpect(emailSection.getByText(auth.emailPendingTitle)).toBeVisible()
      await shot(
        page,
        '11-pending-email-after-reload.png',
        '새로고침 뒤에도 「변경을 확인해 주세요」가 그대로 — 대기 중인 새 주소와 만료 시각을 서버(me.pendingEmail)에서 읽는다.',
        emailSection,
      )

      // 다른 기기: 다른 브라우저 컨텍스트에서 같은 종류의 링크를 열면 안내만 나온다
      await emailSection.getByLabel(auth.emailNew).fill(`other-${nextEmail}`)
      await emailSection.getByRole('button', { name: auth.emailChangeSubmit }).click()
      const second = await waitForLink(mailUrl, email, 'confirm-reauth', { seen })
      const other = await browser.newContext({ locale: 'ko-KR' })
      const otherPage = await other.newPage()
      await otherPage.goto(`${baseUrl}${second.path}`)
      await pwExpect(otherPage.getByText(auth.confirmReauthStashed)).toBeVisible()
      await shot(
        otherPage,
        '12-reauth-landing-other-device.png',
        '다른 기기(다른 브라우저)에서 링크를 열면 — 이 브라우저가 시작한 작업이 아니라는 안내와 「계정 설정 열기」. 토큰은 이 브라우저에 보관된다.',
      )
      await other.close()
    } finally {
      await browser.close()
      writeFileSync(
        join(out, 'captions.md'),
        `# 증거 캡션 — 계약 FINAL-2 정렬(react-skeleton)\n\n${captions.map(([file, text]) => `- ${file} — ${text}`).join('\n')}\n`,
      )
    }
  })
})
