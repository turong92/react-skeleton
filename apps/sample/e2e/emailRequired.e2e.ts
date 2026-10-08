import { expect as baseExpect, type Browser, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  acceptLegalGate,
  agreeToLegal,
  auth,
  chooseLoginIdViaGate,
  consentViaApi,
  dismissConsent,
  fillLoginId,
  fillSignIn,
  ko,
  launch,
  meOf,
  openBoardReady,
  signInWithLineNamed,
  startLineSignIn,
  uniqueLoginId,
} from './helpers'
import {
  chooseProfile,
  commentForm,
  openBoard,
  postForm,
  seedPosts,
  MODERATOR,
  signOut,
} from './boardSteps'
import {
  CODE_SUBJECT,
  REGISTRATION_ATTEMPT_SUBJECT,
  subjectsFor,
  waitForCode,
  waitForLink,
  waitForSubject,
} from './mail'

/*
 * 이메일 필수(`skeleton.account.email.required` + `required-when: WRITE`) + 연락받을 이메일(`contact-email.enabled`) — 백엔드 샘플이 켜 둔다. 이메일은 **쓰려 할 때** 받는다.
 *  1) 주소를 주지 않는 가짜 LINE 사용자(= 카카오 · 네이버 · X 와 같은 주소 없는 계정)는 로그인하면 아이디 → 약관만 지나고 **읽는 화면을 전부 돌아도 이메일 막이 뜨지 않는다**
 *     (API 도 읽기는 열려 있고 변경만 403 `ACCOUNT.EMAIL_REQUIRED`). 글쓰기 단추를 누르면 그때 막이 뜨고(쓰기 모습 - 「나중에 하기」가 있다) 등록하면 쓰기 화면으로 간다.
 *     댓글을 적고 내면 → 막 → 코드 → **다시 적지 않아도 같은 댓글이 올라간다**(붙잡았다 다시 보내는 호출은 같은 `Idempotency-Key` · 같은 본문). 「나중에 하기」 뒤에는 계속 읽고, 한 줄로 알린다.
 *  2) 연락받을 이메일: 설정에서 등록(그 주소로 간 인증번호) → 설정 요약에 보인다 → **비밀번호 찾기에 그 주소를 넣으면 메일이 가지 않는다**(계정 이메일은 간다) → 지운다.
 *  3) 막에서 나가는 길(로그아웃 · 「이미 계정이 있나요?」 - 이 계정 지우고 로그인 화면으로)이 눌렀을 때 된다.
 * 가짜 제공자가 없으면(`fakeUrl` 빈 문자열) 1) · 3) 은 건너뛴다.
 * 오래된 세션의 첫 등록(`REAUTH_REQUIRED` -> 제공자 재동의)은 `emailReauth.e2e.ts` 가 표준 구성에서 시험한다(두 번째 컨텍스트가 첫 세션을 닫는다).
 */
// 막이 뜨는 데는 부하가 큰 기계에서 한참 걸릴 수 있다 - 통과하는 단언은 이 한도를 쓰지 않는다
const pwExpect = baseExpect.configure({ timeout: 45_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const stamp = Date.now()
const tail = String(stamp).slice(-6)
const seen = new Set<string>()

let browser: Browser
let page: Page
beforeAll(async () => {
  ;({ browser, page } = await launch())
})
afterAll(async () => {
  await browser?.close()
})

const run = (name: string, fn: () => Promise<void>) =>
  it(name, async (ctx) => {
    if (!fakeUrl) return ctx.skip()
    await fn()
  })

/** 로그인한 이 탭의 토큰으로 API 를 부른다 — 상태 코드와 오류 코드 */
async function callApi(path: string, init: { method?: string; body?: unknown } = {}) {
  return page.evaluate(
    async ({ url, method, body }) => {
      const token = window.localStorage.getItem('sample.accessToken')
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      const parsed = await response.json().catch(() => ({}))
      return { status: response.status, code: (parsed as { code?: string }).code ?? null }
    },
    { url: `${baseUrl}/api/v1${path}`, method: init.method ?? 'GET', body: init.body },
  )
}

/** 쓰기 모습의 이메일 막 - 「글을 쓰려면 이메일을 등록해 주세요」 */
const gate = () => page.getByRole('dialog', { name: auth.emailRequiredWriteTitle })
/** 로그인 직후 모습의 이메일 막 - 이 앱(쓰기 때)에서는 뜨지 않아야 한다 */
const loginGate = () => page.getByRole('dialog', { name: auth.emailRequiredTitle })
/** 화면의 아무 막(role=dialog)도 앱을 덮고 있지 않다 */
const noDialog = () => pwExpect(page.getByRole('dialog')).toHaveCount(0)
/** 「나중에 하기」 뒤의 한 줄 - 같은 줄이 두 번 뜨면 여기서 걸린다 */
const declinedLine = () =>
  page.locator('[data-sonner-toast]').filter({ hasText: auth.emailRequiredDeclined })
/** 오류 토스트(전역 오류 알림) - 막이 말하는 403 은 여기 뜨지 않는다 */
const errorToasts = () => page.locator('[data-sonner-toast][data-type="error"]')
/** 화면에서 가장 위에 보이는 막(`role=dialog`)의 제목 — 한 번에 하나만 보이는지 */
const topDialogTitle = () =>
  page.evaluate(() => {
    const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)
    return hit?.closest('[role="dialog"]')?.querySelector('h1,h2')?.textContent ?? null
  })

const POST_TITLE = `읽기 시험 글 ${stamp}`
const COMMENT = `이메일 없이 쓴 댓글 ${stamp}`
let postId = 0
const registered = `e2e-reg-${stamp}@example.com`
const field = () => gate().getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) })

