import { expect as pwExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  USER,
  MODERATOR,
  article,
  boardConfig,
  commentOf,
  openBoard,
  openPost,
  postComment,
  pressReaction,
  reaction,
  replyTo,
  signInAs,
  signOut,
  writePost,
} from './boardSteps'
import { ko, launch } from './helpers'

/*
 * 게시판 여정 — 로그인 → 글쓰기(검증 → 올리기) → 글에 반응(좋아요 → 공감으로 바꾸기, 새로고침해도 유지) → 댓글 → 대댓글 → 대대댓글(접힘) →
 * 댓글에 반응 → 목록의 숫자 → 내 글 고치기 · 내 댓글 지우기 → 운영자가 글을 고정하고 댓글을 숨김(작성자에게는 자리 표시).
 * 진짜 백엔드 · 진짜 브라우저. 앞 단계의 결과에 기댄다. 서버 설정(`GET /boards/config`)에 `EMPATHY` 가 있어야 한다(샘플 백엔드가 켠다).
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')

let browser: Browser
let page: Page
let single = true

const TITLE = '점심 뭐 먹지'
const BODY = '회사 근처에서 먹을 곳을 추천해 주세요.'
const FIRST = '저는 국밥이 좋아요'
const REPLY = '국밥 어디가 맛있나요?'
const DEEP = '역 앞 골목 안쪽이요'

beforeAll(async () => {
  ;({ browser, page } = await launch())
  const config = await boardConfig(apiUrl, USER)
  if (!config.reactionTypes.includes('EMPATHY'))
    throw new Error(
      `the sample backend must enable the EMPATHY reaction (config: ${config.reactionTypes})`,
    )
  single = config.reactionMode === 'SINGLE'
  if (!(await boardConfig(apiUrl, MODERATOR)).canModerate)
    throw new Error(`${MODERATOR.email} is not a moderator — set E2E_MOD_EMAIL / E2E_MOD_PASSWORD`)
})
afterAll(async () => {
  await browser?.close()
})

describe('Board — posts, nested comments and typed reactions against the real backend', () => {
  it('signs in and opens the board from the menu', async () => {
    await signInAs(page, baseUrl, USER)
    await openBoard(page)
    await pwExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  it('write form: an empty post is refused on the client, then it publishes and opens the post', async () => {
    await page.getByRole('button', { name: ko('board.write') }).click()
    await page.getByRole('button', { name: ko('board.form.submitCreate') }).click()
    await pwExpect(page.getByText(ko('board.form.titleRequired'))).toBeVisible()
    await pwExpect(page.getByText(ko('board.form.bodyRequired'))).toBeVisible()
    await pwExpect(page.getByLabel(new RegExp(ko('board.form.title')))).toBeFocused()
    await page.getByRole('button', { name: ko('common.cancel') }).click()
    await writePost(page, TITLE, BODY)
    await pwExpect(page.getByText(BODY)).toBeVisible()
  })

  it('reacts to the post: 좋아요, then 공감 (an extra type the server reports) — counts follow and survive a reload', async () => {
    const post = article(page)
    await pwExpect(post.getByRole('group', { name: ko('board.reactions.group') })).toBeVisible()
    await pressReaction(page, reaction(post, 'LIKE', 0))
    await pwExpect(reaction(post, 'LIKE', 1)).toHaveAttribute('aria-pressed', 'true')
    await pressReaction(page, reaction(post, 'EMPATHY', 0))
    await pwExpect(reaction(post, 'EMPATHY', 1)).toHaveAttribute('aria-pressed', 'true')
    // SINGLE 이면 옮겨 간 것(좋아요 0), PER_TYPE 이면 둘 다 1
    await pwExpect(reaction(post, 'LIKE', single ? 0 : 1)).toBeVisible()

    await page.reload()
    await pwExpect(reaction(article(page), 'EMPATHY', 1)).toHaveAttribute('aria-pressed', 'true')
    // 다시 누르면 취소
    await pressReaction(page, reaction(article(page), 'EMPATHY', 1))
    await pwExpect(reaction(article(page), 'EMPATHY', 0)).toHaveAttribute('aria-pressed', 'false')
    await pressReaction(page, reaction(article(page), 'EMPATHY', 0))
    await pwExpect(reaction(article(page), 'EMPATHY', 1)).toHaveAttribute('aria-pressed', 'true')
  })

  it('comments, replies to the comment, and replies to the reply — a reply of depth 2 sits behind "답글 N개 더 보기" after a reload', async () => {
    await pwExpect(page.getByText(ko('board.comments.empty'))).toBeVisible()
    await postComment(page, FIRST)
    await replyTo(page, FIRST, REPLY)
    await replyTo(page, REPLY, DEEP) // 깊이 2 — 방금 단 답글은 펼쳐져 보인다
    // 최대 깊이(2)의 댓글에는 더 답할 수 없다
    await pwExpect(
      commentOf(page, DEEP).getByRole('button', {
        name: new RegExp(`^${ko('board.comments.reply')}: `),
      }),
    ).toHaveCount(0)

    await page.reload()
    await pwExpect(commentOf(page, REPLY)).toBeVisible()
    await pwExpect(page.getByText(DEEP)).toHaveCount(0)
    await page.getByRole('button', { name: ko('board.comments.showReplies', { count: 1 }) }).click()
    await pwExpect(page.getByText(DEEP)).toBeVisible()
  })

  it('reacts to a comment, and the board list shows the post totals (comments 3, reactions 1)', async () => {
    const first = commentOf(page, FIRST)
    await pressReaction(page, reaction(first, 'LIKE', 0))
    await pwExpect(reaction(first, 'LIKE', 1)).toHaveAttribute('aria-pressed', 'true')
    await pressReaction(page, reaction(first, 'EMPATHY', 0))
    await pwExpect(reaction(first, 'EMPATHY', 1)).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    // 열은 머리글 이름으로 찾는다(작성자 열이 생기며 위치가 밀렸다) — 위치로 세지 않는다
    const row = page.getByRole('row').filter({ hasText: TITLE })
    await row.waitFor() // 목록이 그려진 뒤에 머리글을 읽는다
    const headers = (await page.getByRole('columnheader').allInnerTexts()).map((h) => h.trim())
    const cell = (header: string) => row.getByRole('cell').nth(headers.indexOf(header) - 1) // 첫 열(제목)은 th scope=row
    await pwExpect(cell(ko('board.list.comments'))).toHaveText('3') // 댓글
    await pwExpect(cell(ko('board.list.reactions'))).toHaveText(single ? '1' : '2') // 반응(글의 공감 — PER_TYPE 이면 좋아요도 남아 있다)
  })

  it('the author edits the post and deletes own comment after a confirmation', async () => {
    await openPost(page, TITLE)
    await page.getByRole('button', { name: ko('board.detail.edit'), exact: true }).click()
    await page.getByLabel(new RegExp(ko('board.form.title'))).fill(`${TITLE} (수정)`)
    await page.getByRole('button', { name: ko('board.form.submitEdit') }).click()
    await page.getByRole('heading', { level: 2, name: `${TITLE} (수정)` }).waitFor()
    await page.getByRole('button', { name: ko('board.comments.showReplies', { count: 1 }) }).click() // 깊이 2 는 접혀 있다

    await commentOf(page, DEEP)
      .getByRole('button', { name: new RegExp(`^${ko('board.comments.delete')}: `) })
      .first()
      .click()
    const dialog = page.getByRole('dialog', { name: ko('board.comments.confirmDeleteTitle') })
    await dialog.getByRole('button', { name: ko('common.cancel') }).click()
    await pwExpect(page.getByText(DEEP)).toBeVisible()
    await commentOf(page, DEEP)
      .getByRole('button', { name: new RegExp(`^${ko('board.comments.delete')}: `) })
      .first()
      .click()
    await dialog.getByRole('button', { name: ko('board.comments.confirmDelete') }).click()
    await pwExpect(page.getByText(DEEP)).toHaveCount(0)
    await pwExpect(page.getByText(ko('board.comments.deleted'))).toBeVisible() // 지운 자리는 남는다
    await signOut(page)
  })

  it('a moderator pins the post and hides a comment; the author then sees the placeholder and no moderation buttons', async () => {
    await signInAs(page, baseUrl, MODERATOR)
    await openBoard(page)
    await openPost(page, `${TITLE} (수정)`)
    await article(page)
      .getByRole('button', { name: ko('board.detail.pin'), exact: true })
      .click()
    await pwExpect(article(page).getByText(ko('board.list.pinned'), { exact: true })).toBeVisible()

    await commentOf(page, REPLY)
      .getByRole('button', { name: new RegExp(`^${ko('board.comments.hide')}: `) })
      .first()
      .click()
    await pwExpect(page.getByText(REPLY)).toHaveCount(0)
    await pwExpect(page.getByText(ko('board.comments.hidden'))).toBeVisible()
    await page
      .getByRole('button', { name: new RegExp(`^${ko('board.comments.restore')}: `) })
      .click()
    await pwExpect(page.getByText(REPLY)).toBeVisible()
    await commentOf(page, REPLY)
      .getByRole('button', { name: new RegExp(`^${ko('board.comments.hide')}: `) })
      .first()
      .click()
    await pwExpect(page.getByText(ko('board.comments.hidden'))).toBeVisible()
    await signOut(page)

    await signInAs(page, baseUrl, USER)
    await openBoard(page)
    const first = page.getByRole('row').nth(1)
    await pwExpect(first).toContainText(`${TITLE} (수정)`) // 고정 글이 맨 위
    await openPost(page, `${TITLE} (수정)`)
    await pwExpect(page.getByText(ko('board.comments.hidden'))).toBeVisible()
    await pwExpect(page.getByText(REPLY)).toHaveCount(0)
    await pwExpect(
      page.getByRole('button', { name: new RegExp(`^${ko('board.comments.hide')}: `) }),
    ).toHaveCount(0)
    await pwExpect(
      article(page).getByRole('button', { name: ko('board.detail.pin'), exact: true }),
    ).toHaveCount(0)
  })
})
