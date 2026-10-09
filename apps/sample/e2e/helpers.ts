import { inject } from 'vitest'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { koAuthLabels } from '@skeleton/auth'
import { koLegalLabels } from '@skeleton/legal'
import { i18n, type MessageKey } from '../src/i18n'

/** 인증 화면 문구(한국어) — 패키지의 사전이라 앱 사전이 아니다 */
export const auth = koAuthLabels

/** 약관 동의 문구(한국어) — `@skeleton/legal` 의 사전 */
export const legal = koLegalLabels

/** 화면 문구(한국어) — 브라우저가 `ko-KR` 로 뜨므로 앱이 한국어로 그린다. 어느 문구를 찾는지 사전의 키로 읽힌다 */
export const ko = (key: MessageKey, values?: Record<string, string | number>) =>
  i18n.tIn('ko', key, values)

export const DEMO = { email: 'user@example.com', password: 'password' }

export async function launch(
  options: {
    recordVideoDir?: string
    colorScheme?: 'light' | 'dark'
    /** 브라우저 언어 - 앱이 이 언어로 그린다(기본 한국어). 증거 스크립트의 영어 화면용 */
    locale?: 'ko-KR' | 'en-US'
  } = {},
) {
  const browser: Browser = await chromium.launch()
  const context: BrowserContext = await browser.newContext({
    locale: options.locale ?? 'ko-KR',
    timezoneId: options.locale === 'en-US' ? 'UTC' : 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
    colorScheme: options.colorScheme ?? 'light',
    ...(options.recordVideoDir
      ? { recordVideo: { dir: options.recordVideoDir, size: { width: 1280, height: 800 } } }
      : {}),
  })
  context.setDefaultTimeout(15_000)
  const page: Page = await context.newPage()
  return { browser, context, page }
}

/** 동의 배너가 떠 있으면 「모두 거부」 — 새 브라우저의 첫 방문은 배너가 화면 아래를 덮어 클릭을 가로챈다(사람도 한 번은 답해야 한다) */
export async function dismissConsent(page: Page, locale: 'ko' | 'en' = 'ko') {
  const reject = page.getByRole('button', { name: i18n.tIn(locale, 'consent.rejectAll') })
  if (await reject.isVisible()) await reject.click()
}

/** 화면 로그인 — 랜딩(`/`)에서 헤더의 「로그인」 링크로 들어가 이메일 · 비밀번호를 입력(기본: 시드 체험 계정) */
export async function signIn(page: Page, baseUrl: string, account = DEMO) {
  await page.goto(baseUrl)
  await dismissConsent(page)
  await page.getByRole('link', { name: ko('header.signIn'), exact: true }).click()
  await fillSignIn(page, account)
  // 로그인 화면에도 h1 이 있어 그것만으로는 로그인이 끝났는지 모른다 — 다음 `goto` 가 로그인 요청을 끊지 않게, 로그인 화면을 떠날 때(= 세션이 생겼을 때)까지 기다린다
  await page.waitForURL((url) => url.pathname !== '/login')
  await page.getByRole('heading', { level: 1 }).first().waitFor()
}

/**
 * 시드 계정(가입 화면을 거치지 않은 체험 · 운영자 계정)은 동의 기록이 없다 — legal 모듈이 있는 백엔드에서는 화면 로그인 직후 동의 화면이 막는다.
 * 그 여정을 시험하는 것이 아닌 곳에서는 API 로 먼저 동의해 둔다(없는 백엔드에서는 아무 일도 하지 않는다)
 */
export async function consentViaApi(account: { email: string; password: string }) {
  const apiUrl = inject('apiUrl')
  if (!(await legalOn(apiUrl))) return
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  if (!login.ok) return // 틀린 비밀번호를 시험하는 곳
  const token = (await login.json()).value.accessToken as string
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const mine = (await (await fetch(`${apiUrl}/api/v1/legal/consents/me`, { headers })).json()).value
  if (!mine.blocked) return
  await fetch(`${apiUrl}/api/v1/legal/consents`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      consents: mine.missing.map((m: { type: string; version: string }) => ({
        type: m.type,
        version: m.version,
      })),
      source: 'consent',
    }),
  })
}

export async function fillSignIn(page: Page, account: { email: string; password: string }) {
  await consentViaApi(account)
  await page.getByLabel(auth.email).fill(account.email)
  await page.getByLabel(auth.password, { exact: false }).first().fill(account.password)
  await page.getByRole('button', { name: auth.signInSubmit, exact: true }).click()
}

