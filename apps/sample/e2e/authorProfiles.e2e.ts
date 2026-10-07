import {
  expect as baseExpect,
  type Browser,
  type Locator,
  type Page,
  type Request,
} from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  article,
  chooseProfile,
  commentForm,
  commentOf,
  openBoard,
  openPost,
  writePost,
} from './boardSteps'
import { acceptLegalGate, dismissConsent, ko, launch } from './helpers'
import { waitForLink } from './mail'
import { sharedLeafValues } from './valueScan'

/*
 * 작성자 프로필 여정 — 사용자 X 가 설정에서 프로필 둘(A · B)을 만들고, 게시판에서 A 로 글 하나 · B 로 글 하나, A 의 글에 B 로 댓글(같은 스레드에서 다른 프로필로 바꿀 때는 한 줄 확인)을 쓴다.
 * 다른 사용자 Y(다른 브라우저)가 보는 화면에서 두 작성자는 남처럼 서로 다른 이름이고, **Y 가 받은 모든 응답 본문**에 X 의 계정 id · 이메일이 없으며 두 글의 작성자 id 가 서로 다르고 겹치는 값이 없다.
 * X 의 화면에서는 두 프로필의 글 모두 수정 · 삭제 단추가 남고(`mine`), 프로필 이름을 바꾸면 글의 이름도 바뀌고, 프로필을 지우면 글은 「삭제된 사용자」로 남되 단추는 여전히 남는다.
 *
 * 백엔드(kotlin-skeleton `apps/sample`)에 `author-profile` 모듈이 켜져 있어야 한다(B8) — 글 · 댓글 쓰기에 `authorId` 필수, `GET/POST/PATCH/DELETE /api/v1/author-profiles`.
 * 계정은 시드에 기대지 않고 링크 로그인으로 새로 만든다(진짜 메일 = mailpit). 앞 단계의 결과에 기댄다.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')

const stamp = Date.now()
const tail = String(stamp).slice(-6)
const emailX = `e2e-prof-x-${stamp}@example.com`
const emailY = `e2e-prof-y-${stamp}@example.com`
const nameA = `에이${tail}`
const nameA2 = `에이둘${tail}`
const nameB = `비${tail}`
const POST_A = `에이의 글 ${stamp}`
const POST_B = `비의 글 ${stamp}`
const COMMENT_B = `비의 댓글 ${stamp}`
const DELETED = ko('board.author.deleted')
const seen = new Set<string>()

let browserX: Browser
let browserY: Browser
let x: Page
let y: Page
/** X 의 계정 id — X 가 `/account/me` 를 읽을 때 응답에서 잡는다. Y 가 받은 어떤 응답에도 없어야 한다 */
let accountIdX = ''

/** Y 가 받은 `/api/v1/` JSON 응답의 본문 전체 — 스트림(SSE)은 끝나지 않으니 뺀다 */
const received: Array<{ url: string; method: string; status: number; text: string }> = []
const reading: Array<Promise<void>> = []

beforeAll(async () => {
  ;({ browser: browserX, page: x } = await launch())
  ;({ browser: browserY, page: y } = await launch())
  y.on('response', (response) => {
    if (!new URL(response.url()).pathname.startsWith('/api/v1/')) return
    if (!(response.headers()['content-type'] ?? '').includes('json')) return
    reading.push(
      response.text().then(
        (text) =>
          void received.push({
            url: response.url(),
            method: response.request().method(),
            status: response.status(),
            text,
          }),
        () => undefined, // 이동으로 끊긴 응답
      ),
    )
  })
})
afterAll(async () => {
  await browserX?.close()
  await browserY?.close()
})

