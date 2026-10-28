import { expect as baseExpect, type Browser, type Locator, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, inject, it } from 'vitest'
import {
  acceptLegalGate,
  agreeToLegal,
  auth,
  chooseLoginIdViaGate,
  consentViaApi,
  dismissConsent,
  ko,
  launch,
  meOf,
  startLineSignIn,
  uniqueLoginId,
} from './helpers'
import {
  article,
  chooseProfile,
  commentForm,
  openBoard,
  openPost,
  seedPosts,
  signInAs,
  MODERATOR,
  signOut,
  writePost,
} from './boardSteps'
import { LOGIN_ID_REMINDER_SUBJECT, subjectsFor, waitForCode, waitForMailText } from './mail'
import { leafValues } from './valueScan'

/*
 * 로그인 아이디(`skeleton.account.login-id.enabled`) - 이메일이 바뀌어도 안 바뀌는 계정 이름. 진짜 백엔드 · 진짜 메일함(mailpit)으로 끝까지:
 *  1) 양식 가입: 입력하는 즉시 「쓸 수 있는 / 없는」 글자가 뜬다(남이 쓰는 아이디 · 예약어는 같은 말) → 인증번호 → 가입과 동시에 로그인
 *  2) 아이디로 로그인(본문에는 `username`) · 틀린 비밀번호와 없는 아이디는 글자까지 같다 → 이메일을 바꾼 뒤에도 같은 아이디로 로그인 → 설정에 아이디가 보이고 고치는 요소가 없다
 *  3) 아이디 찾기: 가입한 이메일로 아이디가 담긴 메일이 오고, 계정이 없는 주소도 화면은 같다
 *  4) 소셜 첫 로그인(가짜 LINE): 앱 대신 「아이디를 정해 주세요」 → 정하기 전에 한 번 더 묻는 확인 대화상자 → 새로고침해도 막이 그대로 → 로그아웃
 *     → 아이디를 정하기 전에 「이미 계정이 있나요?」로 계정을 버리면 아이디를 태우지 않고 로그인 화면으로
 *  5) 값 스캔: X 의 아이디가 Y 가 받는 게시판 · 프로필 · 알림 응답의 어떤 잎 값에도 없다
 * 가짜 제공자가 없으면(`fakeUrl` 빈 문자열) 4) 는 건너뛴다.
 */
const pwExpect = baseExpect.configure({ timeout: 30_000 })
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const mailUrl = inject('mailUrl')
const fakeUrl = inject('fakeUrl')
const stamp = Date.now()
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

const region = (name: string, on: Page = page): Locator => on.getByRole('group', { name })
const token = (on: Page = page) =>
  on.evaluate(() => window.localStorage.getItem('sample.accessToken'))

/** 가입한 계정(양식) - 대문자를 섞어 쳐서 「소문자로 저장돼요」도 본다 */
const typedId = `Kim.${stamp.toString(36)}`
const storedId = typedId.toLowerCase()
const email = `e2e-id-${stamp}@example.com`
const emailNext = `e2e-id-next-${stamp}@example.com`
const password = 'Correct-horse-9'
const unknownEmail = `e2e-id-nobody-${stamp}@example.com`

/** 인증번호 칸에 6자리를 친다 */
async function enterCode(scope: Page | Locator, code: string) {
  await scope.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(code)
}

/** 로그인 화면에서 아이디(또는 이메일)와 비밀번호로 */
async function signInWith(identifier: string, secret = password) {
  await page.goto(`${baseUrl}/login`)
  await dismissConsent(page)
  await page.getByLabel(auth.signInIdentifier).fill(identifier)
  await page.getByLabel(auth.password, { exact: false }).first().fill(secret)
  await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
}