type SeedNote = {
  title: string
  body?: string
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  pinned?: boolean
}

/** 시드용 — 화면을 거치지 않고 API 로 노트를 만든다(로그인 → 토큰 → POST /notes) */
export async function seedNotes(apiUrl: string, notes: SeedNote[]) {
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO),
  })
  const { value } = (await login.json()) as { value: { accessToken: string } }
  const created: Array<{ id: string; title: string }> = []
  for (const [index, note] of notes.entries()) {
    const response = await fetch(`${apiUrl}/api/v1/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${value.accessToken}`,
        'Idempotency-Key': `e2e-${Date.now()}-${index}`,
      },
      body: JSON.stringify({ body: '', ...note }),
    })
    if (response.status !== 201)
      throw new Error(`seed failed: ${response.status} ${await response.text()}`)
    created.push((await response.json()).value)
  }
  return created
}

let legalProbe: Promise<boolean> | undefined
/** 이 백엔드에 legal 모듈(`GET /legal/documents`)이 있는가 — 한 번만 묻는다. 없으면 약관 화면 · 동의 단계는 일어나지 않는다(출시된 백엔드) */
export function legalOn(apiUrl: string): Promise<boolean> {
  legalProbe ??= fetch(`${apiUrl}/api/v1/legal/documents`).then(
    (response) => response.ok,
    () => false,
  )
  return legalProbe
}

/** 가입 폼: 약관 체크리스트가 있으면 「전체 동의」 — legal 모듈이 없는 백엔드에서는 아무 일도 하지 않는다 */
export async function agreeToLegal(page: Page, apiUrl: string) {
  if (!(await legalOn(apiUrl))) return
  const all = page.getByRole('checkbox', { name: legal.agreeAll })
  await all.waitFor()
  await all.check()
}

/** 앱이 액세스 토큰을 두는 곳(`src/auth/authConfig.ts` 의 `authKeys.accessToken`) — 이 탭이 로그인을 마쳤는지 읽는다 */
const ACCESS_TOKEN_KEY = 'sample.accessToken'

/** 막이 뜰 때까지 기다리는 시간 — 부하가 큰 기계에서도 서버가 「뜬다」고 말한 막은 뜬다. 넘으면 실패다(조용히 지나가지 않는다) */
const GATE_TIMEOUT_MS = 45_000

/**
 * 이 탭의 로그인 계정이 지금 어떤 막을 만나는가 — **화면이 아니라 서버가** 말한다(`GET /account/me` 의 `loginId` · `emailRequired` · `emailRequiredToWrite`, `GET /legal/consents/me` 의 `blocked`).
 * 막이 뜰지를 화면 대기 시간으로 짐작하면 부하에서 「안 뜬다」로 잘못 읽고 지나가 뒤에서 연쇄 실패한다. 로그인이 끝나(토큰이 저장돼) 있을 때까지 기다린 뒤 묻는다.
 * 순서는 서버 인터셉터와 같다: 아이디 → (로그인 직후 방식이면) 이메일 → 약관. 견본 앱은 이메일을 **쓰기 때** 받으므로 로그인 직후에는 아이디 → 약관뿐이다(`emailMissingToWrite` 는 쓰려 할 때 뜨는 막)
 */
export async function gatesOf(
  page: Page,
  apiUrl: string,
): Promise<{
  loginIdRequired: boolean
  emailRequired: boolean
  emailMissingToWrite: boolean
  consentRequired: boolean
}> {
  const { me, headers } = await meOf(page, apiUrl)
  let consentRequired = false
  if (await legalOn(apiUrl)) {
    const mine = await fetch(`${apiUrl}/api/v1/legal/consents/me`, { headers })
    if (!mine.ok) throw new Error(`GET /legal/consents/me → ${mine.status}`)
    consentRequired = ((await mine.json()) as { value: { blocked: boolean } }).value.blocked
  }
  return {
    loginIdRequired: me.loginId === null,
    emailRequired: me.emailRequired === true,
    emailMissingToWrite: me.emailRequiredToWrite === true && !me.email,
    consentRequired,
  }
}

