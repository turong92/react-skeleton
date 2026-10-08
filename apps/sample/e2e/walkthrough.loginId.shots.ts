import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defaultAuthLabels, koAuthLabels } from '@skeleton/auth'
import { defaultLegalLabels, koLegalLabels } from '@skeleton/legal'
import type { Locator } from 'playwright'
import { describe, inject, it } from 'vitest'
import { i18n, type MessageKey } from '../src/i18n'
import { seedPosts, USER } from './boardSteps'
import {
  acceptLegalGate,
  consentViaApi,
  dismissConsent,
  launch,
  signUpConsents,
  startLineSignIn,
  uniqueLoginId,
} from './helpers'
import { LOGIN_ID_REMINDER_SUBJECT, waitForCode, waitForMailText } from './mail'

/*
 * 로그인 아이디 증거 — 진짜 백엔드(`login-id.enabled` · 이메일 쓰기 때 · 관리자 도구) · 진짜 메일(mailpit) · 가짜 LINE(주소를 안 준다)으로 밟으며 화면을 남긴다. **한국어 · 영어** 한 벌씩(파일 이름 앞에 `ko-` · `en-`), 375px 포함:
 *  가입 양식의 아이디 상태 줄(형식 오류 · 쓸 수 없음 · 쓸 수 있음) → 인증 단계에서 아이디가 그 사이 나갔을 때의 재입력 → 로그인(아이디 또는 이메일) → 아이디 찾기(입력 · 보냄) → 메일 한 통
 *  → 소셜 첫 로그인의 아이디 게이트(빈 칸 · 입력 · 확인 대화상자 · 375) → 읽기 화면(이메일 없이) → 댓글 위의 띠 → 쓰기 전 이메일 화면과 「나중에 하기」 → 설정(아이디 줄 세 상태) → 관리자 표.
 * 실행: `E2E_WALKTHROUGH=1 SAMPLE_EVIDENCE_DIR=<폴더> pnpm --filter sample walkthrough` (이 파일만: 끝에 `e2e/walkthrough.loginId.shots.ts`). 폴더에 `captions-loginId.md`(파일 → 한 줄 설명)를 쓴다.
 * 가짜 제공자가 없으면(`fakeUrl` 빈 문자열) 소셜 구간은 건너뛴다.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const out = resolve(process.env.SAMPLE_EVIDENCE_DIR ?? 'evidence')
const captions: Array<[string, string]> = []
const seen = new Set<string>()
const JSON_HEADERS = { 'Content-Type': 'application/json' }

type Locale = 'ko' | 'en'

describe.each(['ko', 'en'] as const)('login id walkthrough (%s)', (locale: Locale) => {
  const A = locale === 'ko' ? koAuthLabels : defaultAuthLabels
  const G = locale === 'ko' ? koLegalLabels : defaultLegalLabels
  const T = (key: MessageKey, values?: Record<string, string | number>) =>
    i18n.tIn(locale, key, values)
  const mark = locale === 'ko' ? '한국어' : '영어'

  it('sign-up states · re-entry · sign-in · forgot ID · mail · gate · read screens · write-time email · settings · admin table', async (ctx) => {
    mkdirSync(out, { recursive: true })
    await i18n.preload(locale) // 영어 사전은 고를 때 불러온다 - 시험 프로세스에서도 미리 불러 둔다
    const stamp = `${Date.now()}${locale}`
    const password = 'Correct-horse-9'
    const email = `evidence-id-${stamp}@example.com`
    const typedId = `Walk.${Date.now().toString(36)}${locale}`
    const { browser, page } = await launch({ locale: locale === 'ko' ? 'ko-KR' : 'en-US' })
    const shot = async (file: string, caption: string, target?: Locator) => {
      await page.waitForTimeout(700)
      const path = join(out, `${locale}-${file}`)
      if (target) await target.screenshot({ path })
      else await page.screenshot({ path, fullPage: false })
      captions.push([`${locale}-${file}`, `[${mark}] ${caption}`])
    }
    /** 같은 화면을 375px 로도 남긴다 */
    const shotBoth = async (file: string, caption: string, target?: Locator) => {
      await shot(`${file}-desktop.png`, caption, target)
      await page.setViewportSize({ width: 375, height: 800 })
      await shot(`${file}-375.png`, `${caption} — 375px`, target)
      await page.setViewportSize({ width: 1280, height: 800 })
    }
    const region = (name: string) => page.getByRole('region', { name })
    /** 로그인이 끝나 대시보드가 떴다 */
    const home = () =>
      page.getByRole('heading', { level: 1, name: T('dashboard.greetingNeutral') }).waitFor()
    const idBox = () => page.getByRole('textbox', { name: new RegExp(`^${A.loginId}`) })
    const rules = (
      (await (await fetch(`${apiUrl}/api/v1/auth/methods`)).json()) as {
        value: { loginId: { minLength: number; maxLength: number } }
      }
    ).value.loginId

    try {
      // ── 가입 양식: 아이디 상태 줄 ───────────────────────────────────────
      await page.goto(`${baseUrl}/sign-up`)
      await dismissConsent(page, locale)
      await page.getByLabel(A.email).fill(email)
      await page.getByLabel(A.displayName).fill(locale === 'ko' ? '아이디 증거' : 'Evidence')
      await idBox().fill('ab')
      await idBox().blur()
      await page.getByText(A.problemLoginIdSize(rules.minLength, rules.maxLength)).waitFor()
      await shotBoth(
        '01-signup-id-format',
        '가입 양식 — 형식이 틀린 아이디: 칸을 벗어나면 이유를 글자로 말하고(서버에는 묻지 않는다), 도움말은 그대로 둔다.',
      )
      await idBox().fill('sample-user')
      await page.getByText(A.errorLoginIdTaken).waitFor()
      await shotBoth(
        '02-signup-id-taken',
        '가입 양식 — 남이 쓰는 아이디(시드 계정): 「쓸 수 없는 아이디예요」. 예약어도 같은 말이다.',
      )
      await idBox().fill(typedId)
      await page
        .getByText(`${A.loginIdAvailable} · ${A.loginIdSavedAs(typedId.toLowerCase())}`)
        .waitFor()
      await shotBoth(
        '03-signup-id-available',
        '가입 양식 — 쓸 수 있는 아이디: 글자(✓ 아이콘은 보조)로 「쓸 수 있는 아이디예요 · …(으)로 저장돼요」(대문자는 소문자로 저장된다).',
      )

      // 이 아이디를 인증번호 단계 전에 다른 사람이 가져간다 - 그 사이에 나간 아이디의 재입력
      await page.getByLabel(A.password).first().fill(password)
      await page.getByLabel(A.passwordConfirm).fill(password)
      await page.getByRole('checkbox', { name: G.agreeAll }).check()
      await page.getByRole('button', { name: A.signUpSubmit }).click()
      await page.getByRole('heading', { name: A.codeTitle }).waitFor()
      const rival = `evidence-rival-${stamp}@example.com`
      const rivalSignUp = await fetch(`${apiUrl}/api/v1/account/sign-up`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          email: rival,
          password,
          displayName: 'rival',
          loginId: typedId,
          ...(await signUpConsents(apiUrl)),
        }),
      })
      const rivalId = ((await rivalSignUp.json()) as { value: { signUpId: string } }).value.signUpId
      const rivalCode = await waitForCode(mailUrl, rival, 'verify', { seen })
      await fetch(`${apiUrl}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ signUpId: rivalId, code: rivalCode.code }),
      })
      const mine = await waitForCode(mailUrl, email, 'verify', { seen })
      await page.getByLabel(A.codeDigit(1, 6)).click()
      await page.keyboard.type(mine.code)
      await page.getByText(A.loginIdRetryHint).waitFor()
      await shotBoth(
        '04-signup-code-step-id-retry',
        '인증번호 단계에서 아이디가 그 사이 나갔다 — 같은 화면에서 아이디만 다시 받는다(비밀번호 · 인증번호는 다시 받지 않는다).',
      )
      await page
        .getByRole('form', { name: A.loginId })
        .getByRole('textbox')
        .fill(uniqueLoginId('walk'))
      await page.getByRole('form', { name: A.loginId }).getByText(A.loginIdAvailable).waitFor()
      await page.getByRole('button', { name: A.loginIdRequiredSubmit }).click()
      await home()

      // ── 설정: 아이디 줄(바꿀 수 없어요) ──────────────────────────────────
      await page.goto(`${baseUrl}/account`)
      const idSection = region(A.loginId)
      await idSection.waitFor()
      await shotBoth(
        '05-settings-id-set',
        '설정의 아이디 줄 — 정한 아이디와 「바꿀 수 없어요」. 고치는 요소는 없다.',
        idSection,
      )

      // ── 로그인(아이디 또는 이메일) · 아이디 찾기 ─────────────────────────
      await page.goto(baseUrl)
      await page
        .getByRole('button', { name: T('header.signOut') })
        .first()
        .click()
      await page.getByRole('heading', { level: 1, name: T('login.title') }).waitFor()
      await shotBoth(
        '06-sign-in',
        '로그인 — 칸 이름이 「아이디 또는 이메일」, 아래에 「아이디 찾기」 링크.',
      )
      await page.getByRole('link', { name: A.forgotLoginIdLink }).click()
      await page.getByRole('heading', { level: 1, name: A.forgotLoginIdTitle }).waitFor()
      await shotBoth('07-forgot-id-input', '아이디 찾기 — 가입한 이메일을 적는다.')
      await page.getByLabel(A.email).fill(email)
      await page.getByRole('button', { name: A.forgotLoginIdSubmit }).click()
      await page.getByText(A.forgotLoginIdSentBody(email)).waitFor()
      await shotBoth(
        '08-forgot-id-sent',
        '아이디 찾기 — 보냄: 계정이 있든 없든 같은 한 줄(「…에 계정이 있다면 아이디를 보냈어요」).',
      )
      const reminder = await waitForMailText(mailUrl, email, LOGIN_ID_REMINDER_SUBJECT)
      const mailPage = await page.context().newPage()
      await mailPage.goto(`${mailUrl}/view/${reminder.id}`)
      await mailPage.waitForLoadState('networkidle').catch(() => undefined)
      await mailPage.waitForTimeout(700)
      const mailPath = join(out, `${locale}-09-mail-login-id.png`)
      await mailPage.screenshot({ path: mailPath })
      captions.push([
        `${locale}-09-mail-login-id.png`,
        `[${mark}] 메일함(mailpit) — 아이디 찾기 메일 한 통: 아이디와 「아이디나 이메일 주소로 로그인할 수 있어요」.`,
      ])
      await mailPage.close()

      // ── 관리자 표 ─────────────────────────────────────────────────────────
      await consentViaApi({ email: 'admin@example.com', password: 'password' })
      await page.goto(`${baseUrl}/login`)
      await page.getByLabel(A.signInIdentifier).fill('admin@example.com')
      await page.getByLabel(A.password, { exact: false }).first().fill('password')
      await page.getByRole('button', { name: A.signInSubmit, exact: true }).click()
      await home()
      await page.goto(`${baseUrl}/admin/accounts`)
      await page.getByRole('columnheader', { name: A.loginId }).first().waitFor()
      await shotBoth(
        '10-admin-table',
        '관리자 계정 표 — 이메일 옆에 「아이디」 열이 있다(아이디를 켠 서버일 때만).',
      )
      await page.getByRole('searchbox', { name: A.adminSearchLoginId }).fill('sample-user')
      await page.getByRole('button', { name: A.adminFindLoginId }).click()
      await page.getByRole('row').filter({ hasText: 'sample-user' }).first().waitFor()
      await shot(
        '11-admin-find-login-id.png',
        '관리자 — 아이디로 정확히 찾기: 입력하고 테두리 「찾기」(Enter 도 된다).',
      )

      // ── 소셜 첫 로그인: 아이디 게이트 → 읽기(이메일 없이) → 쓰기 전 이메일 ────────
      if (!fakeUrl) {
        ctx.skip()
        return
      }
      await page.evaluate(() => window.localStorage.clear())
      await consentViaApi(USER)
      const postTitle = locale === 'ko' ? `증거 글 ${stamp}` : `Evidence post ${stamp}`
      const [postId] = await seedPosts(apiUrl, USER, [{ title: postTitle, body: 'body' }])
      await startLineSignIn(
        page,
        fakeUrl,
        { sub: `U-evidence-id-${stamp}`, name: 'Evidence' },
        locale,
      )
      const gate = page.getByRole('dialog', { name: A.loginIdRequiredTitle })
      await gate.waitFor()
      await shotBoth(
        '12-id-gate-empty',
        '소셜 첫 로그인 — 앱 대신 덮는 「아이디를 정해 주세요」: 아이디 칸 · 채운 「이 아이디로 정하기」 · 테두리 「로그아웃」 · 밑줄 「계정 설정」 · 「이미 계정이 있나요?」.',
      )
      const chosen = uniqueLoginId('walk')
      await gate.getByRole('textbox').fill(chosen)
      await gate.getByText(A.loginIdAvailable).waitFor()
      await shot('13-id-gate-typed.png', '아이디 게이트 — 입력하면 곧 「쓸 수 있는 아이디예요」.')
      await gate.getByRole('button', { name: A.loginIdRequiredSubmit }).click()
      const confirm = page.getByRole('dialog', { name: A.loginIdConfirmTitle(chosen) })
      await confirm.waitFor()
      await shotBoth(
        '14-id-gate-confirm',
        '아이디 게이트 — 정하기 전에 한 번 더 묻는 확인 대화상자(「정한 뒤에는 바꿀 수 없어요」).',
      )
      await confirm.getByRole('button', { name: A.loginIdConfirm, exact: true }).click()
      await gate.waitFor({ state: 'detached' })
      await acceptLegalGate(page, apiUrl, true, G)
      await home()
      await shot(
        '15-read-dashboard-no-email.png',
        '읽기 화면(이메일 없이) — 아이디 → 약관만 지나 들어온 대시보드. 이메일 화면은 없다.',
      )
      await page.goto(`${baseUrl}/board/${postId}`)
      await page.getByText(A.emailRequiredWriteNotice).waitFor()
      await shotBoth(
        '16-comment-band',
        '댓글 칸 위의 띠 — 「이메일을 등록하면 글을 쓸 수 있어요」 + 테두리 「이메일 등록」. 막지 않는다.',
      )
      await page.goto(`${baseUrl}/board`)
      await page
        .getByRole('button', { name: T('board.write'), exact: true })
        .first()
        .click()
      const writeGate = page.getByRole('dialog', { name: A.emailRequiredWriteTitle })
      await writeGate.waitFor()
      await shotBoth(
        '17-write-time-email',
        '쓰려 할 때 뜨는 이메일 화면 — 제목 「글을 쓰려면 이메일을 등록해 주세요」 · 채운 「인증번호 받기」 · 테두리 「나중에 하기」.',
      )
      await writeGate.getByRole('button', { name: A.emailRequiredLater }).click()
      await writeGate.waitFor({ state: 'detached' })
      await page.getByText(A.emailRequiredDeclined).first().waitFor()
      await shot(
        '18-later-declined-line.png',
        '「나중에 하기」 뒤 — 계속 읽고, 「이메일을 등록한 뒤에 쓸 수 있어요」 한 줄만 알린다.',
      )

      // 설정: 소셜 계정(비밀번호 없음)의 아이디 줄 - 이메일이 먼저라는 카드
      await page.goto(`${baseUrl}/account`)
      await region(A.loginId).waitFor()
      await shotBoth(
        '19-settings-id-social-no-password',
        '설정의 아이디 줄 — 소셜 계정: 아이디 + 「바꿀 수 없어요」, 비밀번호가 없다는 안내와 「이메일 등록하기」.',
        region(A.loginId),
      )

      // 설정: 아이디를 아직 못 정한 계정(막이 걷힌 설정에서 정하는 길)
      await page.evaluate(() => window.localStorage.clear())
      await startLineSignIn(
        page,
        fakeUrl,
        { sub: `U-evidence-id2-${stamp}`, name: 'Evidence2' },
        locale,
      )
      await gate.waitFor()
      await gate.getByRole('link', { name: A.loginIdRequiredSettings }).click()
      await region(A.loginId).waitFor()
      await shotBoth(
        '20-settings-id-unset',
        '설정의 아이디 줄 — 아직 못 정한 계정: 막이 걷힌 설정에서도 같은 칸 · 같은 확인으로 정한다.',
        region(A.loginId),
      )
    } finally {
      writeFileSync(
        join(out, 'captions-loginId.md'),
        `# 로그인 아이디 — 실제 스택 화면(한국어 · 영어)\n\n${captions.map(([f, c]) => `- \`${f}\` — ${c}`).join('\n')}\n`,
      )
      await browser.close()
    }
  })
})