describe('sign-up with a login ID: the answer is on screen the moment the typing stops', () => {
  it('the ID box has its own rules and says in words whether the value is usable, is taken, or is not allowed', async () => {
    await page.goto(`${baseUrl}/sign-up`)
    await dismissConsent(page)
    const rules = (
      (await (await fetch(`${apiUrl}/api/v1/auth/methods`)).json()) as {
        value: { loginId: { minLength: number; maxLength: number } }
      }
    ).value.loginId
    const box = page.getByRole('textbox', { name: new RegExp(`^${auth.loginId}`) })
    await pwExpect(box).toBeVisible()
    // 형식이 틀리면 칸을 벗어난 뒤 이유를 말한다 - 서버에는 묻지 않는다
    const asked: string[] = []
    page.on(
      'request',
      (r) => r.url().endsWith('/account/login-id/availability') && asked.push(r.url()),
    )
    await box.fill('ab')
    await box.blur()
    await pwExpect(
      page.getByText(auth.problemLoginIdSize(rules.minLength, rules.maxLength)),
    ).toBeVisible()
    await box.fill('12345678')
    await box.blur()
    await pwExpect(page.getByText(auth.problemLoginIdDigitsOnly)).toBeVisible()
    pwExpect(asked, 'a malformed value never reaches the server').toEqual([])
    // 남이 쓰는 아이디(시드 계정)와 예약어는 같은 말이다 - 어느 쪽인지 알려 주지 않는다
    await box.fill('sample-user')
    await pwExpect(page.getByText(auth.errorLoginIdTaken)).toBeVisible()
    await box.fill('admin')
    await pwExpect(page.getByText(auth.errorLoginIdTaken)).toBeVisible()
    // 쓸 수 있는 아이디: 글자(아이콘 아님)로 「쓸 수 있는 아이디예요」, 대문자는 소문자로 저장된다고 말한다
    await box.fill(typedId)
    await pwExpect(
      page.getByText(`${auth.loginIdAvailable} · ${auth.loginIdSavedAs(storedId)}`),
    ).toBeVisible()
    page.removeAllListeners('request')
  })

  it('the rest of the form, then the code: signed in at once', async () => {
    await page.getByLabel(auth.email).fill(email)
    await page.getByLabel(auth.displayName).fill('아이디 시험')
    await page.getByLabel(auth.password).first().fill(password)
    await page.getByLabel(auth.passwordConfirm).fill(password)
    await agreeToLegal(page, apiUrl)
    await page.getByRole('button', { name: auth.signUpSubmit }).click()
    const code = await waitForCode(mailUrl, email, 'verify', { seen })
    await enterCode(page, code.code)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await pwExpect(page.getByRole('dialog')).toHaveCount(0) // 가입 때 정했으니 아이디 막은 없다
    pwExpect((await meOf(page, apiUrl)).me.loginId).toBe(storedId)
  })
})