describe('an address-less account (LINE gives no email) reads everything; the email screen waits for the first write', () => {
  it('a post exists to read and comment on', async () => {
    await consentViaApi(MODERATOR) // 글쓴이는 운영자 시드 계정 - 댓글 알림이 다른 시험이 기대는 체험 계정(`user@…`)의 알림함에 쌓이지 않게
    ;[postId] = await seedPosts(apiUrl, MODERATOR, [{ title: POST_TITLE, body: '읽기 시험 본문' }])
    pwExpect(postId).toBeGreaterThan(0)
  })

  run(
    'signing in with LINE: the ID first, then terms - and the app opens with no email screen at all',
    async () => {
      await signInWithLineNamed(page, fakeUrl, apiUrl, {
        sub: `U-req-${stamp}`,
        name: '주소 없는 사용자',
        nickname: `쓰기${tail}`,
      })
      await noDialog()
      await pwExpect(loginGate()).toHaveCount(0)
      await pwExpect(gate()).toHaveCount(0)
      const { me } = await meOf(page, apiUrl)
      pwExpect(me.email).toBeNull()
      pwExpect(me.emailRequired).not.toBe(true) // 로그인 직후 방식이 아니다
      pwExpect(me.emailRequiredToWrite).toBe(true) // 쓰기 때 방식이다
    },
  )

  run(
    'the server shut only the writes: reads answer 200, a write answers 403 ACCOUNT.EMAIL_REQUIRED, the small writes the app listed stay open',
    async () => {
      for (const path of [
        '/boards/config',
        '/boards',
        '/notes',
        '/notifications',
        '/auth/sessions',
      ])
        pwExpect((await callApi(path)).status, `GET ${path}`).toBe(200)
      pwExpect(await callApi('/notes', { method: 'POST', body: {} })).toEqual({
        status: 403,
        code: 'ACCOUNT.EMAIL_REQUIRED',
      })
      // 허용: 닉네임 · 언어를 바꾸는 `PATCH /account/me`, 알림 읽음 표시(앱이 extra-exclude 로 열었다)
      pwExpect((await callApi('/account/me', { method: 'PATCH', body: {} })).code).not.toBe(
        'ACCOUNT.EMAIL_REQUIRED',
      )
      pwExpect((await callApi('/notifications/read-all', { method: 'PATCH' })).code).not.toBe(
        'ACCOUNT.EMAIL_REQUIRED',
      )
      pwExpect((await callApi('/notifications/read-all', { method: 'PATCH' })).status).toBeLessThan(
        300,
      )
    },
  )

  run('walking every reading screen opens no email screen and shows no error', async () => {
    const screens: Array<[string, () => Promise<unknown>]> = [
      [
        '/',
        () => pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible(),
      ],
      [
        '/notes',
        () =>
          pwExpect(page.getByRole('heading', { level: 1, name: ko('notes.title') })).toBeVisible(),
      ],
      ['/board', () => pwExpect(page.getByRole('link', { name: POST_TITLE })).toBeVisible()],
      [
        `/board/${postId}`,
        () => pwExpect(page.getByRole('heading', { level: 2, name: POST_TITLE })).toBeVisible(),
      ],
      ['/settings', () => pwExpect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()],
      [
        '/account',
        () =>
          pwExpect(page.getByRole('heading', { level: 1, name: auth.settingsTitle })).toBeVisible(),
      ],
    ]
    for (const [path, shown] of screens) {
      await page.goto(`${baseUrl}${path}`)
      await shown()
      await pwExpect(gate(), path).toHaveCount(0)
      await pwExpect(loginGate(), path).toHaveCount(0)
      await pwExpect(errorToasts(), path).toHaveCount(0)
    }
    // 머리글의 알림 종도 읽기다
    await page.goto(baseUrl)
    await page.getByRole('banner').getByRole('button', { name: /^알림/ }).click()
    await pwExpect(gate()).toHaveCount(0)
    await pwExpect(errorToasts()).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  run(
    'pressing "write" opens the write-time screen before the write screen: a title for writing, "not now", one at a time',
    async () => {
      await openBoardReady(page)
      await dismissConsent(page)
      await page
        .getByRole('button', { name: ko('board.write'), exact: true })
        .first()
        .click()
      await pwExpect(gate()).toBeVisible()
      await pwExpect(gate().getByText(auth.emailRequiredWriteBody)).toBeVisible()
      await pwExpect(field()).toBeVisible()
      // 눌리는 것은 모두 단추다 — 인증번호 받기(채움) · 나중에 하기 · 로그아웃 · 이 계정 지우기
      await pwExpect(gate().getByRole('button', { name: auth.emailRequiredSend })).toBeVisible()
      await pwExpect(gate().getByRole('button', { name: auth.emailRequiredLater })).toBeVisible()
      await pwExpect(gate().getByRole('button', { name: auth.emailRequiredSignOut })).toBeVisible()
      await pwExpect(gate().getByRole('button', { name: auth.emailRequiredDiscard })).toBeVisible()
      await pwExpect(gate().getByRole('heading', { level: 1 })).toBeFocused() // 제목에 포커스 — 낭독이 제목부터 읽는다
      pwExpect(await topDialogTitle()).toBe(auth.emailRequiredWriteTitle)
      pwExpect(new URL(page.url()).pathname).toBe('/board') // 쓰기 화면으로는 아직 가지 않았다
    },
  )

  run(
    '"not now" closes it and says so in one line; reading goes on, nothing is signed out',
    async () => {
      await gate().getByRole('button', { name: auth.emailRequiredLater }).click()
      await pwExpect(gate()).toHaveCount(0)
      await pwExpect(declinedLine()).toHaveCount(1)
      await pwExpect(errorToasts()).toHaveCount(0)
      await pwExpect(page.getByRole('link', { name: POST_TITLE })).toBeVisible()
      pwExpect(new URL(page.url()).pathname).toBe('/board')
      pwExpect(
        await page.evaluate(() => window.localStorage.getItem('sample.accessToken')),
      ).not.toBeNull()
    },
  )

  run(
    'a comment written without an address: the band says so above the box, the screen does not block typing',
    async () => {
      await page.goto(`${baseUrl}/board/${postId}`)
      await pwExpect(page.getByText(auth.emailRequiredWriteNotice)).toBeVisible()
      await pwExpect(
        page.getByRole('button', { name: auth.emailRequiredWriteNoticeAction }),
      ).toBeVisible()
      await pwExpect(gate()).toHaveCount(0) // 띠는 막지 않는다
      await page.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(COMMENT)
      await chooseProfile(commentForm(page)) // 이름 있는 닉네임을 고른다 - 이메일과 별개의 쓰기 전 조건
    },
  )

  /** 댓글 올리기 요청들 - 키 · 본문 · 상태를 모은다 */
  const posts: Array<{ key: string | undefined; body: string | null; status?: number }> = []
  const onRequest = (r: import('playwright/test').Request) => {
    if (r.method() === 'POST' && /\/posts\/\d+\/comments$/.test(new URL(r.url()).pathname))
      posts.push({ key: r.headers()['idempotency-key'], body: r.postData() })
  }
  const onResponse = (r: import('playwright/test').Response) => {
    if (
      r.request().method() === 'POST' &&
      /\/posts\/\d+\/comments$/.test(new URL(r.url()).pathname)
    ) {
      const mine = posts.find(
        (p) =>
          p.status === undefined &&
          p.body === r.request().postData() &&
          p.key === r.request().headers()['idempotency-key'],
      )
      if (mine) mine.status = r.status()
    }
  }

  run(
    'posting it opens the screen; "not now" ends the held write as a 403, says so once, keeps the text',
    async () => {
      page.on('request', onRequest)
      page.on('response', onResponse)
      await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
      await pwExpect(gate()).toBeVisible()
      await gate().getByRole('button', { name: auth.emailRequiredLater }).click()
      await pwExpect(gate()).toHaveCount(0)
      await pwExpect(declinedLine()).toHaveCount(1) // 같은 줄이 두 번 뜨지 않는다(붙잡은 호출의 실패도 이 한 줄이 말한다)
      await pwExpect(errorToasts()).toHaveCount(0)
      pwExpect(posts).toHaveLength(1)
      pwExpect(posts[0].status).toBe(403)
      // 쓰던 글은 그대로 있고, 올라가지 않았다
      await pwExpect(
        page.getByRole('textbox', { name: ko('board.comments.newComment') }),
      ).toHaveValue(COMMENT)
      await pwExpect(page.locator('[data-status] > p').filter({ hasText: COMMENT })).toHaveCount(0)
    },
  )

  run(
    'posting again: register the address with the mailed code - the SAME comment goes up without typing it again (same Idempotency-Key, same body)',
    async () => {
      posts.length = 0
      await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
      await pwExpect(gate()).toBeVisible()
      await field().fill(registered)
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      await pwExpect(gate().getByText(auth.emailRequiredCodeBody(registered))).toBeVisible()
      const code = await waitForCode(mailUrl, registered, 'email-change', { seen })
      await gate().getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await pwExpect(gate()).toHaveCount(0)
      // 입력 칸은 비워지고(올라갔다) 댓글이 목록에 한 번 보인다
      await pwExpect(page.locator('[data-status] > p').filter({ hasText: COMMENT })).toHaveCount(1)
      // 붙잡은 호출이 그대로 한 번 더 나갔다: 403 → 201, 같은 키 · 같은 본문
      pwExpect(posts.map((p) => p.status)).toEqual([403, 201])
      pwExpect(posts[0].key).toBeTruthy()
      pwExpect(posts[1].key).toBe(posts[0].key)
      pwExpect(posts[1].body).toBe(posts[0].body)
      page.off('request', onRequest)
      page.off('response', onResponse)
      await pwExpect(page.locator('[inert]')).toHaveCount(0)
      await pwExpect(page.getByText(auth.emailRequiredWriteNotice)).toHaveCount(0) // 주소가 생겨 띠가 사라진다
    },
  )

  run(
    'now the account is complete: the address is in the settings and every write opens',
    async () => {
      pwExpect((await meOf(page, apiUrl)).me.email).toBe(registered)
      await page.goto(`${baseUrl}/account`)
      await pwExpect(
        page
          .getByRole('region', { name: auth.sectionEmail })
          .locator('strong')
          .filter({ hasText: registered }),
      ).toBeVisible()
      await pwExpect(page.getByText(auth.emailCannotRemove)).toBeVisible()
      await pwExpect(page.getByText(auth.emailRole)).toBeVisible()
      await page.goto(`${baseUrl}/board`)
      await page
        .getByRole('button', { name: ko('board.write'), exact: true })
        .first()
        .click()
      await pwExpect(postForm(page)).toBeVisible() // 막 없이 쓰기 화면으로
    },
  )
})

describe('the write screen is reached through the email screen: the button first, then the form', () => {
  const second = `e2e-reg-two-${stamp}@example.com`

  run(
    'entering the write screen by its address opens the email screen by itself, with the band above the form; "not now" leaves the form to type in',
    async () => {
      await page.evaluate(() => window.localStorage.clear())
      await signInWithLineNamed(page, fakeUrl, apiUrl, {
        sub: `U-form-${stamp}`,
        name: '쓰기 화면 사용자',
        nickname: `폼${tail}`,
      })
      await page.goto(`${baseUrl}/board/new`)
      await pwExpect(gate()).toBeVisible() // 글을 다 쓴 뒤에야 막히면 글을 잃으니 들어서자마자 먼저 묻는다
      await gate().getByRole('button', { name: auth.emailRequiredLater }).click()
      await pwExpect(gate()).toHaveCount(0)
      await pwExpect(declinedLine()).toHaveCount(1)
      await pwExpect(page.getByText(auth.emailRequiredWriteNotice)).toBeVisible()
      await pwExpect(postForm(page)).toBeVisible()
      await pwExpect(page.getByLabel(new RegExp(ko('board.form.title')))).toBeEditable()
    },
  )

  run(
    'submitting the form anyway: the held write asks again, "not now" ends it as a 403 - the form keeps every field and says the post did not go up, the toast filter stays quiet',
    async () => {
      const title = `폼 시험 ${stamp}`
      await page.getByLabel(new RegExp(ko('board.form.title'))).fill(title)
      await page
        .getByLabel(new RegExp(ko('board.form.body')))
        .fill('나중에 하기를 눌러도 글은 남아요')
      await chooseProfile(postForm(page))
      await page.getByRole('button', { name: ko('board.form.submitCreate') }).click()
      await pwExpect(gate()).toBeVisible() // 붙잡힌 쓰기가 같은 화면을 다시 연다
      await gate().getByRole('button', { name: auth.emailRequiredLater }).click()
      await pwExpect(gate()).toHaveCount(0)
      await pwExpect(page.getByText(ko('board.form.failure'))).toBeVisible() // 폼이 받는 방식: 폼 위의 실패 한 줄
      await pwExpect(declinedLine()).toHaveCount(1) // 전역 토스트는 이 403 을 거르고, 이 한 줄이 이유를 말한다
      await pwExpect(errorToasts()).toHaveCount(0)
      await pwExpect(page.getByLabel(new RegExp(ko('board.form.title')))).toHaveValue(title)
      pwExpect(new URL(page.url()).pathname).toBe('/board/new') // 쓰던 폼에 그대로 있다
    },
  )

  run(
    'the "write" button asks first (the form is not entered), registering opens the way, the next press goes to the form',
    async () => {
      await openBoard(page)
      await page
        .getByRole('button', { name: ko('board.write'), exact: true })
        .first()
        .click()
      await pwExpect(gate()).toBeVisible()
      pwExpect(new URL(page.url()).pathname).toBe('/board')
      await field().fill(second)
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      const code = await waitForCode(mailUrl, second, 'email-change', { seen })
      await gate().getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await pwExpect(gate()).toHaveCount(0)
      pwExpect(new URL(page.url()).pathname).toBe('/board') // 등록했다고 저절로 가지 않는다 - 사용자가 다시 누른다
      await page
        .getByRole('button', { name: ko('board.write'), exact: true })
        .first()
        .click()
      await pwExpect(page).toHaveURL(/\/board\/new$/)
      await pwExpect(postForm(page)).toBeVisible()
      await pwExpect(gate()).toHaveCount(0)
    },
  )
})

describe('contact email: a second, optional address for notices (never for sign-in or password reset)', () => {
  const account = `e2e-contact-${stamp}@example.com`
  const contact = `e2e-news-${stamp}@example.com`
  const password = 'Correct-horse-9'

  it('a mail sign-up account exists', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(account)
    await page.getByLabel(auth.displayName).fill('연락 시험')
    await fillLoginId(page, uniqueLoginId()) // 샘플 백엔드는 가입에서 로그인 아이디를 받는다
    await page.getByLabel(auth.password).first().fill(password)
    await page.getByLabel(auth.passwordConfirm).fill(password)
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    const code = await waitForCode(mailUrl, account, 'verify', { seen })
    await page.getByLabel(auth.codeDigit(1, 6)).click()
    await page.keyboard.type(code.code)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await pwExpect(gate()).toHaveCount(0) // 주소가 있는 계정은 막지 않는다
  })

  it('settings: two sections - the account email says what it is for, the contact email is optional and empty', async () => {
    await page.goto(`${baseUrl}/account`)
    const accountEmail = page.getByRole('region', { name: auth.sectionEmail })
    await pwExpect(accountEmail.getByText(account)).toBeVisible()
    await pwExpect(accountEmail.getByText(auth.emailRole)).toBeVisible()
    const section = page.getByRole('region', { name: auth.sectionContactEmail })
    await pwExpect(section.getByText(auth.contactEmailNone)).toBeVisible()
    await pwExpect(section.getByRole('button', { name: auth.contactEmailAdd })).toBeVisible()
  })

  it('register: address → the code goes to THAT address → saved', async () => {
    const section = page.getByRole('region', { name: auth.sectionContactEmail })
    await section.getByRole('button', { name: auth.contactEmailAdd }).click()
    await section.getByLabel(auth.contactEmailField).fill(contact)
    await section.getByRole('button', { name: auth.contactEmailSend }).click()
    await pwExpect(section.getByText(auth.contactEmailCodeBody(contact))).toBeVisible()
    const code = await waitForCode(mailUrl, contact, 'contact-email', { seen })
    await section.getByLabel(auth.codeDigit(1, 6)).click()
    await page.keyboard.type(code.code)
    await pwExpect(section.getByText(auth.contactEmailSaved)).toBeVisible()
    await pwExpect(section.locator('strong').filter({ hasText: contact })).toBeVisible()
    // 계정 이메일은 그대로
    await pwExpect(
      page.getByRole('region', { name: auth.sectionEmail }).getByText(account),
    ).toBeVisible()
  })

  it('the settings summary shows both: the account email and where notices go', async () => {
    await page.goto(`${baseUrl}/settings`)
    await pwExpect(page.getByText(ko('settings.contactEmail'))).toBeVisible()
    await pwExpect(page.getByText(contact)).toBeVisible()
  })

  it('asking for a password reset with the contact address sends nothing; with the account email a reset mail comes', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/forgot-password`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(contact)
    await page.getByRole('button', { name: auth.forgotSubmit }).click()
    await pwExpect(page.getByText(auth.forgotSentBody(contact))).toBeVisible() // 화면은 늘 같은 말(계정이 있는지 알려 주지 않는다)
    // 대조: 같은 요청을 계정 이메일로 하면 재설정 메일이 온다(메일 경로가 살아 있다는 증거) - 그 메일이 오면 앞 요청도 끝까지 처리된 것이다
    await page.goto(`${baseUrl}/forgot-password`)
    await page.getByLabel(auth.email).fill(account)
    await page.getByRole('button', { name: auth.forgotSubmit }).click()
    const link = await waitForLink(mailUrl, account, 'reset-password', { seen })
    pwExpect(link.path).toContain('/reset-password?token=')
    const subjects = await subjectsFor(mailUrl, contact)
    // 이 주소로 간 메일은 연락받을 이메일 확인 인증번호 하나뿐 - 재설정 메일은 없다
    pwExpect(subjects).toHaveLength(1)
    pwExpect(subjects[0]).toMatch(
      /연락받을 이메일 확인 인증번호|Your code to confirm the contact email/,
    )
  })

  it('remove: signing in again, the address is still there; one press removes it and notices go back to the account email', async () => {
    await page.goto(`${baseUrl}/login`)
    await page.getByLabel(auth.email).fill(account)
    await page.getByLabel(auth.password, { exact: false }).first().fill(password)
    await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
    await acceptLegalGate(page, apiUrl, false)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await page.goto(`${baseUrl}/account`)
    const section = page.getByRole('region', { name: auth.sectionContactEmail })
    await pwExpect(section.locator('strong').filter({ hasText: contact })).toBeVisible()
    await section.getByRole('button', { name: auth.contactEmailRemove }).click()
    await pwExpect(section.getByText(auth.contactEmailRemoved)).toBeVisible()
    await pwExpect(section.getByText(auth.contactEmailNone)).toBeVisible()
    await page.reload()
    await pwExpect(
      page.getByRole('region', { name: auth.sectionContactEmail }).getByText(auth.contactEmailNone),
    ).toBeVisible()
    await page.goto(baseUrl)
    await signOut(page)
  })
})

describe('the ways out of the write-time email screen work when pressed', () => {
  run('"sign out" ends the session: the login page, no screen, no token', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await startLineSignIn(page, fakeUrl, { sub: `U-out-${stamp}`, name: '떠날 사용자' })
    await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId('out'), true)
    await acceptLegalGate(page, apiUrl, true)
    await openBoard(page)
    await page
      .getByRole('button', { name: ko('board.write'), exact: true })
      .first()
      .click()
    await pwExpect(gate()).toBeVisible()
    await gate().getByRole('button', { name: auth.emailRequiredSignOut }).click()
    await pwExpect(page).toHaveURL(/\/login$/)
    await pwExpect(gate()).toHaveCount(0)
    pwExpect(
      await page.evaluate(() => window.localStorage.getItem('sample.accessToken')),
    ).toBeNull()
  })
})

/*
 * 「이미 계정이 있나요?」 - 같은 사람이 메일 계정 A 가 있는데 이메일 없는 소셜(LINE)로 들어와 빈 계정이 생겼다. 아이디를 정하고 읽다가 처음 쓰려 할 때 A 의 주소를 적으면 같은 202 인데 인증번호는 오지 않는다(A 의 주인에게 「등록 시도」 메일만).
 * 끝까지: 이메일 없는 계정 지우기(확인 한 번 - 정한 아이디도 함께 사라지고 다시 쓸 수 없다고 말한다 - 모든 세션 종료) -> 로그인 화면 -> A 로 로그인 -> 설정에서 LINE 연결 이어서 -> 로그아웃 -> LINE 으로 로그인하면 A.
 */
describe('already have an account: the account without an email is discarded and the real one gets the social login', () => {
  const mail = `e2e-discard-${stamp}@example.com`
  const mailPassword = 'Passw0rd!x9'
  const sub = `U-discard-${stamp}`
  const discardedLoginId = uniqueLoginId('gone')
  let mailAccountId = ''
  const lineSignIn = async () => {
    await page.goto(`${baseUrl}/login`)
    await page.getByRole('button', { name: 'LINE으로 계속하기' }).click()
  }

  run('a mail account exists', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    await page.getByLabel(auth.email).fill(mail)
    await page.getByLabel(auth.displayName).fill('지우기 시험')
    await fillLoginId(page, uniqueLoginId('mail'))
    await page.getByLabel(auth.password).first().fill(mailPassword)
    await page.getByLabel(auth.passwordConfirm).fill(mailPassword)
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    const code = await waitForCode(mailUrl, mail, 'verify', { seen })
    await page.getByLabel(auth.codeDigit(1, 6)).click()
    await page.keyboard.type(code.code)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    mailAccountId = (await meOf(page, apiUrl)).me.id
    await signOut(page)
  })

  run(
    'LINE without an address makes an account without an email; it chooses an ID, tries to write, and its address is the real one: no code comes',
    async () => {
      await startLineSignIn(page, fakeUrl, { sub, name: '빈 계정' })
      await chooseLoginIdViaGate(page, apiUrl, discardedLoginId, true)
      await acceptLegalGate(page, apiUrl, true)
      await openBoard(page)
      await page
        .getByRole('button', { name: ko('board.write'), exact: true })
        .first()
        .click()
      await pwExpect(gate()).toBeVisible()
      await field().fill(mail)
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      await pwExpect(gate().getByText(auth.emailRequiredCodeTitle)).toBeVisible()
      await waitForSubject(mailUrl, mail, REGISTRATION_ATTEMPT_SUBJECT) // 주인에게는 「등록 시도」 메일만
      pwExpect(
        (await subjectsFor(mailUrl, mail)).some((s) => CODE_SUBJECT['email-change'].test(s)),
      ).toBe(false)
    },
  )

  run(
    '"delete this account" asks once and names the ID that goes with it, then deletes it at once and goes to sign-in',
    async () => {
      await gate().getByRole('button', { name: auth.emailRequiredDiscard }).click()
      const confirm = page.getByRole('dialog', { name: auth.emailRequiredDiscardConfirmTitle })
      await pwExpect(confirm).toBeVisible()
      // 정한 아이디가 함께 사라지고 다시 쓸 수 없다고 말한다
      await pwExpect(
        confirm.getByText(auth.emailRequiredDiscardConfirmLoginId(discardedLoginId)),
      ).toBeVisible()
      // 눌렀다고 바로 지우지 않는다 - 취소하면 그대로다
      await confirm.getByRole('button', { name: auth.cancel }).click()
      await pwExpect(confirm).toBeHidden()
      pwExpect(
        await page.evaluate(() => window.localStorage.getItem('sample.accessToken')),
      ).not.toBeNull()
      await gate().getByRole('button', { name: auth.emailRequiredDiscard }).click()
      await page
        .getByRole('dialog', { name: auth.emailRequiredDiscardConfirmTitle })
        .getByRole('button', { name: auth.emailRequiredDiscardConfirm })
        .click()
      await pwExpect(page).toHaveURL(/\/login$/)
      await pwExpect(gate()).toHaveCount(0)
      pwExpect(
        await page.evaluate(() => window.localStorage.getItem('sample.accessToken')),
      ).toBeNull()
    },
  )

  run(
    'sign in to the real account: the settings continue the LINE link; linking works now; the discarded ID is gone for good',
    async () => {
      await fillSignIn(page, { email: mail, password: mailPassword })
      await acceptLegalGate(page, apiUrl, false)
      await pwExpect(page).toHaveURL(/\/account#methods$/)
      await pwExpect(page.getByText(auth.methodLinkContinue('LINE'))).toBeVisible()
      // 버린 계정의 아이디는 다시 쓸 수 없다 - 실시간 확인이 「쓸 수 없는 아이디」라고 답한다
      const answer = await page.evaluate(
        async ({ url, id }) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginId: id }),
          })
          return (await response.json()) as { value: { available: boolean } }
        },
        { url: `${baseUrl}/api/v1/account/login-id/availability`, id: discardedLoginId },
      )
      pwExpect(answer.value.available).toBe(false)
      await page.getByRole('button', { name: auth.methodLink('LINE') }).click()
      await pwExpect(page.getByRole('heading', { name: auth.reauthTitle })).toBeVisible()
      await page.getByLabel(auth.currentPassword).fill(mailPassword)
      await page.getByRole('button', { name: auth.methodLink('LINE') }).click()
      await pwExpect(page.getByText(auth.methodLinkedNotice('LINE'))).toBeVisible()
      await page.goto(baseUrl)
      await signOut(page)
    },
  )

  run('the same LINE sign-in now opens the real account', async () => {
    await page.evaluate(() => window.localStorage.clear())
    await lineSignIn()
    await acceptLegalGate(page, apiUrl, false)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await pwExpect(gate()).toHaveCount(0)
    pwExpect((await meOf(page, apiUrl)).me.id).toBe(mailAccountId) // 새 계정이 아니라 메일 계정이다
    await page.goto(`${baseUrl}/account`)
    await pwExpect(
      page.getByRole('region', { name: auth.sectionEmail }).getByText(mail),
    ).toBeVisible()
  })
})

/*
 * 닉네임 띠 - 주소 없는 소셜 계정이 앱에서 **처음 권유받는 행동**이다(견본은 `import-display-name: false`: 이름 없는 첫 프로필로 시작한다).
 * 닉네임 저장은 쓰기(`PATCH /author-profiles/{id}`)라 쓰기 때 방식의 서버가 403 을 준다. 그 저장이 네이티브 모달(`<dialog>`) 안에서 붙잡히면 이메일 화면은 모달 **밑**에 깔려 눌리지 않는다 -
 * 그래서 띠(와 선택기)의 「닉네임 정하기」는 대화상자를 열기 **전에** 이메일부터 받는다(스펙 9.5 의 이메일 -> 닉네임 순서).
 * 도우미의 우회(`signInWithLineNamed` 가 `PATCH /account/me` 로 이름을 미리 넣는 것)를 쓰지 않는다 - 실제 사용자는 그 길로 갈 수 없다.
 */
describe('the nickname band on an address-less account: the email screen comes first, on top and pressable', () => {
  const band = () => page.getByRole('region', { name: ko('nickname.bannerLabel') })
  const nicknameDialog = () => page.getByRole('dialog', { name: ko('nickname.dialogTitle') })
  const address = `e2e-band-${stamp}@example.com`
  const nickname = `띠${tail}`

  run(
    'the band button opens the email screen (not the nickname dialog) on top - its field is the element under the pointer',
    async () => {
      await page.goto(baseUrl)
      await page.evaluate(() => window.localStorage.clear())
      await startLineSignIn(page, fakeUrl, { sub: `U-band-${stamp}`, name: '띠 시험' })
      await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId('band'), true)
      await acceptLegalGate(page, apiUrl, true)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      await pwExpect(band()).toBeVisible()
      await band()
        .getByRole('button', { name: ko('nickname.nudgeAction') })
        .click()
      await pwExpect(gate()).toBeVisible()
      await pwExpect(page.locator('dialog[open]')).toHaveCount(0) // 닉네임 대화상자는 아직 열리지 않았다
      pwExpect(await topDialogTitle()).toBe(auth.emailRequiredWriteTitle)
      const onTop = await field().evaluate((el) => {
        const box = el.getBoundingClientRect()
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === el
      })
      pwExpect(onTop).toBe(true)
    },
  )

  run(
    'registering the address finishes the screen; pressing the band again opens the dialog; the nickname saves',
    async () => {
      await field().click({ timeout: 5_000 }) // 가려져 있으면 여기서 걸린다(Playwright 는 눌리는 자리를 확인한다)
      await field().fill(address)
      await gate().getByRole('button', { name: auth.emailRequiredSend }).click()
      const code = await waitForCode(mailUrl, address, 'email-change', { seen })
      await gate().getByLabel(auth.codeDigit(1, 6)).click()
      await page.keyboard.type(code.code)
      await pwExpect(gate()).toHaveCount(0)
      await band()
        .getByRole('button', { name: ko('nickname.nudgeAction') })
        .click()
      await pwExpect(nicknameDialog()).toBeVisible()
      const row = nicknameDialog().getByRole('listitem')
      await pwExpect(row).toHaveCount(1) // 이름 없는 첫 닉네임
      await row.getByRole('button', { name: ko('author.renameAction') }).click()
      await row.getByRole('textbox').fill(nickname)
      await row.getByRole('button', { name: ko('author.save'), exact: true }).click()
      await pwExpect(
        nicknameDialog().getByRole('listitem').filter({ hasText: nickname }),
      ).toBeVisible()
      await pwExpect(errorToasts()).toHaveCount(0)
      await pwExpect(gate()).toHaveCount(0) // 저장이 이메일 화면에 걸리지 않았다
      await nicknameDialog()
        .getByRole('button', { name: ko('common.close') })
        .first()
        .click()
      await pwExpect(band()).toHaveCount(0) // 이름 있는 닉네임이 생겼다
    },
  )
})
