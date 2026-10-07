import { expect as baseExpect } from 'playwright/test'
import type { Browser, Locator, Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { article, commentOf, openBoard, postComment, writePost } from './boardSteps'
import {
  acceptLegalGate,
  agreeToLegal,
  auth,
  dismissConsent,
  fillSignIn,
  ko,
  launch,
} from './helpers'
import { waitForCode, waitForLink } from './mail'

/*
 * 닉네임 묶음의 새 흐름 — 가입에서 닉네임 → 게시판 글 · 댓글에 작성자 닉네임(계정 id 는 안 보인다) → 탈퇴 → 로그인 → 「탈퇴를 취소할까요?」 → 취소,
 * 링크 로그인은 redeem 요청이 한 번(200)뿐이고 오류가 안 보인다. 진짜 백엔드 · 진짜 브라우저 · 진짜 메일(mailpit). 앞 단계의 결과에 기댄다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')

const stamp = Date.now()
const email = `e2e-nick-${stamp}@example.com`
const password = 'Correct-horse-9'
const nickname = `닉${String(stamp).slice(-6)}`
const seen = new Set<string>()

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

const heading = (name: string | RegExp, level = 1) => page.getByRole('heading', { level, name })

async function enterCode(scope: Page | Locator, code: string) {
  await scope.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(code)
}

describe('nickname: sign-up → board author → delete → cancel', () => {
  it('sign-up asks for a nickname (required) and the greeting uses it', async () => {
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(email)
    await page.getByLabel(auth.password).first().fill(password)
    await page.getByLabel(auth.passwordConfirm).fill(password)
    await agreeToLegal(page, apiUrl)
    // 닉네임은 필수 — 비우고 누르면 이유를 말하고 보내지 않는다
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(page.getByText(auth.problemDisplayNameMissing).first()).toBeVisible()
    await page.getByLabel(auth.displayName).fill(nickname)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(heading(auth.codeTitle, 2)).toBeVisible()
    const code = await waitForCode(mailUrl, email, 'verify', { seen })
    await enterCode(page, code.code)
    await pwExpect(heading(new RegExp(`안녕하세요, ${nickname}`))).toBeVisible()
  })

  it('the board shows the nickname — never the account id — on a post, its list row and a comment', async () => {
    const title = `닉네임 시험 ${stamp}`
    const comment = `댓글 ${stamp}`
    await openBoard(page)
    await writePost(page, title, '본문이에요')
    await pwExpect(article(page).getByText(nickname)).toBeVisible()
    await postComment(page, comment)
    await pwExpect(commentOf(page, comment).getByText(nickname)).toBeVisible()
    await pwExpect(
      commentOf(page, comment).getByRole('button', { name: ko('board.comments.edit') }),
    ).toHaveAttribute('aria-label', new RegExp(`: ${nickname}$`))
    pwExpect(await page.locator('body').innerText()).not.toMatch(/acc_[0-9a-f]/i)
    await page.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    await pwExpect(
      page.getByRole('row').filter({ hasText: title }).getByText(nickname),
    ).toBeVisible()
    pwExpect(await page.locator('body').innerText()).not.toMatch(/acc_[0-9a-f]/i)
  })

  it('delete the account → signed-out landing → sign in again → "cancel the deletion?" → cancel → signed in', async () => {
    await page.goto(`${baseUrl}/account`)
    const section = page.getByRole('region', { name: auth.sectionDelete })
    await section.getByLabel(auth.currentPassword).fill(password)
    await section.getByRole('button', { name: auth.deleteButton }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(auth.deleteTypedLabel).fill(auth.deleteTypedPhrase)
    await dialog.getByRole('button', { name: auth.deleteConfirm }).click()
    await pwExpect(heading(auth.accountDeletedTitle)).toBeVisible()
    await page.getByRole('link', { name: auth.accountDeletedAction }).click()
    await pwExpect(heading(auth.signInTitle)).toBeVisible()
    await fillSignIn(page, { email, password })
    await pwExpect(heading(auth.deletionPendingTitle)).toBeVisible()
    await page.getByRole('button', { name: auth.deletionCancelAction }).click()
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
    // 닉네임은 그대로다(탈퇴 유예는 이름을 지우지 않는다)
    await page.goto(`${baseUrl}/account`)
    await pwExpect(
      page.getByRole('form', { name: auth.sectionProfile }).getByLabel(auth.displayName),
    ).toHaveValue(nickname)
  })
})

describe('a mailed sign-in link is redeemed exactly once', () => {
  it('opening it once sends one redeem request (200), signs in and shows no "unusable link" error', async () => {
    const linkEmail = `e2e-redeem-${stamp}@example.com`
    const requested = await fetch(`${apiUrl}/api/v1/auth/magic-link/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: linkEmail }),
    })
    pwExpect(requested.status).toBe(202)
    const link = await waitForLink(mailUrl, linkEmail, 'magic-link', { seen })
    const statuses: number[] = []
    page.on(
      'response',
      (r) => r.url().includes('/auth/magic-link/redeem') && statuses.push(r.status()),
    )
    await page.goto(baseUrl)
    await page.evaluate(() => window.localStorage.clear()) // 앞 계정의 세션을 비운다
    await page.goto(`${baseUrl}${link.path}`)
    await acceptLegalGate(page, apiUrl)
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
    await pwExpect(page.getByText(auth.magicLinkInvalidTitle)).toHaveCount(0)
    page.removeAllListeners('response')
    pwExpect(statuses).toEqual([200]) // 두 번째 호출(410)이 없다
  })
})

describe('the nickname reminder band', () => {
  // 백엔드는 새 계정마다 닉네임을 만들어 준다(`user-1a2b3c`) — 가입 · 링크 로그인 · 소셜 어느 경로로도 닉네임 없는 계정을 화면이나 API 로 준비할 수 없다.
  // 띠(`NicknameNudge`)와 대화상자는 스토리 · 단위 테스트(`apps/sample` 의 NicknameNudge.test.tsx)가 맡는다
  it.skip('a signed-in account without a nickname sees the band and can set one in place', () =>
    undefined)
})