/** 이 탭의 로그인 계정의 `GET /account/me` - 로그인이 끝나(토큰이 저장돼) 있을 때까지 기다린 뒤 묻는다. 같은 계정인지 가리는 데는 `id` */
export async function meOf(page: Page, apiUrl: string) {
  await page.waitForFunction((key) => !!window.localStorage.getItem(key), ACCESS_TOKEN_KEY, {
    timeout: GATE_TIMEOUT_MS,
  })
  const token = await page.evaluate((key) => window.localStorage.getItem(key), ACCESS_TOKEN_KEY)
  const headers = { Authorization: `Bearer ${token}` }
  const response = await fetch(`${apiUrl}/api/v1/account/me`, { headers })
  if (!response.ok) throw new Error(`GET /account/me → ${response.status}`)
  const me = (
    (await response.json()) as {
      value: {
        id: string
        email: string | null
        /** 로그인 아이디 — 아이디를 켠 서버에서만 키가 있다(`null` = 아직 못 정했다) */
        loginId?: string | null
        emailRequired?: boolean
        emailRequiredToWrite?: boolean
      }
    }
  ).value
  return { me, headers }
}

let loginIdSeq = 0
/** 시험마다 겹치지 않는 로그인 아이디(소문자 · 숫자 · 하이픈, 4~20자 안) - 한 백엔드에 계정이 여럿 생겨도 서로 선점하지 않는다 */
export function uniqueLoginId(prefix = 'e2e') {
  loginIdSeq += 1
  return `${prefix}-${Date.now().toString(36)}${loginIdSeq.toString(36)}`.slice(0, 20)
}

/**
 * 가입 양식의 아이디 칸을 채우고 실시간 확인이 「쓸 수 있는 아이디예요」라고 답할 때까지 기다린다 - 입력을 멈춘 뒤에야 답이 오고, 그 전에 내면 서버의 판정이 아니라 대기 중인 상태로 낸다.
 * 견본 백엔드는 늘 아이디를 켠다 - 칸이 없으면 건너뛰지 않고 실패한다(칸이 안 보이는 회귀를 조용히 넘기지 않는다)
 */
export async function fillLoginId(page: Page, loginId: string) {
  const field = page.getByRole('textbox', { name: new RegExp(`^${auth.loginId}`) })
  await field.waitFor({ timeout: GATE_TIMEOUT_MS })
  await field.fill(loginId)
  await page.getByText(auth.loginIdAvailable).first().waitFor({ timeout: GATE_TIMEOUT_MS })
}

/**
 * 소셜 · 링크로 처음 들어온 계정은 아이디가 없어 앱 대신 「아이디를 정해 주세요」가 덮는다(가장 바깥 막) - 서버가 아이디가 없다고 하면(`me.loginId === null`) 뜰 때까지 **기다렸다가**
 * 아이디를 적고 「정하기」 확인까지 누른다. 안 뜨면 실패한다. 이미 있는 계정 · 아이디를 안 쓰는 서버는 아무 일도 하지 않는다. 시나리오가 `expectGate` 로 기대를 적고 서버의 답이 다르면 실패한다.
 * 이메일 막(쓰기 때)은 이 뒤에도 뜨지 않는다 - 약관 → 쓰려 할 때 이메일(`registerEmailViaGate`)
 */
export async function chooseLoginIdViaGate(
  page: Page,
  apiUrl: string,
  loginId: string,
  expectGate: boolean,
  labels: typeof auth = auth,
) {
  const { loginIdRequired } = await gatesOf(page, apiUrl)
  if (loginIdRequired !== expectGate)
    throw new Error(
      `chooseLoginIdViaGate: the scenario expects the login id gate = ${expectGate}, the server says loginId missing = ${loginIdRequired}`,
    )
  if (!loginIdRequired) return
  const gate = page.getByRole('dialog', { name: labels.loginIdRequiredTitle })
  await gate.waitFor({ timeout: GATE_TIMEOUT_MS })
  await gate.getByRole('textbox').fill(loginId)
  await gate.getByText(labels.loginIdAvailable).waitFor({ timeout: GATE_TIMEOUT_MS })
  await gate.getByRole('button', { name: labels.loginIdRequiredSubmit }).click()
  const confirm = page.getByRole('dialog', { name: labels.loginIdConfirmTitle(loginId) })
  await confirm.getByRole('button', { name: labels.loginIdConfirm, exact: true }).click()
  await gate.waitFor({ state: 'detached', timeout: GATE_TIMEOUT_MS })
}

