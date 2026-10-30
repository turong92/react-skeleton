import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import { searchLabelsFor } from '../src/search/labels'
import { DEMO, consentViaApi, ko, launch, seedNotes, signIn } from './helpers'
import { api, tokenOf } from './paymentSteps'

/*
 * 전문 검색 (스펙 §7 「검색」 여정) — 진짜 백엔드(`search` · `search-jdbc` + 견본 노트 · 카탈로그 색인) · 브라우저. 머리말 검색창 → `/search?q=` 화면.
 *  ① user 가 노트 「여름 가방끈 수선 메모」를 만들고 `방끈` 을 찾는다 → 결과(노트 칩 이름 + 제목 링크)에 일치한 곳이 <mark> 로 보인다
 *  ② `프로` → 상품 「프로」(씨앗 상품 pro, 이름 · 설명이 색인돼 있다)가 나오고 누르면 상품 화면으로 간다
 *  ③ 다른 계정 user2(`moderator@example.com`)의 `방끈` → 결과 없음 (남의 노트는 결과에 없다)
 *  ④ user 가 노트를 지우면 `방끈` → 결과 없음
 *  ⑤ 한 글자(`가`) → 서버에 묻지 않고 「2글자 이상 입력해 주세요」 안내
 * 시나리오는 앞 시나리오가 만든 노트 한 건을 이어 쓴다(위 순서대로 돈다). 검색 모듈이 없는 백엔드(`GET /search` 가 404)면 통째로 건너뛴다.
 * 아직 실행하지 않았다 - 서버 쪽(K4 · K5)이 있는 백엔드(`scripts/sample-e2e-backend.sh`)를 띄운 뒤 `pnpm e2e:sample e2e/search.e2e.ts`.
 */
const pwExpect = baseExpect.configure({ timeout: 20_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const SECOND = { email: 'moderator@example.com', password: 'password' }
const L = searchLabelsFor('ko')
const TITLE = '여름 가방끈 수선 메모'
const TERM = '방끈'
const LATE = 120_000

let browser: Browser
let page: Page
let noteId: string | null = null
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  try {
    // 시나리오 ④ 가 못 돌았을 때를 위해 - 남은 노트를 지운다(없으면 404 라 무시)
    if (noteId) await api(apiUrl, await tokenOf(apiUrl, DEMO), 'DELETE', `/notes/${noteId}`)
  } finally {
    await browser?.close()
  }
})

let probe: Promise<boolean> | undefined
/** 이 백엔드에 검색(`GET /search`)이 있는가 - 404 만 「없다」 */
const searchOn = () =>
  (probe ??= tokenOf(apiUrl).then(async (token) => {
    const answer = await api(apiUrl, token, 'GET', '/search?q=%EC%8B%9C%ED%97%98')
    if (answer.status === 404) return false
    if (answer.status !== 200) throw new Error(`GET /search → ${answer.status}`)
    return true
  }))

const run = (name: string, fn: () => Promise<void>) =>
  it(
    name,
    async (ctx) => {
      if (!(await searchOn())) return ctx.skip()
      await fn()
    },
    LATE,
  )

/** 머리말 검색창에 쳐서 제출한다 - `/search?q=` 로 간다 */
async function searchFor(p: Page, query: string) {
  const box = p.getByRole('searchbox', { name: L.box.label })
  await box.fill(query)
  await box.press('Enter')
  await p.waitForURL((url) => url.pathname === '/search')
}

const noResults = (p: Page, query: string) => p.getByText(L.results.emptyTitle(query))

describe('search: find my note, a product, nothing of others, nothing after delete, a hint for one character', () => {
  run('① my new note is found by a part of a word, and the match is marked', async () => {
    ;[{ id: noteId }] = await seedNotes(apiUrl, [
      { title: TITLE, body: '가방끈이 헐거워서 맡겼다' },
    ])
    await signIn(page, baseUrl, DEMO)
    await searchFor(page, TERM)

    const link = page.getByRole('link', { name: TITLE })
    await pwExpect(link).toBeVisible()
    await pwExpect(link).toHaveAttribute('href', `/notes/${noteId}`)
    await pwExpect(page.locator('mark', { hasText: TERM }).first()).toBeVisible()
    // 검색창에는 찾은 글자가 남아 있다
    await pwExpect(page.getByRole('searchbox', { name: L.box.label })).toHaveValue(TERM)
  })

  run('② 프로 finds the product 프로 and the link opens its screen', async () => {
    await searchFor(page, '프로')
    const link = page.locator('a[href="/products/pro"]')
    await pwExpect(link).toBeVisible()
    await pwExpect(page.locator('mark', { hasText: '프로' }).first()).toBeVisible()
    await link.click()
    await page.waitForURL(/\/products\/pro$/)
  })

  run("③ another account does not find the first account's note", async () => {
    await consentViaApi(SECOND)
    const other = await browser.newContext({
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
      viewport: { width: 1280, height: 800 },
    })
    other.setDefaultTimeout(15_000)
    try {
      const p = await other.newPage()
      await signIn(p, baseUrl, SECOND)
      await searchFor(p, TERM)
      await pwExpect(noResults(p, TERM)).toBeVisible()
      await pwExpect(p.getByRole('link', { name: TITLE })).toHaveCount(0)
    } finally {
      await other.close()
    }
  })

  run('④ after the note is deleted it is no longer found', async () => {
    await page.goto(`${baseUrl}/notes/${noteId}`)
    await page.getByRole('button', { name: ko('detail.deleteButton') }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: ko('detail.deleteConfirm') })
      .click()
    await pwExpect(page.getByRole('heading', { level: 1, name: ko('notes.title') })).toBeVisible()
    noteId = null

    await searchFor(page, TERM)
    await pwExpect(noResults(page, TERM)).toBeVisible()
    await pwExpect(page.getByRole('link', { name: TITLE })).toHaveCount(0)
  })

  run('⑤ one character is not searched - the screen says to type at least 2', async () => {
    await searchFor(page, '가')
    await pwExpect(page.getByText(L.results.tooShort)).toBeVisible()
    await pwExpect(page.locator('main').getByRole('link')).toHaveCount(0)
  })
})
