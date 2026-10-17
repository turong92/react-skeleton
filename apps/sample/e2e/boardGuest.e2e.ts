import { expect as pwExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  MODERATOR,
  USER,
  commentForm,
  commentOf,
  openBoard,
  openPost,
  signInAs,
  signOut,
  writePost,
} from './boardSteps'
import { dismissConsent, ko, launch } from './helpers'

/*
 * 비회원 · 승인 흐름 — 로그아웃 상태의 방문자가 이름 · 비밀번호로 댓글을 쓰면 승인 대기 → 글 주인이 로그인해 승인 → 공개 →
 * 방문자가 자기 댓글을 고치면 고친 내용은 대기(공개본은 그대로) → 글 주인이 고친 내용을 거절. 그리고 방문자의 새 글은 운영자가 승인한다.
 * 진짜 백엔드(`general` 게시판: 비회원 쓰기 ALL · 비회원 글 · 댓글 승인 GUESTS · 글 주인 댓글 관리) · 진짜 브라우저. 앞 단계의 결과에 기댄다.
 * 비회원 그림: 견본은 비회원 업로드를 켠다(`skeleton.storage.web.guest`) - 로그인 없이 그림을 올려 댓글에 붙이고, 서버가 비회원 업로드 키만 받는지 본다.
 * 비회원의 내려받기는 로그인이 필요해 그림이 화면에 그려지지는 않는다(응답의 키로 확인한다).
 */
const baseUrl = inject('baseUrl')

let browser: Browser
let page: Page
let postUrl = ''

const TITLE = '비회원 시연 글'
const COMMENT = '지나가던 손님이 남깁니다'
const EDITED = '손님이 고친 말씀입니다'
const GUEST_POST = '손님이 쓴 새 글'
const NAME = '손님'
const PASSWORD = 'pass1234'

beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

async function visit(url: string) {
  await page.goto(url)
  await dismissConsent(page)
}

/** 로그인한 채로 글 열기 - 주소를 새로 열면 이 앱은 세션을 메모리에서만 들고 있어 비회원이 되므로, 메뉴로 들어간다 */
async function openAsMember() {
  await openBoard(page)
  await openPost(page, TITLE)
}

async function fillGuest(scope: Page | ReturnType<Page['locator']>, name?: string) {
  if (name) await scope.getByLabel(ko('board.guest.name')).fill(name)
  await scope.getByLabel(ko('board.guest.secret')).fill(PASSWORD)
}