/**
 * 링크 · 소셜로 처음 들어온 계정은 동의가 없어 동의 화면이 앞을 막는다 — 서버가 「동의가 필요하다」고 말하면(`blocked`) 화면이 뜰 때까지 **기다렸다가** 모두 동의하고 이어 간다.
 * 안 뜨면 실패한다. 서버가 필요 없다고 하면(이미 동의한 계정 · legal 모듈이 없는 백엔드) 아무 일도 하지 않는다. 이메일 등록이 남아 있으면 약관 막은 아직 안 뜨는 순서라 먼저 `registerEmailViaGate` 를 불러야 한다. 아이디가 없으면 그것이 맨 앞이다(`chooseLoginIdViaGate`)
 */
export async function acceptLegalGate(
  page: Page,
  apiUrl: string,
  expectGate: boolean,
  labels: typeof legal = legal,
) {
  if (!(await legalOn(apiUrl))) return
  const { loginIdRequired, emailRequired, consentRequired } = await gatesOf(page, apiUrl)
  // 시나리오가 약관 막을 기대하는지(처음 들어온 계정) 아닌지(이미 동의한 계정)를 말한다 - 서버의 답이 다르면 건너뛰지 않고 실패한다
  if (consentRequired !== expectGate)
    throw new Error(
      `acceptLegalGate: the scenario expects the consent gate = ${expectGate}, the server says blocked = ${consentRequired}`,
    )
  if (!consentRequired) return
  if (loginIdRequired)
    throw new Error(
      'acceptLegalGate: the login id gate comes first - call chooseLoginIdViaGate before',
    )
  if (emailRequired)
    throw new Error(
      'acceptLegalGate: the email gate comes first - call registerEmailViaGate before',
    )
  const gate = page.getByRole('dialog', {
    name: new RegExp(`${labels.reconsentTitle}|${labels.firstConsentTitle}`),
  })
  await gate.waitFor({ timeout: GATE_TIMEOUT_MS })
  await gate.getByRole('checkbox', { name: labels.agreeAll }).check()
  await gate.getByRole('button', { name: labels.reconsentSubmit }).click()
  await gate.waitFor({ state: 'detached' })
}

/** 가입 API 를 화면 없이 부르는 곳(공격자 시나리오)의 `consents` — legal 모듈이 있으면 가입에 필요한 문서(현재 판 · 첫 언어) 전부, 없으면 필드 없음 */
export async function signUpConsents(apiUrl: string) {
  if (!(await legalOn(apiUrl))) return {}
  const docs = (await (await fetch(`${apiUrl}/api/v1/legal/documents`)).json()).values as Array<{
    type: string
    version: string
    locale: string
    requiredAtSignUp: boolean
  }>
  const seenTypes = new Set<string>()
  return {
    consents: docs
      .filter((d) => d.requiredAtSignUp && !seenTypes.has(d.type) && seenTypes.add(d.type))
      .map((d) => ({ type: d.type, version: d.version, locale: d.locale })),
  }
}

/** 작성자 프로필(`GET /author-profiles` 의 한 항목) */
export type E2eProfile = { id: string; name: string | null; tag: string | null }

/** API 로 로그인해 액세스 토큰만 받는다(비밀번호가 있는 계정) */
async function accessTokenOf(apiUrl: string, account: { email: string; password: string }) {
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  if (!login.ok) return undefined
  return ((await login.json()) as { value: { accessToken: string } }).value.accessToken
}

async function profileHeaders(account: { email: string; password: string }) {
  const token = await accessTokenOf(inject('apiUrl'), account)
  if (!token) return undefined
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function postProfile(headers: Record<string, string>, name: string): Promise<E2eProfile> {
  const created = await fetch(`${inject('apiUrl')}/api/v1/author-profiles`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': `e2e-profile-${Date.now()}-${Math.random()}` },
    body: JSON.stringify({ name }),
  })
  if (created.status !== 201)
    throw new Error(`profile seed failed: ${created.status} ${await created.text()}`)
  return ((await created.json()) as { value: E2eProfile }).value
}

/**
 * 이 계정에 **이름 있는** 작성자 프로필을 보장한다 — 화면을 거치지 않고 API 로. 백엔드는 첫 프로필을 자동으로 만든다(닉네임이 있으면 그 이름을 복사, 없으면 이름 없는 프로필)이고,
 * 샘플은 이름 있는 프로필이 없으면 쓰기 전에 만들게 하므로, 글 · 댓글을 쓰는 시나리오는 이름 있는 프로필이 하나는 있어야 한다. 이미 있으면 그것을, 없으면 `name` 으로 만든다.
 * 샘플은 `author-profile` 모듈이 필수다 — 404 를 포함해 어떤 실패도 던진다(건너뛰지 않는다)
 */