describe('sign-in with the ID, and the ID survives an email change', () => {
  it('the ID signs in with any capitals (the request carries `username`, trimmed - not `email`)', async () => {
    await signOut(page)
    await page.goto(`${baseUrl}/login`)
    await pwExpect(page.getByLabel(auth.signInIdentifier)).toBeVisible()
    await pwExpect(page.getByRole('link', { name: auth.forgotLoginIdLink })).toBeVisible()
    const sent = page.waitForRequest((r) => r.url().endsWith('/auth/login'))
    await page.getByLabel(auth.signInIdentifier).fill(`  ${typedId} `)
    await page.getByLabel(auth.password, { exact: false }).first().fill(password)
    await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
    const body = (await sent).postDataJSON() as Record<string, string>
    pwExpect(body.username).toBe(typedId) // 앞뒤 공백만 지운다 - 대문자 정규화는 서버가 한다
    pwExpect('email' in body).toBe(false)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
  })

  it('a wrong password and an unknown ID read exactly the same', async () => {
    await signOut(page)
    const failure = async (identifier: string, secret: string) => {
      await signInWith(identifier, secret)
      const alert = page.getByRole('alert').filter({ hasText: auth.errorInvalidCredentials })
      await pwExpect(alert.first()).toBeVisible()
      return (await alert.first().innerText()).trim()
    }
    const wrongPassword = await failure(storedId, 'Wrong-pass-2026')
    const unknownId = await failure(`nobody-${stamp.toString(36)}`, 'Wrong-pass-2026')
    pwExpect(unknownId).toBe(wrongPassword)
  })

  it('after the email changes, the same ID still signs in - and the old address no longer does', async () => {
    await signInWith(storedId)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await page.goto(`${baseUrl}/account`)
    const section = region(auth.sectionEmail)
    await section.getByRole('button', { name: auth.emailChangeSubmit }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(auth.emailNew).fill(emailNext)
    await dialog.getByLabel(auth.currentPassword).fill(password)
    await dialog.getByRole('button', { name: auth.emailChangeSubmit }).click()
    await pwExpect(dialog.getByText(auth.emailPendingTitle)).toBeVisible()
    const code = await waitForCode(mailUrl, emailNext, 'email-change', { seen })
    await enterCode(section, code.code)
    await pwExpect(section.getByText(auth.emailChanged)).toBeVisible()
    await page.goto(baseUrl)
    await signOut(page)
    await signInWith(storedId) // 아이디는 그대로다
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    pwExpect((await meOf(page, apiUrl)).me.email).toBe(emailNext)
    await signOut(page)
    await signInWith(email) // 옛 주소는 더는 이 계정이 아니다
    await pwExpect(
      page.getByRole('alert').filter({ hasText: auth.errorInvalidCredentials }).first(),
    ).toBeVisible()
  })

  it('the settings show the ID with "it cannot be changed", and nothing to edit it with', async () => {
    await signInWith(storedId)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await page.goto(`${baseUrl}/account`)
    const section = region(auth.loginId)
    await pwExpect(section.locator('strong').filter({ hasText: storedId })).toBeVisible()
    await pwExpect(section.getByText(auth.settingsLoginIdFixed)).toBeVisible()
    await pwExpect(section.getByRole('textbox')).toHaveCount(0)
    await pwExpect(section.getByRole('button')).toHaveCount(0)
    // 서버도 바꿔 주지 않는다
    const again = await page.evaluate(
      async ({ url }) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${window.localStorage.getItem('sample.accessToken')}`,
          },
          body: JSON.stringify({ loginId: 'another-name' }),
        })
        return {
          status: response.status,
          code: ((await response.json()) as { code?: string }).code,
        }
      },
      { url: `${baseUrl}/api/v1/account/login-id` },
    )
    pwExpect(again).toEqual({ status: 409, code: 'ACCOUNT.LOGIN_ID_ALREADY_SET' })
  })
})

describe('forgot the ID: a mail with the ID, and the same screen whether or not the address has an account', () => {
  it('an unknown address and the real one see the same sentence; only the real one gets the ID mail', async () => {
    await page.goto(baseUrl)
    await signOut(page)
    const ask = async (address: string) => {
      await page.goto(`${baseUrl}/login`)
      await page.getByRole('link', { name: auth.forgotLoginIdLink }).click()
      await pwExpect(page).toHaveURL(/\/forgot-id$/)
      await pwExpect(
        page.getByRole('heading', { level: 1, name: auth.forgotLoginIdTitle }),
      ).toBeVisible()
      await page.getByLabel(auth.email).fill(address)
      await page.getByRole('button', { name: auth.forgotLoginIdSubmit }).click()
      await pwExpect(page.getByText(auth.forgotLoginIdSentBody(address))).toBeVisible()
    }
    await ask(unknownEmail)
    await ask(emailNext)
    const mail = await waitForMailText(mailUrl, emailNext, LOGIN_ID_REMINDER_SUBJECT)
    pwExpect(mail.text).toContain(storedId)
    // 먼저 보낸 없는 주소 쪽은 같은 시각에 처리가 끝났어야 한다 - 메일이 없다
    pwExpect(await subjectsFor(mailUrl, unknownEmail)).toEqual([])
  })
})

describe('a first social sign-in chooses an ID in a full-screen step, with a confirmation, and it stays through a reload', () => {
  const chosen = uniqueLoginId('soc')
  const gate = () => page.getByRole('dialog', { name: auth.loginIdRequiredTitle })

  run(
    'the gate stands in front of the app: ID box with its live check, one filled button, ways out',
    async () => {
      await page.evaluate(() => window.localStorage.clear())
      await startLineSignIn(page, fakeUrl, { sub: `U-id-${stamp}`, name: '아이디 시험' })
      await pwExpect(gate()).toBeVisible()
      await pwExpect(gate().getByText(auth.loginIdRequiredBody)).toBeVisible()
      await pwExpect(gate().getByRole('heading', { level: 1 })).toBeFocused()
      await pwExpect(gate().getByRole('button', { name: auth.loginIdRequiredSubmit })).toBeVisible()
      await pwExpect(gate().getByRole('button', { name: auth.emailRequiredSignOut })).toBeVisible()
      await pwExpect(gate().getByRole('link', { name: auth.loginIdRequiredSettings })).toBeVisible()
      // 서버도 막았다: 읽기도 403 ACCOUNT.LOGIN_ID_REQUIRED (이메일 막은 그 뒤다 - 뜨지 않는다)
      const blocked = await page.evaluate(async (url) => {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${window.localStorage.getItem('sample.accessToken')}` },
        })
        return {
          status: response.status,
          code: ((await response.json()) as { code?: string }).code,
        }
      }, `${baseUrl}/api/v1/notes`)
      pwExpect(blocked).toEqual({ status: 403, code: 'ACCOUNT.LOGIN_ID_REQUIRED' })
      await pwExpect(page.getByRole('dialog', { name: auth.emailRequiredTitle })).toHaveCount(0)
      await pwExpect(page.getByRole('dialog', { name: auth.emailRequiredWriteTitle })).toHaveCount(
        0,
      )
    },
  )

  run(
    'reloading the page keeps the gate where it was (nothing is chosen by reloading)',
    async () => {
      const before = (await meOf(page, apiUrl)).me
      pwExpect(before.loginId).toBeNull()
      await page.reload()
      await pwExpect(gate()).toBeVisible()
      pwExpect((await meOf(page, apiUrl)).me.loginId).toBeNull()
    },
  )

  run(
    'pressing the button asks once more - "it cannot be changed afterwards"; "enter again" goes back with the text kept',
    async () => {
      const box = gate().getByRole('textbox')
      await box.fill(chosen)
      await pwExpect(gate().getByText(auth.loginIdAvailable)).toBeVisible()
      await gate().getByRole('button', { name: auth.loginIdRequiredSubmit }).click()
      const confirm = page.getByRole('dialog', { name: auth.loginIdConfirmTitle(chosen) })
      await pwExpect(confirm).toBeVisible()
      await pwExpect(confirm.getByText(auth.loginIdConfirmBody)).toBeVisible()
      await confirm.getByRole('button', { name: auth.loginIdConfirmBack }).click()
      await pwExpect(confirm).toBeHidden()
      pwExpect((await meOf(page, apiUrl)).me.loginId).toBeNull() // 돌아가기는 정하지 않는다
      await pwExpect(box).toHaveValue(chosen)
    },
  )

  run('confirming fixes the ID and lets the app through to the terms, then home', async () => {
    await gate().getByRole('button', { name: auth.loginIdRequiredSubmit }).click()
    await page
      .getByRole('dialog', { name: auth.loginIdConfirmTitle(chosen) })
      .getByRole('button', { name: auth.loginIdConfirm, exact: true })
      .click()
    await pwExpect(gate()).toHaveCount(0)
    await acceptLegalGate(page, apiUrl, true)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    pwExpect((await meOf(page, apiUrl)).me.loginId).toBe(chosen)
    await page.reload() // 새로고침해도 다시 묻지 않는다
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    await pwExpect(gate()).toHaveCount(0)
  })

  run(
    'a gate left by "sign out" ends the session and the next sign-in meets the gate again',
    async () => {
      await signOut(page)
      await startLineSignIn(page, fakeUrl, { sub: `U-id-out-${stamp}`, name: '로그아웃 시험' })
      await pwExpect(gate()).toBeVisible()
      await page.reload()
      await pwExpect(gate()).toBeVisible()
      await gate().getByRole('button', { name: auth.emailRequiredSignOut }).click()
      await pwExpect(page).toHaveURL(/\/login$/)
      await pwExpect(gate()).toHaveCount(0)
      pwExpect(await token()).toBeNull()
    },
  )

  run(
    'signing out from the ID gate is quiet: no "please sign in" toast, and no request to /account/me goes out after the click',
    async () => {
      await page.goto(baseUrl)
      await page.evaluate(() => window.localStorage.clear())
      await startLineSignIn(page, fakeUrl, { sub: `U-id-quiet-${stamp}`, name: '조용한 로그아웃' })
      await pwExpect(gate()).toBeVisible()
      const afterClick: string[] = []
      let clicked = false
      page.on('request', (r) => {
        if (clicked && new URL(r.url()).pathname === '/api/v1/account/me')
          afterClick.push(r.method())
      })
      clicked = true
      await gate().getByRole('button', { name: auth.emailRequiredSignOut }).click()
      await pwExpect(page).toHaveURL(/\/login$/)
      // 늦게 나가는 요청(토큰 없는 `me`)이 있다면 잡히도록 잠시 지켜본다 - 실시간 알림(SSE)이 있어 네트워크가 잠잠해지지 않는다
      await new Promise((resolve) => setTimeout(resolve, 2_000))
      page.removeAllListeners('request')
      pwExpect(afterClick).toEqual([])
      await pwExpect(
        page.locator('[data-sonner-toast]').filter({ hasText: auth.sessionEnded.unauthenticated }),
      ).toHaveCount(0)
      pwExpect(await token()).toBeNull()
    },
  )

  run(
    '"already have an account?" before choosing: the account is discarded without spending an ID, and the next sign-in is a brand-new account',
    async () => {
      await page.goto(baseUrl)
      await page.evaluate(() => window.localStorage.clear())
      await startLineSignIn(page, fakeUrl, { sub: `U-id-discard-${stamp}`, name: '버리기 시험' })
      await pwExpect(gate()).toBeVisible()
      const firstId = (await meOf(page, apiUrl)).me.id
      await gate().getByRole('button', { name: auth.emailRequiredDiscard }).click()
      const confirm = page.getByRole('dialog', { name: auth.emailRequiredDiscardConfirmTitle })
      await pwExpect(confirm).toBeVisible()
      // 아직 정한 아이디가 없으니 「아이디도 함께 사라져요」는 말하지 않는다
      await pwExpect(confirm.getByText(/아이디 .* 도 함께 사라지고/)).toHaveCount(0)
      await confirm.getByRole('button', { name: auth.emailRequiredDiscardConfirm }).click()
      await pwExpect(page).toHaveURL(/\/login$/)
      await pwExpect(gate()).toHaveCount(0)
      pwExpect(await token()).toBeNull()
      // 같은 소셜 계정으로 다시 들어오면 새 계정이다 - 아이디 막이 다시 뜬다
      await page.goto(baseUrl) // 같은 주소(`/login`)로 다시 가면 브라우저가 history state(설정에서 연결을 이어 가려던 의도)를 들고 가므로 홈을 거친다
      await startLineSignIn(page, fakeUrl, { sub: `U-id-discard-${stamp}`, name: '버리기 시험' })
      await pwExpect(gate()).toBeVisible()
      pwExpect((await meOf(page, apiUrl)).me.id).not.toBe(firstId)
      await chooseLoginIdViaGate(page, apiUrl, uniqueLoginId('again'), true) // 이번에는 정하고 간다
      await acceptLegalGate(page, apiUrl, true)
      await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
      await signOut(page)
    },
  )
})

