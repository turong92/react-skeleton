import { expect as pwExpect, type Locator, type Page } from 'playwright/test'
import { consentViaApi, dismissConsent, ko } from './helpers'

/*
 * 게시판 여정(board.e2e.ts)과 증거 스크립트(walkthrough.board.shots.ts)가 같이 쓰는 단계 — 화면에서 사람이 하는 일 그대로.
 * 운영자 계정은 백엔드 샘플이 시드한 `moderator@example.com`(MODERATOR 역할) — 다르면 E2E_MOD_EMAIL · E2E_MOD_PASSWORD.
 */

export const USER = { email: 'user@example.com', password: 'password' }
export const MODERATOR = {
  email: process.env.E2E_MOD_EMAIL ?? 'moderator@example.com',
  password: process.env.E2E_MOD_PASSWORD ?? 'password',
}
type Account = { email: string; password: string }

/** 서버 설정(`GET /boards/config`) — 반응 종류 · 모드 · 이 계정이 운영자인가. 샘플 백엔드가 `EMPATHY` 를 켜 두었는지 확인하는 데도 쓴다 */
export async function boardConfig(apiUrl: string, account: Account) {
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  const { value } = (await login.json()) as { value: { accessToken: string } }
  const response = await fetch(`${apiUrl}/api/v1/boards/config`, {
    headers: { Authorization: `Bearer ${value.accessToken}` },
  })
  if (response.status !== 200) throw new Error(`GET /boards/config → ${response.status}`)
  return ((await response.json()) as { value: BoardConfigJson }).value
}
type BoardConfigJson = {
  reactionTypes: string[]
  reactionMode: 'SINGLE' | 'PER_TYPE'
  canModerate: boolean
}

/** 로그인 화면에서 이메일 · 비밀번호로(체험 계정 채우기 버튼이 아니라) */
export async function signInAs(page: Page, baseUrl: string, account: Account) {
  await consentViaApi(account) // legal 모듈이 있는 백엔드: 시드 계정은 동의 기록이 없다(없으면 아무 일도 안 한다)
  await page.goto(`${baseUrl}/login`)
  await dismissConsent(page)
  await page.getByLabel(ko('login.email')).fill(account.email)
  await page.getByLabel(ko('login.password')).fill(account.password)
  await page.getByRole('button', { name: ko('login.submit'), exact: true }).click()
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}

export async function signOut(page: Page) {
  await page
    .getByRole('button', { name: ko('header.signOut') })
    .first()
    .click()
  await page.getByRole('heading', { level: 1, name: ko('login.title') }).waitFor()
}

/** 메뉴의 「게시판」 → 글 목록 */
export async function openBoard(page: Page) {
  await page.getByRole('link', { name: ko('nav.board'), exact: true }).click()
  await page.getByRole('button', { name: ko('board.write') }).waitFor()
}

/** 글쓰기 → 올리기 → 상세(글 제목은 `h2`) */
export async function writePost(page: Page, title: string, body: string) {
  await page.getByRole('button', { name: ko('board.write') }).click()
  await page.getByLabel(new RegExp(ko('board.form.title'))).fill(title)
  await page.getByLabel(new RegExp(ko('board.form.body'))).fill(body)
  await page.getByRole('button', { name: ko('board.form.submitCreate') }).click()
  await page.getByRole('heading', { level: 2, name: title }).waitFor()
}

/** 목록에서 제목 링크로 글 열기 */
export async function openPost(page: Page, title: string) {
  await page.getByRole('link', { name: title }).first().click()
  await page.getByRole('heading', { level: 2, name: title }).waitFor()
}

/** 글 본문 영역(반응 줄은 여기 — 댓글의 반응 줄과 겹치지 않게) */
export const article = (page: Page) => page.getByRole('article')

/** 그 글자를 가진 댓글 하나 — 답글을 품은 바깥 댓글도 걸리니 가장 깊은(문서 순서로 마지막) 것 */
export const commentOf = (page: Page, text: string): Locator =>
  page.locator('[data-status]').filter({ hasText: text }).last()

/** 반응 단추 — 이름은 「라벨 개수」(`좋아요 0`). 아이콘은 낭독에서 빠진다 */
export const reaction = (scope: Locator, type: 'LIKE' | 'DISLIKE' | 'EMPATHY', count: number) =>
  scope
    .getByRole('button', { name: new RegExp(`^${ko(`board.reactions.${type}`)}\\s*${count}$`) })
    .first()

/** 반응 단추를 누르고 서버(PUT · DELETE `/reactions`)의 응답까지 기다린다 — 화면이 낙관적으로 먼저 바뀌므로, 응답 전에 이동 · 새로고침하면 서버 값이 아니라 낙관 값을 본다 */
export async function pressReaction(page: Page, button: Locator) {
  const settled = page.waitForResponse(
    (r) =>
      /\/reactions$/.test(new URL(r.url()).pathname) &&
      ['PUT', 'DELETE'].includes(r.request().method()),
  )
  await button.click()
  await settled
}

export async function postComment(page: Page, text: string) {
  await page.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(text)
  await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
  await pwExpect(page.locator('[data-status] > p').filter({ hasText: text })).toBeVisible()
}

/** 댓글 `parentText` 에 답글 — 보낸 답글이 바로 보인다(접힌 칸이면 펼쳐진다) */
export async function replyTo(page: Page, parentText: string, text: string) {
  await commentOf(page, parentText)
    .getByRole('button', { name: new RegExp(`^${ko('board.comments.reply')}: `) })
    .first()
    .click()
  await page.getByRole('textbox', { name: ko('board.comments.replyField') }).fill(text)
  await page.getByRole('button', { name: ko('board.comments.postReply') }).click()
  await pwExpect(page.getByRole('textbox', { name: ko('board.comments.replyField') })).toHaveCount(
    0,
  )
  await pwExpect(page.locator('[data-status] > p').filter({ hasText: text })).toBeVisible()
}

/** 시드용 — 화면을 거치지 않고 API 로 첫 게시판에 글을 올린다(증거 스크립트의 목록을 채운다). 만든 글의 id 를 돌려준다 */
export async function seedPosts(
  apiUrl: string,
  account: Account,
  posts: Array<{ title: string; body: string }>,
) {
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  const { value } = (await login.json()) as { value: { accessToken: string } }
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${value.accessToken}`,
  }
  const boards = (await (await fetch(`${apiUrl}/api/v1/boards`, { headers })).json()) as {
    values: Array<{ code: string }>
  }
  const code = boards.values[0]?.code
  if (!code) throw new Error('the backend has no board — seed one (skeleton.board.seed-boards)')
  const ids: number[] = []
  for (const [index, post] of posts.entries()) {
    const response = await fetch(`${apiUrl}/api/v1/boards/${code}/posts`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': `e2e-board-${Date.now()}-${index}` },
      body: JSON.stringify(post),
    })
    if (response.status !== 201)
      throw new Error(`seed failed: ${response.status} ${await response.text()}`)
    ids.push(((await response.json()) as { value: { id: number } }).value.id)
  }
  return ids
}