export async function ensureProfile(
  account: { email: string; password: string },
  name = `e2e${Date.now().toString(36)}`,
): Promise<E2eProfile> {
  const headers = await profileHeaders(account)
  if (!headers) throw new Error(`could not sign in as ${account.email} to seed a profile`)
  const listed = await fetch(`${inject('apiUrl')}/api/v1/author-profiles`, { headers })
  if (!listed.ok) throw new Error(`GET /author-profiles → ${listed.status}`)
  const existing = ((await listed.json()) as { values: E2eProfile[] }).values
  return existing.find((profile) => profile.name?.trim()) ?? postProfile(headers, name)
}

/** 이름 있는 프로필을 하나 더 만든다(이미 있는 것에 상관없이) — API 로 */
export async function createProfile(
  account: { email: string; password: string },
  name: string,
): Promise<E2eProfile> {
  const headers = await profileHeaders(account)
  if (!headers) throw new Error(`could not sign in as ${account.email} to create a profile`)
  return postProfile(headers, name)
}

/**
 * 주소 없는 계정(LINE · X 가 주소를 안 준다)은 견본 앱에서 **읽기는 그대로** 하고, 처음 **쓰려 할 때** 「글을 쓰려면 이메일을 등록해 주세요」가 뜬다 - 게시판의 글쓰기 단추를 눌러 막을 열고
 * 주소를 적고 메일함의 인증번호로 통과한다(방금 연 세션이라 재인증은 없다). 끝나면 홈으로 돌아와 있다.
 * 막이 뜰지는 서버가 말한다(`me.emailRequiredToWrite` + 주소 없음) - 호출하는 시나리오가 `expectGate` 로 기대를 적고, 서버의 답이 다르면 실패한다. 뜬다고 하면 뜰 때까지 기다린다(안 뜨면 실패)
 */
export async function registerEmailViaGate(
  page: Page,
  mailUrl: string,
  address: string,
  seen: Set<string>,
  expectGate: boolean,
  apiUrl = inject('apiUrl'),
) {
  const { emailMissingToWrite } = await gatesOf(page, apiUrl)
  // 시나리오의 기대와 서버의 답이 다르면(주소 없는 계정이어야 하는데 서버는 필요 없다고 한다 …) 건너뛰지 않고 실패한다
  if (emailMissingToWrite !== expectGate)
    throw new Error(
      `registerEmailViaGate: the scenario expects the email gate = ${expectGate}, the server says an address is missing for writing = ${emailMissingToWrite}`,
    )
  if (!emailMissingToWrite) return
  await openEmailGateByWriting(page)
  const gate = page.getByRole('dialog', { name: auth.emailRequiredWriteTitle })
  await gate.getByRole('textbox', { name: new RegExp(`^${auth.emailRequiredField}`) }).fill(address)
  await gate.getByRole('button', { name: auth.emailRequiredSend }).click()
  const { waitForCode } = await import('./mail')
  const code = await waitForCode(mailUrl, address, 'email-change', { seen })
  await gate.getByLabel(auth.codeDigit(1, 6)).click()
  await page.keyboard.type(code.code)
  await gate.waitFor({ state: 'detached' })
  await page.goto(inject('baseUrl')) // 홈으로 - 쓰려던 화면은 버리고 읽기로 돌아온다
}

/**
 * 게시판 목록을 **새로** 열고 앱이 이 계정의 요구(`GET /account/me`)를 읽을 때까지 기다린다 - 읽기 전에 글쓰기를 누르면 앱은 아직 이메일이 필요한지 모른다(그래도 쓰기 화면에 들어서면 막이 스스로 뜬다 -
 * 시험이 「단추에서 막힌다」를 가리려면 읽은 뒤에 눌러야 한다).
 * `me` 는 두 번 나간다 - 아이디 막이 먼저, 걷히면 이메일 막이(`emailRequiredToWrite`). 이메일 막의 답이 컨트롤러 상태로 옮겨졌다는 신호는 **그 뒤의 요청**이다:
 * 약관 막은 이메일 막이 준비된 뒤에야 `GET /consents/me` 를 묻는다. 고정 시간을 기다리지 않고 그 요청이 나가는 것을 기다린다(약관 모듈이 없는 백엔드는 두 번째 `me` 응답까지만)
 */