describe('private by default: the ID of X is in no value of any response Y receives (board, profile, notifications)', () => {
  const POST_Y = `Y 의 글 ${stamp}`
  const POST_X = `X 의 글 ${stamp}`
  const COMMENT_X = `X 의 댓글 ${stamp}`
  let other: Browser
  let y: Page
  const received: Array<{ url: string; text: string }> = []
  const reading: Array<Promise<void>> = []

  beforeAll(async () => {
    ;({ browser: other, page: y } = await launch())
    y.on('response', (response) => {
      if (!new URL(response.url()).pathname.startsWith('/api/v1/')) return
      if (!(response.headers()['content-type'] ?? '').includes('json')) return
      // 이동으로 끊긴 응답은 본문 읽기가 실패하거나 영영 끝나지 않는다 - 10초 안에 못 읽으면 끊긴 것으로 친다
      const cut = new Promise<void>((resolve) => setTimeout(resolve, 10_000))
      reading.push(
        Promise.race([
          response.text().then(
            (text) => void received.push({ url: response.url(), text }),
            () => undefined, // 이동으로 끊긴 응답
          ),
          cut,
        ]),
      )
    })
  })
  afterAll(async () => {
    await other?.close()
  })

  it('X (the account signed up above) writes a post and a comment under Y’s post, so Y has something to read and be notified about', async () => {
    await signInWith(storedId)
    await pwExpect(page.getByRole('heading', { level: 1, name: /안녕하세요/ })).toBeVisible()
    // Y = 운영자 시드 계정(체험 계정의 알림함을 어지럽히지 않는다) - 글을 하나 올려 둔다
    await consentViaApi(MODERATOR)
    const [postYId] = await seedPosts(apiUrl, MODERATOR, [{ title: POST_Y, body: 'Y 의 본문' }])
    await openBoard(page)
    await writePost(page, POST_X, 'X 의 본문')
    await openBoard(page)
    await page.goto(`${baseUrl}/board/${postYId}`)
    await pwExpect(page.getByRole('heading', { level: 2, name: POST_Y })).toBeVisible()
    await page.getByRole('textbox', { name: ko('board.comments.newComment') }).fill(COMMENT_X)
    await chooseProfile(commentForm(page))
    await page.getByRole('button', { name: ko('board.comments.postComment') }).click()
    await pwExpect(page.locator('[data-status] > p').filter({ hasText: COMMENT_X })).toBeVisible()
    // 대조: X 자신이 받는 `me` 에는 아이디가 있다 - 스캔이 아이디를 찾을 수 있다는 증거
    const mine = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${window.localStorage.getItem('sample.accessToken')}` },
      })
      return (await response.json()) as unknown
    }, `${baseUrl}/api/v1/account/me`)
    pwExpect(leafValues(mine)).toContain(storedId)
  })

  it('Y reads the board, the post and its comments, the own profile list and the notifications - and X’s ID is nowhere in any value', async () => {
    await signInAs(y, baseUrl, MODERATOR)
    await openBoard(y)
    await pwExpect(y.getByRole('link', { name: POST_X })).toBeVisible()
    await openPost(y, POST_Y)
    await pwExpect(y.locator('[data-status] > p').filter({ hasText: COMMENT_X })).toBeVisible()
    await pwExpect(article(y)).toBeVisible()
    await y.getByRole('link', { name: `← ${ko('board.back')}` }).click()
    await openPost(y, POST_X)
    await y.goto(`${baseUrl}/settings`) // 내 닉네임 목록(프로필)
    await pwExpect(y.getByRole('region', { name: ko('settings.nicknames') })).toBeVisible()
    await y.goto(`${baseUrl}/notes`) // 알림 · 노트 목록
    // 응답을 기다리는 일을 클릭보다 먼저 건다 - 클릭 뒤에 걸면 빠른 응답을 놓쳐 90초를 기다린다
    await Promise.all([
      y.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.endsWith('/notifications') && r.request().method() === 'GET', // 종의 안 읽은 수(/unread-count)가 아니라 목록 응답
      ),
      y.getByRole('banner').getByRole('button', { name: /^알림/ }).click(),
    ])
    await Promise.all(reading)
    pwExpect(received.length).toBeGreaterThan(0)
    // 게시판 · 프로필 · 알림 응답을 실제로 받았다
    for (const part of ['/boards/', '/author-profiles', '/notifications'])
      pwExpect(
        received.some((r) => r.url.includes(part)),
        `Y received a ${part} response`,
      ).toBe(true)
    // 모든 응답의 모든 잎 값 · 원문 어디에도 X 의 아이디가 없다(대소문자 무시)
    for (const { url, text } of received) {
      pwExpect(text.toLowerCase(), `${url} leaks X's login ID`).not.toContain(storedId)
      for (const leaf of leafValues(JSON.parse(text)))
        pwExpect(leaf.toLowerCase(), `${url} has X's login ID as a value`).not.toContain(storedId)
    }
  })
})