describe('Board — guests, approval and edited versions against the real backend', () => {
  it('a member writes a post (published at once - approval only applies to guests)', async () => {
    await signInAs(page, baseUrl, USER)
    await openBoard(page)
    await writePost(page, TITLE, '비회원도 댓글을 남길 수 있어요.')
    postUrl = page.url()
    await signOut(page)
  })

  it('a signed-out visitor asks for a name and a password, then the comment waits - and the public thread has no place for it', async () => {
    await visit(postUrl)
    await pwExpect(page.getByRole('heading', { level: 2, name: TITLE })).toBeVisible()
    await page.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(COMMENT)
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(page.getByText(ko('board.guest.nameRequired'))).toBeVisible()
    await fillGuest(page, NAME)
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(page.getByText(ko('board.guest.pending'))).toBeVisible()
    await pwExpect(page.getByText(COMMENT)).toBeVisible() // 방금 쓴 것을 이 자리에서만 본다
    await page.reload()
    await pwExpect(page.getByRole('heading', { level: 2, name: TITLE })).toBeVisible()
    await pwExpect(page.getByText(COMMENT)).toHaveCount(0) // 다시 읽으면 공개 스레드에는 자리가 없다
  })

  it('the post owner signs in, sees the waiting comment and approves it - then it is public with the (guest) mark', async () => {
    await signInAs(page, baseUrl, USER)
    await openAsMember()
    await pwExpect(page.getByText(COMMENT)).toBeVisible()
    await pwExpect(page.getByText(ko('board.pending.badge')).first()).toBeVisible()
    await page.getByRole('button', { name: `${ko('board.comments.approve')}: ${NAME}` }).click()
    await pwExpect(page.getByText(ko('board.pending.badge'))).toHaveCount(0)
    await signOut(page)
    await visit(postUrl)
    await pwExpect(page.getByText(COMMENT)).toBeVisible()
    await pwExpect(page.getByText(ko('board.author.guest')).first()).toBeVisible()
  })

  it('the visitor edits their own comment: the earlier text stays public, the edit waits', async () => {
    await page.getByRole('button', { name: `${ko('board.comments.edit')}: ${NAME}` }).click()
    const box = page.getByRole('textbox', { name: ko('board.comments.editField') })
    await box.fill(EDITED)
    // 새 댓글 칸에도 비밀번호 칸이 있다 - 고치는 폼 안의 것
    await page
      .locator('form')
      .filter({ has: box })
      .getByLabel(ko('board.guest.secret'))
      .fill(PASSWORD)
    await page.getByRole('button', { name: ko('board.comments.save') }).click()
    await pwExpect(page.getByText(ko('board.guest.editPending'))).toBeVisible()
    await page.reload()
    await pwExpect(page.getByText(COMMENT)).toBeVisible()
    await pwExpect(page.getByText(EDITED)).toHaveCount(0)
  })

  it('the post owner compares both texts and rejects the edit - the public text is unchanged', async () => {
    await signInAs(page, baseUrl, USER)
    await openAsMember()
    const revision = page.getByTestId('comment-revision')
    await pwExpect(revision).toBeVisible()
    await pwExpect(revision).toContainText(COMMENT)
    await pwExpect(revision).toContainText(EDITED)
    await page.getByRole('button', { name: `${ko('board.revision.reject')}: ${NAME}` }).click()
    await pwExpect(page.getByTestId('comment-revision')).toHaveCount(0)
    await pwExpect(page.getByText(COMMENT)).toBeVisible()
    await signOut(page)
  })

  it('a visitor posts a new article: it waits, only the moderator sees it in the queue, and approving publishes it', async () => {
    await visit(`${baseUrl}/board/new`)
    await page.getByLabel(new RegExp(ko('board.form.title'))).fill(GUEST_POST)
    await page
      .getByLabel(new RegExp(ko('board.form.body')))
      .fill('운영자 승인을 기다리는 글입니다.')
    await fillGuest(page, NAME)
    await page.getByRole('button', { name: ko('board.form.submitCreate') }).click()
    await pwExpect(
      page.getByRole('heading', { name: ko('board.guest.postPendingTitle') }),
    ).toBeVisible()
    await visit(`${baseUrl}/board`)
    await pwExpect(page.getByRole('link', { name: GUEST_POST })).toHaveCount(0)

    await signInAs(page, baseUrl, MODERATOR)
    await openBoard(page)
    await page.getByRole('button', { name: ko('board.queue.pending') }).click()
    await page.getByRole('link', { name: GUEST_POST }).click()
    await page.getByRole('heading', { level: 2, name: GUEST_POST }).waitFor()
    await page
      .getByRole('button', { name: ko('board.comments.approve'), exact: true })
      .first()
      .click()
    await pwExpect(page.getByText(ko('board.pending.post'))).toHaveCount(0)
    await signOut(page)
    await visit(`${baseUrl}/board`)
    await pwExpect(page.getByRole('link', { name: GUEST_POST })).toBeVisible()
  })

  it("a guest post's owner manages the comments waiting on it with the post's password, signed out", async () => {
    await visit(`${baseUrl}/board`)
    await page.getByRole('link', { name: GUEST_POST }).click()
    await pwExpect(page.getByRole('heading', { level: 2, name: GUEST_POST })).toBeVisible()
    // 다른 손님이 이 글에 댓글을 단다 - 비회원 댓글이라 승인 대기
    const OTHER = '글주인이 승인할 손님 댓글'
    await page.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(OTHER)
    // 사진도 붙인다 - 글 주인은 비밀번호로 승인 전에 그 사진을 볼 수 있어야 한다
    await commentForm(page)
      .locator('input[type=file]')
      .first()
      .setInputFiles({
        name: 'dot.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64',
        ),
      })
    await pwExpect(page.getByText(ko('board.pictures.attached'))).toBeVisible({ timeout: 30_000 })
    await fillGuest(commentForm(page), '지나가는손님')
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(page.getByText(ko('board.guest.pending'))).toBeVisible()
    // 글을 쓴 이 브라우저의 주인 메뉴 - 글의 비밀번호로 대기 목록을 열고 승인한다
    // 틀린 비밀번호: 한 번만 시도하고(다시 시도하지 않는다) 입력 칸으로 돌아온다 - 틀린 값을 쥔 채 남지 않는다
    await page.getByLabel(ko('board.ownerQueue.secret')).fill('wrong-password')
    await page.getByRole('button', { name: ko('board.ownerQueue.open') }).click()
    await pwExpect(page.getByText(ko('board.ownerQueue.failed'))).toBeVisible()
    await pwExpect(page.getByLabel(ko('board.ownerQueue.secret'))).toBeVisible()
    await page.getByLabel(ko('board.ownerQueue.secret')).fill(PASSWORD)
    await page.getByRole('button', { name: ko('board.ownerQueue.open') }).click()
    await pwExpect(page.getByTestId('owner-queue')).toContainText(OTHER)
    // 승인 전 사진: 글의 비밀로 받은 서명 주소로 보인다 (Q2')
    const queued = page.getByTestId('owner-queue').getByRole('img')
    await pwExpect(queued).toBeVisible({ timeout: 30_000 })
    await pwExpect
      .poll(() => queued.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true)
    await page
      .getByRole('button', { name: `${ko('board.comments.approve')}: 지나가는손님` })
      .click()
    await pwExpect(page.getByTestId('owner-queue')).toHaveCount(0)
    await page.reload()
    await pwExpect(page.getByText(OTHER)).toBeVisible() // 승인되어 공개 스레드에 있다
  })

  it('a signed-out visitor uploads a picture without signing in and the comment carries a guest-issued key', async () => {
    await visit(postUrl)
    await pwExpect(page.getByRole('heading', { level: 2, name: TITLE })).toBeVisible()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    )
    await page
      .getByRole('textbox', { name: ko('board.comments.newComment') })
      .fill('손님이 사진을 붙인 댓글')
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png })
    await pwExpect(page.getByText(ko('board.pictures.attached'))).toBeVisible({ timeout: 30_000 })
    await fillGuest(page, NAME)
    const written = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/posts\/\d+\/comments$/.test(r.url()),
    )
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    const resp = await written
    const body = (await resp.json()) as { value: { attachments: string[] } }
    pwExpect(body.value.attachments).toHaveLength(1)
    pwExpect(body.value.attachments[0]).toMatch(/\/g\/[0-9a-f-]{36}\.[0-9a-f]{32}\/file\.png$/)
    await pwExpect(page.getByText(ko('board.guest.pending'))).toBeVisible()
  })

  it('the waiting picture is private, approving makes it public for anyone, hiding takes it away again', async () => {
    const TEXT = '손님이 사진을 붙인 댓글'
    await signInAs(page, baseUrl, USER)
    await openAsMember()
    // 승인 전: 글 주인은 서명된(비공개) 주소로 본다 - 공개 영역에는 없다
    const waiting = commentOf(page, TEXT).getByRole('img')
    await pwExpect(waiting).toBeVisible()
    const privateSrc = (await waiting.getAttribute('src')) ?? ''
    pwExpect(privateSrc).toMatch(/signature/i)
    pwExpect(privateSrc).not.toContain('/files/')
    await page.getByRole('button', { name: `${ko('board.comments.approve')}: ${NAME}` }).click()
    // 승인 뒤: 공개 주소(키에 계정 · 비회원 표시 · 원래 키가 없다)
    await pwExpect
      .poll(async () => (await commentOf(page, TEXT).getByRole('img').getAttribute('src')) ?? '')
      .toMatch(/^\/files\/public\/b\/[0-9a-f]{32}\.png$/)
    // 같은 출처의 상대 주소 - 요청에는 절대 주소가 필요하다 (img.src 가 해석한 값)
    const publicUrl = await commentOf(page, TEXT)
      .getByRole('img')
      .evaluate((el: HTMLImageElement) => el.src)
    pwExpect(publicUrl).not.toMatch(/uploads|\/g\/|acc_/)
    await signOut(page)
    await visit(postUrl)
    const seen = commentOf(page, TEXT).getByRole('img')
    await pwExpect(seen).toBeVisible()
    await pwExpect
      .poll(() => seen.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true)
    pwExpect((await page.request.get(publicUrl)).status()).toBe(200)
    // 가린 뒤: 공개 영역에서 사라진다
    await signInAs(page, baseUrl, USER)
    await openAsMember()
    await commentOf(page, TEXT)
      .getByRole('button', { name: `${ko('board.comments.hide')}: ${NAME}` })
      .click()
    await pwExpect.poll(async () => (await page.request.get(publicUrl)).status()).not.toBe(200)
    await signOut(page)
  })

  it('a member attaches a picture to a comment and everyone sees it', async () => {
    await signInAs(page, baseUrl, USER)
    await openAsMember()
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    )
    await page
      .getByRole('textbox', { name: ko('board.comments.newComment') })
      .fill('사진을 붙인 댓글')
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png })
    await pwExpect(page.getByRole('button', { name: ko('board.pictures.remove') })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(
      page.getByRole('list', { name: ko('board.comments.attachments') }).getByRole('img'),
    ).toBeVisible({ timeout: 30_000 })
    await signOut(page)
    // 회원의 사진도 공개된 댓글이라 로그인하지 않은 사람에게 공개 주소로 보인다
    await visit(postUrl)
    const memberPicture = commentOf(page, '사진을 붙인 댓글').getByRole('img')
    await pwExpect(memberPicture).toBeVisible({ timeout: 30_000 })
    await pwExpect
      .poll(() =>
        memberPicture.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
      )
      .toBe(true)
    pwExpect(await memberPicture.getAttribute('src')).toMatch(
      /^\/files\/public\/b\/[0-9a-f]{32}\.png$/,
    )
  })
})