export async function openBoardReady(page: Page) {
  let meCount = 0
  const emailGateRead = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === '/api/v1/account/me' &&
      r.request().method() === 'GET' &&
      ++meCount === 2,
    { timeout: GATE_TIMEOUT_MS },
  )
  const nextStepAsked = (await legalOn(inject('apiUrl')))
    ? page.waitForRequest((r) => new URL(r.url()).pathname.endsWith('/consents/me'), {
        timeout: GATE_TIMEOUT_MS,
      })
    : Promise.resolve()
  await page.goto(`${inject('baseUrl')}/board`)
  await (await emailGateRead).finished()
  await nextStepAsked
}

/** 게시판에서 「글쓰기」를 눌러 쓰기용 이메일 막을 연다 - 막이 뜰 때까지 기다린다(안 뜨면 실패). 뜬 막을 돌려준다 */
export async function openEmailGateByWriting(page: Page) {
  await page.goto(`${inject('baseUrl')}/board`)
  await dismissConsent(page)
  await page
    .getByRole('button', { name: ko('board.write'), exact: true })
    .first()
    .click()
  const gate = page.getByRole('dialog', { name: auth.emailRequiredWriteTitle })
  await gate.waitFor({ timeout: GATE_TIMEOUT_MS })
  return gate
}

/** 로그인 화면의 LINE 단추 이름 — 가짜 LINE(`fakeProviders.ts`)을 켠 e2e 백엔드에서만 있다 */
export const LINE_BUTTON = 'LINE으로 계속하기'

/**
 * 가짜 LINE 사용자(주소를 주지 않는다 = 카카오 · 네이버 · X 와 같은 주소 없는 계정)로 로그인 화면의 LINE 단추를 누른다. 이 뒤의 막(아이디 → 약관)은 호출하는 쪽이 지난다.
 * `sub` 가 같으면 같은 계정이다(두 번째 로그인)
 */
export async function startLineSignIn(
  page: Page,
  fakeUrl: string,
  user: { sub: string; name: string; email?: string },
  locale: 'ko' | 'en' = 'ko',
) {
  await fetch(`${fakeUrl}/control`, {
    method: 'POST',
    body: JSON.stringify({
      line: { sub: user.sub, name: user.name, email: user.email ?? '' },
      deny: false,
    }),
  })
  await page.goto(`${inject('baseUrl')}/login`)
  await dismissConsent(page, locale)
  await page.locator('button:has(svg[data-provider="line"])').click()
}

/**
 * 주소 없는 소셜 계정으로 **이름 있는 닉네임까지** 갖춘 채 로그인한다 - 아이디 → 약관을 지나고, 닉네임은 `PATCH /account/me`(이메일 없이도 열린 변경)로 정한다.
 * 백엔드는 `GET /author-profiles` 를 처음 부를 때 첫 프로필을 만들어 그때의 닉네임을 복사한다 - 앱이 로그인 직후 그 목록을 읽어 버리기 전에 정해야 하므로, 로그인하는 동안 프로필 요청을 붙잡아 두었다가 닉네임을 정한 뒤 푼다.
 * (이름 있는 프로필이 있어야 글 · 댓글 폼이 작성자를 고를 수 있다. 이름 붙이기 자체는 쓰기라 이메일이 먼저다.) 끝나면 홈이다
 */
export async function signInWithLineNamed(
  page: Page,
  fakeUrl: string,
  apiUrl: string,
  user: { sub: string; name: string; nickname: string; loginId?: string },
) {
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/v1/author-profiles**', async (route) => {
    await held
    await route.continue().catch(() => undefined)
  })
  try {
    await startLineSignIn(page, fakeUrl, user)
    await chooseLoginIdViaGate(page, apiUrl, user.loginId ?? uniqueLoginId('line'), true)
    await acceptLegalGate(page, apiUrl, true)
    await page.getByRole('heading', { level: 1, name: /안녕하세요/ }).waitFor()
    const { headers } = await meOf(page, apiUrl)
    const patched = await fetch(`${apiUrl}/api/v1/account/me`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: user.nickname }),
    })
    if (!patched.ok) throw new Error(`PATCH /account/me → ${patched.status}`)
  } finally {
    release()
    await page.unroute('**/api/v1/author-profiles**').catch(() => undefined)
  }
}