/** 링크 로그인으로 새 계정 — 메일(mailpit)의 링크를 열고 약관 동의 화면이 있으면 넘긴다 */
async function signUpByLink(page: Page, email: string) {
  const requested = await fetch(`${apiUrl}/api/v1/auth/magic-link/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  pwExpect(requested.status).toBe(202)
  const link = await waitForLink(mailUrl, email, 'magic-link', { seen })
  await page.goto(baseUrl)
  await dismissConsent(page)
  await page.goto(`${baseUrl}${link.path}`)
  await acceptLegalGate(page, apiUrl)
  await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
}

const profiles = (page: Page) => page.getByRole('region', { name: ko('settings.nicknames') })
const rowOf = (page: Page, name: string): Locator =>
  profiles(page).getByRole('listitem').filter({ hasText: name })

async function addProfile(page: Page, name: string) {
  const section = profiles(page)
  await section.getByLabel(ko('author.nameLabel')).fill(name)
  await section.getByRole('button', { name: ko('author.add'), exact: true }).click()
  await pwExpect(rowOf(page, name)).toBeVisible()
}

/** 내 닉네임 이름 → 서버가 아는 id(`GET /author-profiles`) — 보낸 요청의 `authorId` 와 단추의 이름을 잇는다 */
async function profileIds(page: Page): Promise<Record<string, string>> {
  const values = await page.evaluate(async () => {
    const token = window.localStorage.getItem('sample.accessToken') ?? ''
    const response = await fetch('/api/v1/author-profiles', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return ((await response.json()) as { values: Array<{ id: string; name: string | null }> })
      .values
  })
  return Object.fromEntries(values.filter((v) => v.name).map((v) => [v.name as string, v.id]))
}

/** 목록에서 그 제목의 줄 */
const listRow = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title })

/** 응답 본문에서 글 목록(`…/posts?…`)의 한 글 */
type PostJson = Record<string, unknown> & {
  id: number
  title: string
  authorId: string
  mine?: boolean
}
function postsSeenBy(): PostJson[] {
  return received
    .filter((r) => r.method === 'GET' && /\/boards\/[^/]+\/posts(\?|$)/.test(r.url))
    .flatMap((r) => (JSON.parse(r.text) as { values?: PostJson[] }).values ?? [])
}
const newestPost = (title: string) => postsSeenBy().findLast((p) => p.title === title)
const jsonOf = (r: { text: string }) =>
  JSON.parse(r.text) as { value?: unknown; values?: unknown[] }
/** 그 글에 관한 응답 객체 — 목록의 항목 + 글 상세 응답(`…/posts/{id}`) */
const objectsOfPost = (post: PostJson): unknown[] => [
  post,
  ...received
    .filter(
      (r) =>
        r.method === 'GET' &&
        r.status === 200 && // 오류 본문(문제 객체)은 글 응답이 아니다
        new URL(r.url).pathname.endsWith(`/posts/${post.id}`),
    )
    .map((r) => jsonOf(r).value)
    .filter((value): value is object => typeof value === 'object' && value !== null),
]
/** 그 글의 댓글 응답(`…/posts/{id}/comments`)에서 본문이 `body` 인 댓글 */
function commentSeenBy(post: PostJson, body: string): { authorId: string } | undefined {
  const flat = (items: unknown[]): Array<Record<string, unknown>> =>
    items.flatMap((item) => {
      const c = item as Record<string, unknown>
      return [c, ...flat((c.replies as unknown[] | undefined) ?? [])]
    })
  return flat(
    received
      .filter(
        (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith(`/posts/${post.id}/comments`),
      )
      .flatMap((r) => jsonOf(r).values ?? []),
  ).find((c) => c.body === body) as { authorId: string } | undefined
}

describe('author profiles — several names, none of them tied to the account', () => {
  it('two new users sign in; X reads the own account id while signing in', async () => {
    const me = new Promise<{ id: string; email: string }>((resolve) =>
      x.on('response', (response) => {
        const { pathname } = new URL(response.url())
        if (
          response.request().method() === 'GET' &&
          pathname === '/api/v1/account/me' &&
          response.ok()
        )
          void response
            .json()
            .then((body: { value: { id: string; email: string } }) => resolve(body.value))
      }),
    )
    await signUpByLink(x, emailX)
    // 대시보드는 계정 이름으로 인사하지 않아 계정 읽기를 하지 않는다 — 계정 읽기가 있는 설정 화면(이메일 줄)을 연다
    await x.getByRole('link', { name: ko('nav.settings'), exact: true }).click()
    const mine = await me
    accountIdX = mine.id
    pwExpect(accountIdX).toMatch(/^acc_/)
    pwExpect(mine.email.toLowerCase()).toBe(emailX.toLowerCase())
    await signUpByLink(y, emailY)
  })

  it('X makes two profiles in the settings (the account id is nowhere on the screen)', async () => {
    await x.getByRole('link', { name: ko('nav.settings'), exact: true }).click()
    await pwExpect(profiles(x)).toBeVisible()
    await addProfile(x, nameA)
    await addProfile(x, nameB)
    // 백엔드가 자동으로 만든 첫 프로필(이 계정은 닉네임이 없어 이름 없음) + A + B
    await pwExpect(profiles(x).getByRole('listitem')).toHaveCount(3)
    await pwExpect(profiles(x).getByText(ko('author.unnamed'))).toBeVisible()
    pwExpect(await x.content()).not.toContain(accountIdX) // DOM 전체(텍스트 · aria · 속성)
  })

  it('X writes a post as A and another as B — the picker shows the one chosen name and nothing else until opened', async () => {
    await openBoard(x)
    await x.getByRole('button', { name: ko('board.write') }).click()
    const form = x.getByRole('form', { name: ko('board.form.formLabel') })
    const trigger = form.locator('button[aria-haspopup="menu"]')
    await pwExpect(trigger).toContainText(ko('author.choose')) // 아무것도 안 골랐다 — 골라야 보낼 수 있다
    await pwExpect(form.getByText(nameB)).toHaveCount(0) // 목록은 눌러야 열린다
    // 고르지 않고 보내면 칸 아래에서 막는다
    await x.getByLabel(new RegExp(ko('board.form.title'))).fill(POST_A)
    await x.getByLabel(new RegExp(ko('board.form.body'))).fill('에이로 쓴 글이에요.')
    await x.getByRole('button', { name: ko('board.form.submitCreate') }).click()
    await pwExpect(x.getByText(ko('board.authorRequired'))).toBeVisible()
    await chooseProfile(form, nameA)
    await pwExpect(trigger).toContainText(nameA)
    await pwExpect(form.getByText(nameB)).toHaveCount(0)
    await x.getByRole('button', { name: ko('board.form.submitCreate') }).click()
    await x.getByRole('heading', { level: 2, name: POST_A }).waitFor()
    await pwExpect(article(x).getByText(nameA)).toBeVisible()

    await x.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    await writePost(x, POST_B, '비로 쓴 글이에요.', nameB)
    await pwExpect(article(x).getByText(nameB)).toBeVisible()
  })

  it('X comments on the A post as B — switching away from the profile already used in the thread asks once, in one line', async () => {
    await x.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    await openPost(x, POST_A)
    await x.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(COMMENT_B)
    const form = commentForm(x)
    const trigger = form.locator('button[aria-haspopup="menu"]')
    await pwExpect(trigger).toContainText(nameA) // 처음 값 = 이 스레드에서 쓴 프로필(글쓴이)
    await chooseProfile(form, nameB)
    const notice = form.getByRole('status') // <p> 하나 — 단추는 그 형제라 폼 범위에서 찾는다
    // 「이 글에는 ‘A’ 닉네임으로 쓴 적이 있어요. 지금은 ‘B’ 닉네임을 골랐어요.」 — 한 문장이 둘 다 말한다(조사에 기대지 않는다)
    await pwExpect(notice).toContainText(nameA)
    await pwExpect(notice).toContainText(nameB)
    // 선택은 곧바로 반영 — 단추가 보이는 닉네임이 올라갈 닉네임이다(확인은 제출만 막는다)
    await pwExpect(trigger).toContainText(nameB)
    // 단추는 이름 없는 고정 글자 둘 — 「이대로 쓰기」 · 「되돌리기」
    await pwExpect(form.getByRole('button', { name: ko('author.switchKeep') })).toBeVisible()
    // ① 확인 전: 제출은 막힌다(요청이 나가지 않는다)
    const sent: string[] = []
    const onRequest = (r: Request) => {
      if (r.method() === 'POST' && /\/comments$/.test(new URL(r.url()).pathname))
        sent.push(String((r.postDataJSON() as { authorId?: string }).authorId))
    }
    x.on('request', onRequest)
    await x.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(notice).toBeVisible()
    pwExpect(sent).toEqual([])
    // ② 이대로 쓰기: 확인만 사라지고 단추는 그대로, 올라가는 authorId 는 단추의 닉네임(B)
    await form.getByRole('button', { name: ko('author.switchConfirm') }).click()
    await pwExpect(trigger).toContainText(nameB)
    await pwExpect(notice).toHaveCount(0)
    await x.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(commentOf(x, COMMENT_B).getByText(nameB)).toBeVisible()
    const ids = await profileIds(x)
    pwExpect(sent).toEqual([ids[nameB]])
    // ③ 되돌리기: 단추가 고르기 전 닉네임으로 돌아가고 확인이 사라지며, 올라가는 authorId 도 그 닉네임
    await x
      .getByRole('textbox', { name: ko('board.comments.newComment') })
      .fill(`${COMMENT_B} 되돌림`)
    const before = (await trigger.innerText()).includes(nameA) ? nameA : nameB
    const other = before === nameA ? nameB : nameA
    await chooseProfile(form, other)
    await pwExpect(notice).toBeVisible()
    await pwExpect(trigger).toContainText(other)
    await form.getByRole('button', { name: ko('author.switchKeep') }).click()
    await pwExpect(notice).toHaveCount(0)
    await pwExpect(trigger).toContainText(before)
    sent.length = 0
    await x.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(commentOf(x, `${COMMENT_B} 되돌림`).getByText(before)).toBeVisible()
    pwExpect(sent).toEqual([ids[before]])
    x.off('request', onRequest)
  })

  it('Y sees two different people, and none of the board pages and responses Y loaded here ties them to each other or to X', async () => {
    await openBoard(y)
    await pwExpect(listRow(y, POST_A).getByText(nameA)).toBeVisible()
    await pwExpect(listRow(y, POST_B).getByText(nameB)).toBeVisible()
    await openPost(y, POST_A)
    await pwExpect(article(y).getByText(nameA)).toBeVisible()
    await pwExpect(commentOf(y, COMMENT_B).getByText(nameB)).toBeVisible()
    // 남의 글 — 수정 · 삭제 단추가 없다
    await pwExpect(article(y).getByRole('button', { name: ko('board.detail.edit') })).toHaveCount(0)
    await pwExpect(article(y).getByRole('button', { name: ko('board.detail.delete') })).toHaveCount(
      0,
    )
    await pwExpect(
      commentOf(y, COMMENT_B).getByRole('button', { name: ko('board.comments.edit') }),
    ).toHaveCount(0)
    // 화면에는 X 의 계정 id 가 없다
    pwExpect(await y.content()).not.toContain(accountIdX)
    // 두 글의 상세 응답도 받아 둔다(목록의 항목 + 상세 + 댓글)
    await y.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    await openPost(y, POST_B)

    await Promise.all(reading)
    // 응답 본문 전체에 X 의 계정 id · 이메일이 없다
    pwExpect(received.length).toBeGreaterThan(0)
    for (const { url, text } of received) {
      pwExpect(text, `${url} leaks X's account id`).not.toContain(accountIdX)
      pwExpect(text.toLowerCase(), `${url} leaks X's email`).not.toContain(emailX.toLowerCase())
    }
    // 두 글의 작성자 id 는 서로 다른 프로필 id 이고, 두 글의 응답 객체(목록 항목 · 상세)를 재귀로 편 잎 값 중 어떤 칸이든 겹치는 것이 없다
    const a = newestPost(POST_A)
    const b = newestPost(POST_B)
    pwExpect(a, 'Y received the A post in a list').toBeDefined()
    pwExpect(b, 'Y received the B post in a list').toBeDefined()
    pwExpect(a!.authorId).toMatch(/^prf_/)
    pwExpect(b!.authorId).toMatch(/^prf_/)
    pwExpect(a!.authorId).not.toBe(b!.authorId)
    pwExpect(a!.mine).toBe(false)
    pwExpect(b!.mine).toBe(false)
    const boardCode = /\/boards\/([^/]+)\/posts/.exec(
      received.find((r) => /\/boards\/[^/]+\/posts/.test(r.url))!.url,
    )![1]
    const vocabulary = new Set([boardCode, 'PUBLISHED', 'LIKE', 'DISLIKE', 'EMPATHY'])
    const onlyA = objectsOfPost(a!)
    const onlyB = objectsOfPost(b!)
    pwExpect(
      onlyA.length,
      'list item and detail of the A post were received',
    ).toBeGreaterThanOrEqual(2)
    pwExpect(
      onlyB.length,
      'list item and detail of the B post were received',
    ).toBeGreaterThanOrEqual(2)
    pwExpect(sharedLeafValues(onlyA, onlyB, vocabulary)).toEqual([])
    // A 글에 B 로 쓴 댓글의 작성자 id 는 B 글의 것과 같고 A 와는 다르다(같은 프로필 = 같은 값, 다른 프로필 = 다른 값)
    const comment = commentSeenBy(a!, COMMENT_B)
    pwExpect(comment, 'Y received the B comment under the A post').toBeDefined()
    pwExpect(comment!.authorId).toBe(b!.authorId)
    pwExpect(comment!.authorId).not.toBe(a!.authorId)
  })

  it('X still owns both posts and the comment (edit / delete buttons come from the server `mine`), also after a reload', async () => {
    await x.reload()
    await pwExpect(article(x).getByRole('button', { name: ko('board.detail.edit') })).toBeVisible()
    await pwExpect(
      article(x).getByRole('button', { name: ko('board.detail.delete') }),
    ).toBeVisible()
    await pwExpect(
      commentOf(x, COMMENT_B).getByRole('button', { name: ko('board.comments.edit') }),
    ).toBeVisible()
    await x.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    await openPost(x, POST_B)
    await pwExpect(article(x).getByRole('button', { name: ko('board.detail.edit') })).toBeVisible()
    await pwExpect(
      article(x).getByRole('button', { name: ko('board.detail.delete') }),
    ).toBeVisible()
    pwExpect(await x.content()).not.toContain(accountIdX)
  })

  it('renaming A shows the new name on its post and comment; deleting B leaves its post as 「삭제된 사용자」 — still X’s own', async () => {
    await x.getByRole('link', { name: ko('nav.settings'), exact: true }).click()
    const row = rowOf(x, nameA)
    await row.getByRole('button', { name: ko('author.renameAction') }).click()
    await row.getByRole('textbox').fill(nameA2)
    await row.getByRole('button', { name: ko('author.save'), exact: true }).click()
    await pwExpect(rowOf(x, nameA2)).toBeVisible()

    await openBoard(x)
    await pwExpect(listRow(x, POST_A).getByText(nameA2)).toBeVisible()
    await pwExpect(listRow(x, POST_A).getByText(nameA, { exact: true })).toHaveCount(0)

    await x.getByRole('link', { name: ko('nav.settings'), exact: true }).click()
    await rowOf(x, nameB)
      .getByRole('button', { name: ko('author.removeAction') })
      .click()
    const dialog = x.getByRole('dialog')
    await pwExpect(dialog).toContainText(DELETED) // 글이 남는다는 말
    await dialog.getByRole('button', { name: ko('author.deleteConfirm') }).click()
    await pwExpect(rowOf(x, nameB)).toHaveCount(0)

    await openBoard(x)
    await pwExpect(listRow(x, POST_B).getByText(DELETED)).toBeVisible()
    await openPost(x, POST_B)
    await pwExpect(article(x).getByText(DELETED)).toBeVisible()
    // 작성자 프로필이 지워져도 내 글이다 — 단추가 남는다
    await pwExpect(article(x).getByRole('button', { name: ko('board.detail.edit') })).toBeVisible()
    await pwExpect(
      article(x).getByRole('button', { name: ko('board.detail.delete') }),
    ).toBeVisible()
    pwExpect(await x.content()).not.toContain(accountIdX)
  })

  it('Y sees the rename and the deleted author after a reload — and the account ids still appear nowhere', async () => {
    await y.goto(`${baseUrl}/board`)
    await pwExpect(listRow(y, POST_A).getByText(nameA2)).toBeVisible()
    await pwExpect(listRow(y, POST_B).getByText(DELETED)).toBeVisible()
    pwExpect(await y.content()).not.toContain(accountIdX)
    await Promise.all(reading)
    for (const { url, text } of received)
      pwExpect(text, `${url} leaks X's account id`).not.toContain(accountIdX)
  })
})
