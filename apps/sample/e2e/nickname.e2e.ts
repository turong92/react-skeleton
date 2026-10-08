import { expect as baseExpect } from 'playwright/test'
import type { Browser, Locator, Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  article,
  chooseProfile,
  commentForm,
  commentOf,
  openBoard,
  openPost,
  postComment,
  postForm,
  writePost,
} from './boardSteps'
import {
  acceptLegalGate,
  agreeToLegal,
  auth,
  createProfile,
  chooseLoginIdViaGate,
  dismissConsent,
  ensureProfile,
  fillLoginId,
  fillSignIn,
  ko,
  launch,
  uniqueLoginId,
} from './helpers'
import { waitForCode, waitForLink } from './mail'

/*
 * 닉네임 묶음의 새 흐름 — 가입에서 닉네임(= 첫 닉네임) → 게시판 글 · 댓글에 작성 닉네임(계정 id 는 안 보인다 · 사용자에게 닉네임은 하나다) → 탈퇴 → 로그인 → 「탈퇴를 취소할까요?」 → 취소,
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
  it('sign-up asks for a nickname (required; the hint says it becomes the first nickname) and the greeting is neutral', async () => {
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(email)
    await fillLoginId(page, uniqueLoginId()) // 샘플 백엔드는 가입에서 로그인 아이디를 받는다
    await page.getByLabel(auth.password).first().fill(password)
    await page.getByLabel(auth.passwordConfirm).fill(password)
    await agreeToLegal(page, apiUrl)
    // 닉네임은 필수 — 비우고 누르면 이유를 말하고 보내지 않는다
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(page.getByText(auth.problemDisplayNameMissing).first()).toBeVisible()
    await pwExpect(page.getByText(ko('signup.nicknameHint'))).toBeVisible()
    await page.getByLabel(auth.displayName).fill(nickname)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    await pwExpect(heading(auth.codeTitle, 2)).toBeVisible()
    const code = await waitForCode(mailUrl, email, 'verify', { seen })
    await enterCode(page, code.code)
    await pwExpect(heading(ko('dashboard.greetingNeutral'))).toBeVisible() // 계정 이름으로 인사하지 않는다
  })

  it('the first nickname is the sign-up one; a post written with another nickname shows that nickname — never the first one or the account id', async () => {
    // 백엔드는 첫 프로필을 자동으로 만든다 — 닉네임이 있는 계정은 그 이름을 한 번 복사한다(이후 따로 간다)
    pwExpect((await ensureProfile({ email, password }))?.name).toBe(nickname)
    const profileName = `프${String(stamp).slice(-6)}`
    await createProfile({ email, password }, profileName)
    const title = `프로필 시험 ${stamp}`
    const comment = `댓글 ${stamp}`
    await openBoard(page)
    await writePost(page, title, '본문이에요', profileName)
    await pwExpect(article(page).getByText(profileName)).toBeVisible()
    await pwExpect(article(page).getByText(nickname)).toHaveCount(0)
    await postComment(page, comment, profileName)
    await pwExpect(commentOf(page, comment).getByText(profileName)).toBeVisible()
    await pwExpect(commentOf(page, comment).getByText(nickname)).toHaveCount(0)
    await pwExpect(
      commentOf(page, comment).getByRole('button', { name: ko('board.comments.edit') }),
    ).toHaveAttribute('aria-label', new RegExp(`: ${profileName}$`))
    pwExpect(await page.locator('body').innerText()).not.toMatch(/acc_[0-9a-f]/i)
    await page.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    await pwExpect(
      page.getByRole('row').filter({ hasText: title }).getByText(profileName),
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
    // 닉네임은 그대로다(탈퇴 유예는 이름을 지우지 않는다) — 설정의 「내 닉네임」에 가입 때 닉네임이 있다. 계정 화면에는 닉네임 칸이 없다
    await page.goto(`${baseUrl}/settings`)
    await pwExpect(
      page.getByRole('region', { name: ko('settings.nicknames') }).getByText(nickname),
    ).toBeVisible()
    await page.goto(`${baseUrl}/account`)
    await pwExpect(page.getByRole('region', { name: ko('account.localeSection') })).toBeVisible()
    await pwExpect(page.getByLabel(auth.displayName, { exact: true })).toHaveCount(0)
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
    await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId(), true) // 링크로 처음 들어온 계정은 아이디부터(가장 바깥 막)
    await acceptLegalGate(page, apiUrl, true)
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
    await pwExpect(page.getByText(auth.magicLinkInvalidTitle)).toHaveCount(0)
    // 실시간 알림(SSE)이 연결을 열어 두어 네트워크가 잠잠해지지 않는다 — 대신 늦게 나가는 두 번째 호출이 있다면 잡히도록 잠시 지켜본다
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    page.removeAllListeners('response')
    pwExpect(statuses).toEqual([200]) // 두 번째 호출(410)이 없다
  })
})

describe('an account made without a nickname (a mailed sign-in link) is asked for one — in place, never blocked', () => {
  // 샘플 백엔드는 닉네임 자동 생성을 껐다(`fallback: NONE`) — 링크로 가입한 계정은 이름 없이 만들어진다(첫 닉네임도 이름이 없다). 앞의 링크 로그인 테스트의 그 계정으로 이어 간다
  const reminder = () => page.getByRole('region', { name: ko('nickname.bannerLabel') })

  it('the band has one primary button; the dialog names the unnamed first nickname in place — the band goes away', async () => {
    await pwExpect(reminder()).toBeVisible()
    await pwExpect(reminder().getByText(ko('nickname.bannerBody'))).toBeVisible()
    await reminder()
      .getByRole('button', { name: ko('nickname.nudgeAction') })
      .click()
    const dialog = page.getByRole('dialog')
    await pwExpect(dialog.getByRole('heading', { name: ko('nickname.dialogTitle') })).toBeVisible()
    // 이름 없는 첫 닉네임에 「바꾸기」로 이름을 붙인다 — 비우고 저장하면 이유를 말한다
    const row = dialog.getByRole('listitem')
    await pwExpect(row).toHaveCount(1)
    await row.getByRole('button', { name: ko('author.renameAction') }).click()
    await row.getByRole('button', { name: ko('author.save'), exact: true }).click()
    await pwExpect(row.getByText(ko('author.nameRequired'))).toBeVisible()
    const chosen = `링크${String(Date.now()).slice(-6)}`
    await row.getByRole('textbox').fill(chosen)
    await row.getByRole('button', { name: ko('author.save'), exact: true }).click()
    await pwExpect(dialog.getByRole('listitem').filter({ hasText: chosen })).toBeVisible()
    await closeDialog(dialog)
    await pwExpect(dialog).toHaveCount(0)
    await pwExpect(reminder()).toHaveCount(0) // 이름 있는 닉네임이 생겼다
    await pwExpect(heading(ko('dashboard.greetingNeutral'))).toBeVisible()
  })

  /** 링크 로그인으로 새 계정(닉네임 없음 — 백엔드의 첫 닉네임은 이름이 없다)을 이 브라우저에 로그인한다 */
  async function signInAsFreshAccount(label: string) {
    const email = `e2e-${label}-${stamp}@example.com`
    const requested = await fetch(`${apiUrl}/api/v1/auth/magic-link/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    pwExpect(requested.status).toBe(202)
    const link = await waitForLink(mailUrl, email, 'magic-link', { seen })
    await page.goto(baseUrl)
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}${link.path}`)
    await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId(), true) // 링크로 처음 들어온 계정은 아이디부터(가장 바깥 막)
    await acceptLegalGate(page, apiUrl, true)
    await pwExpect(heading(/안녕하세요/)).toBeVisible()
  }
  const closeDialog = (dialog: Locator) =>
    dialog
      .getByRole('button', { name: ko('common.close') })
      .first()
      .click()

  it('the band is one message with one way in (no link away, no word 「프로필」); "나중에" hides it until the next visit; settings says 「내 닉네임」', async () => {
    // 앞 테스트에서 닉네임을 정한 계정이라 띠는 이미 없다 — 새 계정으로
    await signInAsFreshAccount('band')
    await pwExpect(reminder().getByText(ko('nickname.bannerTitle'))).toBeVisible()
    await pwExpect(reminder().getByRole('link')).toHaveCount(0)
    await pwExpect(reminder().getByRole('button')).toHaveCount(2) // 「닉네임 정하기」 · 「나중에」
    pwExpect(await reminder().innerText()).not.toContain('프로필')
    await reminder()
      .getByRole('button', { name: ko('nickname.later') })
      .click()
    await pwExpect(reminder()).toHaveCount(0)
    await page.reload()
    await pwExpect(reminder()).toBeVisible() // 저장하지 않으니 다음 방문에는 다시 보인다
    await page.getByRole('link', { name: ko('nav.settings'), exact: true }).click()
    await pwExpect(page.getByRole('region', { name: ko('settings.nicknames') })).toBeVisible()
    pwExpect(await page.locator('main').innerText()).not.toContain('프로필')
    // 계정 카드에는 닉네임 줄이 없고, 계정 관리는 줄 전체가 눌리는 링크 카드다
    await pwExpect(
      page.getByRole('link', { name: new RegExp(ko('settings.manageAccount')) }),
    ).toBeVisible()
  })

  it('the write button asks to name a nickname first when there is only the unnamed first one (the same dialog), and once a named one exists the editor opens', async () => {
    await signInAsFreshAccount('nonick')
    // 닉네임 목록 응답이 와야 「이름 있는 닉네임이 없다」를 안다 — 그 전에 누르면 막지 못한다
    const listed = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/v1/author-profiles' && r.request().method() === 'GET',
    )
    await openBoard(page)
    await (await listed).finished() // 응답 본문까지 끝나야 화면이 목록을 안다
    await page.getByRole('button', { name: ko('board.write') }).click()
    const dialog = page.getByRole('dialog')
    await pwExpect(dialog.getByRole('heading', { name: ko('nickname.dialogTitle') })).toBeVisible()
    await pwExpect(page).toHaveURL(/\/board$/) // 글쓰기 화면으로 넘어가지 않았다
    const nick = `게이트${String(Date.now()).slice(-6)}`
    await dialog.getByLabel(ko('author.nameLabel')).fill(nick)
    await dialog.getByRole('button', { name: ko('author.add'), exact: true }).click()
    // 닉네임 없는 계정의 자동 첫 닉네임(이름 없음)과 방금 만든 닉네임 — 둘
    await pwExpect(dialog.getByRole('listitem').filter({ hasText: nick })).toBeVisible()
    await pwExpect(dialog.getByRole('listitem')).toHaveCount(2)
    await closeDialog(dialog)
    await pwExpect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: ko('board.write') }).click()
    await pwExpect(page.getByLabel(new RegExp(ko('board.form.title')))).toBeVisible()
  })

  it('/board/new opened directly: the picker offers "닉네임 정하기"; naming the unnamed first nickname in the dialog keeps the draft and moves the focus to the picker', async () => {
    await signInAsFreshAccount('direct')
    await page.goto(`${baseUrl}/board/new`)
    const form = postForm(page)
    const draft = form.getByLabel(new RegExp(ko('board.form.title')))
    await draft.fill('쓰던 제목')
    // 목록이 오면(= 이름 있는 닉네임이 없음을 알면) 선택기가 「닉네임 정하기」만 보인다 — 불러오는 동안은 단추 모양의 「불러오는 중」
    const create = form.getByRole('button', { name: ko('author.createProfile') })
    await pwExpect(create).toBeVisible()
    await pwExpect(create).toHaveAttribute('aria-haspopup', 'dialog')
    // 고르지 않고 보내면 「먼저 정해 주세요」(고를 것이 없다)
    await form.getByLabel(new RegExp(ko('board.form.body'))).fill('본문')
    await page.getByRole('button', { name: ko('board.form.submitCreate') }).click()
    await pwExpect(page.getByText(ko('board.authorRequiredCreate'))).toBeVisible()
    await create.click()
    const dialog = page.getByRole('dialog')
    await pwExpect(dialog.getByRole('heading', { name: ko('nickname.dialogTitle') })).toBeVisible()
    // 이름 없는 첫 닉네임에 이름을 붙인다(바꾸기)
    const row = dialog.getByRole('listitem')
    await pwExpect(row).toHaveCount(1)
    await row.getByRole('button', { name: ko('author.renameAction') }).click()
    const renamed = `직행${String(Date.now()).slice(-6)}`
    await row.getByRole('textbox').fill(renamed)
    await row.getByRole('button', { name: ko('author.save'), exact: true }).click()
    await pwExpect(dialog.getByRole('listitem').filter({ hasText: renamed })).toBeVisible()
    await closeDialog(dialog)
    await pwExpect(dialog).toHaveCount(0)
    await pwExpect(draft).toHaveValue('쓰던 제목') // 쓰던 글이 남는다
    await pwExpect(reminder()).toHaveCount(0) // 이름 있는 닉네임이 생겼으니 띠도 사라진다
    // 「닉네임 정하기」 단추는 사라졌고, 선택기 자리의 단추가 포커스를 받는다(body 로 떨어지지 않는다)
    await pwExpect(form.locator('[data-author-slot] button[aria-haspopup="menu"]')).toBeFocused()
    await chooseProfile(form, renamed)
    await page.getByRole('button', { name: ko('board.form.submitCreate') }).click()
    await page.getByRole('heading', { level: 2, name: '쓰던 제목' }).waitFor()
  })

  it('the comment form without a named nickname offers only "닉네임 정하기" — its dialog keeps the comment', async () => {
    await signInAsFreshAccount('commenter')
    await openBoard(page)
    await openPost(page, '쓰던 제목')
    const text = `쓰던 댓글 ${stamp}`
    await page.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(text)
    const create = commentForm(page).getByRole('button', { name: ko('author.createProfile') })
    await pwExpect(create).toBeVisible()
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(page.getByText(ko('board.authorRequiredCreate'))).toBeVisible()
    await create.click()
    const dialog = page.getByRole('dialog')
    await pwExpect(dialog.getByRole('heading', { name: ko('nickname.dialogTitle') })).toBeVisible()
    await closeDialog(dialog)
    await pwExpect(dialog).toHaveCount(0)
    await pwExpect(
      page.getByRole('textbox', { name: ko('board.comments.newComment') }),
    ).toHaveValue(text) // 쓰던 댓글이 남는다
    // 아직 이름 있는 닉네임이 없으니 「닉네임 정하기」 단추가 그대로 있고, 닫으면 포커스가 거기로 돌아온다
    await pwExpect(create).toBeFocused()
  })
})
