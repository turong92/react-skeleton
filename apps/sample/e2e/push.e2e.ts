import { createDecipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import { chromium } from 'playwright'
import { expect as pwExpect, type Browser, type BrowserContext, type Page } from 'playwright/test'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { koPushLabels } from '@skeleton/push'
import { koAdvertisingLabels } from '@skeleton/push/advertising'
import {
  MODERATOR,
  USER,
  openBoard,
  openPost,
  postComment,
  readAllNotifications,
  signInAs,
  writePost,
} from './boardSteps'
import { ko, launch } from './helpers'

/*
 * 푸시 여정 — 진짜 백엔드(웹 푸시를 켠 견본) + 진짜 브라우저(Chromium) + **가짜 푸시 서비스**(이 파일이 띄우는 HTTP 서버).
 *   노트 저장 → 앱 안 띠 → 「알림 받기」(권한 → 구독 → 등록) → 게시판 글 → 다른 사람이 댓글 → 가짜 푸시 서비스가 **암호화된 요청 하나**를 받는다
 *   (RFC 8291 로 풀어 내용을 본다) → 같은 JSON 을 CDP `ServiceWorker.deliverPushMessage` 로 서비스 워커에 → `getNotifications()` 의 제목 → 로그아웃(기기 줄 삭제가 먼저) → 다시 댓글 → 요청 없음.
 *   뒤에 광고 동의 짧은 여정(동의 → 야간 체크 → 철회 → 상태 표시).
 * 브라우저의 푸시 서비스(FCM 등)는 e2e 에서 구독할 수 없다 — 그래서 `PushManager.subscribe` 만 가짜(끝점은 가짜 푸시 서비스, 키는 이 파일이 만든 쌍)로 바꾸고,
 * 권한은 `grantPermissions` 로 실제 허용한다(페이지의 `Notification.permission` 은 「알림 받기」를 누르기 전까지 `default` 로 보이게 해 띠가 뜬다).
 * 서버가 이 끝점으로 보내려면 허용 목록에 있어야 한다 — `e2e/globalSetup.ts` 가 `SKELETON_NOTIFICATION_WEBPUSH_ALLOWED_HOSTS=http://127.0.0.1:<포트>` 로 백엔드를 띄운다(로컬 프로필 전용, 보호 환경에서는 기동 실패).
 * 서버가 웹 푸시를 켜지 않은 백엔드면 이 파일은 실패한다(탐침으로 건너뛰지 않는다) — 견본 백엔드는 켠다.
 */
const baseUrl = inject('baseUrl')
const apiUrl = inject('apiUrl')
const fakePushPort = inject('fakePushPort')

// ── 가짜 푸시 서비스 · 가짜 브라우저 구독 ────────────────────────────────────────────

type Received = { path: string; headers: IncomingHttpHeaders; body: Buffer; at: number }
const received: Received[] = []
let service: Server

/** 가짜 브라우저 구독의 키 쌍 — 서버는 공개 키(p256dh)와 auth 로 본문을 암호화하고, 이 파일이 개인 키로 푼다 */
const ua = createECDH('prime256v1')
ua.generateKeys()
const UA_PUBLIC = ua.getPublicKey()
const AUTH_SECRET = randomBytes(16)
const ENDPOINT = `http://127.0.0.1:${fakePushPort}/push/e2e-${randomBytes(8).toString('hex')}`

/** RFC 8291(aes128gcm)로 푼다 — 본문 = salt(16) · 레코드 크기(4) · 키 길이(1) · 서버 공개 키 · 암호문(끝 16바이트 태그) */
function decryptWebPush(body: Buffer): string {
  const salt = body.subarray(0, 16)
  const idLength = body[20]
  const serverPublic = body.subarray(21, 21 + idLength)
  const sealed = body.subarray(21 + idLength)
  const secret = ua.computeSecret(serverPublic)
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), UA_PUBLIC, serverPublic])
  const prk = Buffer.from(hkdfSync('sha256', secret, AUTH_SECRET, info, 32))
  const key = Buffer.from(
    hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16),
  )
  const nonce = Buffer.from(
    hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12),
  )
  const decipher = createDecipheriv('aes-128-gcm', key, nonce)
  decipher.setAuthTag(sealed.subarray(sealed.length - 16))
  const plain = Buffer.concat([
    decipher.update(sealed.subarray(0, sealed.length - 16)),
    decipher.final(),
  ])
  let end = plain.length
  while (end > 0 && plain[end - 1] === 0) end--
  if (plain[end - 1] !== 2) throw new Error('the record has no last-record delimiter')
  return plain.subarray(0, end - 1).toString('utf8')
}

/** 브라우저(페이지)에 넣는 가짜: 권한은 눌러야 허용으로 보이고, 구독은 가짜 푸시 서비스를 가리킨다. 새로고침해도 허용은 남는다 */
const FAKE_BROWSER_PUSH = `(() => {
  const ENDPOINT = ${JSON.stringify(ENDPOINT)}
  const KEYS = { p256dh: ${JSON.stringify(UA_PUBLIC.toString('base64url'))}, auth: ${JSON.stringify(AUTH_SECRET.toString('base64url'))} }
  const read = () => { try { return localStorage.getItem('e2e.permission') === 'granted' } catch { return false } }
  Object.defineProperty(Notification, 'permission', { configurable: true, get: () => (read() ? 'granted' : 'default') })
  Notification.requestPermission = async () => {
    try { localStorage.setItem('e2e.permission', 'granted') } catch {}
    return 'granted'
  }
  let subscription = null
  PushManager.prototype.getSubscription = async function () { return subscription }
  PushManager.prototype.subscribe = async function (options) {
    subscription = {
      endpoint: ENDPOINT,
      options: { applicationServerKey: new Uint8Array(options.applicationServerKey).buffer },
      toJSON: () => ({ endpoint: ENDPOINT, keys: KEYS }),
      unsubscribe: async () => { subscription = null; return true },
    }
    return subscription
  }
})()`

function startService(): Promise<Server> {
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      received.push({
        path: request.url ?? '',
        headers: request.headers,
        body: Buffer.concat(chunks),
        at: Date.now(),
      })
      response.writeHead(201, {
        Location: `http://127.0.0.1:${fakePushPort}/message/${received.length}`,
      })
      response.end()
    })
  })
  return new Promise((done, fail) => {
    server.once('error', fail)
    server.listen(fakePushPort, '127.0.0.1', () => done(server))
  })
}

/** 로그인 화면에도 h1 이 있어 `signInAs` 는 로그인이 끝나기 전에 돌아온다 — 다음 이동이 로그인 요청을 끊지 않게 로그인 화면을 떠날 때까지 기다린다 */
async function signedIn(page: Page, account: { email: string; password: string }) {
  await signInAs(page, baseUrl, account)
  await page.waitForURL((url) => url.pathname !== '/login')
  await page
    .getByRole('button', { name: ko('header.signOut') })
    .first()
    .waitFor()
}

/**
 * 알림을 받는 쪽 브라우저 — 기본 `launch()` 의 headless shell 은 알림 권한이 늘 `denied` 라 서비스 워커의 `showNotification` 이 막힌다.
 * 전체 Chromium(`channel: 'chromium'`, 새 headless)은 `grantPermissions(['notifications'])` 가 듣는다
 */
async function launchWithNotifications() {
  const browser = await chromium.launch({ channel: 'chromium' })
  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    viewport: { width: 1280, height: 800 },
  })
  context.setDefaultTimeout(15_000)
  return { browser, context, page: await context.newPage() }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function until<T>(
  what: string,
  read: () => T | undefined | Promise<T | undefined>,
  ms = 60_000,
) {
  const deadline = Date.now() + ms
  for (;;) {
    const value = await read()
    if (value !== undefined) return value
    if (Date.now() > deadline) throw new Error(`timed out after ${ms / 1000}s waiting for ${what}`)
    await sleep(250)
  }
}

async function tokenOf(account: { email: string; password: string }) {
  const login = await fetch(`${apiUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  })
  if (!login.ok) throw new Error(`login ${account.email} → ${login.status}`)
  return ((await login.json()) as { value: { accessToken: string } }).value.accessToken
}

async function deviceCount(account: { email: string; password: string }) {
  const response = await fetch(`${apiUrl}/api/v1/push/devices`, {
    headers: { Authorization: `Bearer ${await tokenOf(account)}` },
  })
  if (response.status !== 200) throw new Error(`GET /push/devices → ${response.status}`)
  const text = await response.text()
  // 주소(endpoint)와 구독 열쇠는 돌려주지 않는다 — 서버가 이 끝점을 아는 줄이 응답에 새지 않는다
  expect(text).not.toContain(ENDPOINT)
  expect(text).not.toContain(UA_PUBLIC.toString('base64url'))
  return (JSON.parse(text) as { value: { items: unknown[] } }).value.items.length
}

// ── 여정 ───────────────────────────────────────────────────────────────────────────

const NOTE = '푸시 시험 노트'
const POST_TITLE = '푸시로 받을 글'
const POST_BODY = '댓글이 달리면 이 기기로 알림이 와요.'
const COMMENT = '푸시가 오는지 보려고 단 댓글'
const AFTER_LOGOUT = '로그아웃한 뒤에 단 댓글'

let alice: { browser: Browser; context: BrowserContext; page: Page }
let bob: { browser: Browser; context: BrowserContext; page: Page }
const deviceCalls: string[] = []

beforeAll(async () => {
  service = await startService()
  alice = await launchWithNotifications()
  bob = await launch()
  await alice.context.grantPermissions(['notifications'], { origin: new URL(baseUrl).origin })
  await alice.context.addInitScript(FAKE_BROWSER_PUSH)
  alice.page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/v1/push/devices'))
      deviceCalls.push(`${r.method()} ${new URL(r.url()).pathname}`)
  })
})
afterAll(async () => {
  await alice?.browser.close()
  await bob?.browser.close()
  await new Promise((done) => service?.close(done))
  await readAllNotifications(apiUrl, USER).catch(() => undefined)
})

describe('Push — save a note, get asked, subscribe, receive a comment, sign out', () => {
  let registrationId = ''
  let cdp: Awaited<ReturnType<BrowserContext['newCDPSession']>>

  it('does not ask for permission on its own: the prompt appears after the first note is saved', async () => {
    cdp = await alice.context.newCDPSession(alice.page)
    cdp.on('ServiceWorker.workerRegistrationUpdated', (event) => {
      const ours = event.registrations.find((r) => r.scopeURL.startsWith(baseUrl) && !r.isDeleted)
      if (ours) registrationId = ours.registrationId
    })
    await cdp.send('ServiceWorker.enable')

    await signedIn(alice.page, USER)
    expect(await alice.page.evaluate(() => Notification.permission)).toBe('default')
    expect(deviceCalls.filter((c) => c.startsWith('PUT'))).toEqual([])

    await alice.page.goto(`${baseUrl}/notes/new`)
    await alice.page.getByLabel(new RegExp(ko('form.title'))).fill(NOTE)
    await alice.page.getByRole('button', { name: ko('form.submitCreate') }).click()
    await pwExpect(alice.page.getByRole('heading', { level: 1, name: NOTE })).toBeVisible()
    await pwExpect(alice.page.getByText(koPushLabels.prompt.title)).toBeVisible()
    // 띠가 뜨는 것만으로는 권한을 묻지도 구독하지도 않는다
    expect(await alice.page.evaluate(() => Notification.permission)).toBe('default')
    expect(deviceCalls.filter((c) => c.startsWith('PUT'))).toEqual([])
  })

  it('「알림 받기」 asks inside the click, subscribes and registers this device', async () => {
    const registered = alice.page.waitForResponse(
      (r) => r.request().method() === 'PUT' && r.url().includes('/api/v1/push/devices/'),
    )
    await alice.page.getByRole('button', { name: koPushLabels.prompt.enable, exact: true }).click()
    expect((await registered).status()).toBe(200)
    await pwExpect(alice.page.getByText(koPushLabels.prompt.title)).toHaveCount(0)
    expect(await alice.page.evaluate(() => Notification.permission)).toBe('granted')
    expect(await deviceCount(USER)).toBe(1)
  })

  it('settings shows the switch on for this device', async () => {
    await alice.page.getByRole('link', { name: ko('nav.settings'), exact: true }).click()
    await pwExpect(
      alice.page.getByRole('switch', { name: koPushLabels.settings.switchTitle }),
    ).toBeChecked()
  })

  it('a comment from someone else reaches the fake push service as one encrypted request', async () => {
    await openBoard(alice.page)
    await writePost(alice.page, POST_TITLE, POST_BODY)

    await signedIn(bob.page, MODERATOR)
    await openBoard(bob.page)
    await openPost(bob.page, POST_TITLE)
    const commentedAt = Date.now()
    await postComment(bob.page, COMMENT)

    await until('the push request at the fake push service', () => received[0])
    await sleep(1500) // 두 번째가 따라오지 않는지(재시도 · 중복) 잠깐 본다
    expect(received).toHaveLength(1)
    const [request] = received
    console.log(`push request arrived ${request.at - commentedAt} ms after the comment`)
    expect(request.path).toBe(new URL(ENDPOINT).pathname)
    expect(request.headers['content-encoding']).toBe('aes128gcm')
    expect(Number(request.headers['ttl'])).toBeGreaterThan(0)
    const vapid = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(
      String(request.headers['authorization']),
    )
    expect(vapid, 'Authorization: vapid t=<jwt>, k=<key>').not.toBeNull()
    const claims = JSON.parse(Buffer.from(vapid![2], 'base64url').toString('utf8')) as {
      aud: string
      exp: number
      sub: string
    }
    expect(claims.aud).toBe(`http://127.0.0.1:${fakePushPort}`)
    expect(claims.exp * 1000).toBeGreaterThan(Date.now())
    expect(claims.sub).toMatch(/^(mailto:|https:)/)
    // 암호문이다 — 글 제목이 그대로 실려 가지 않는다
    expect(request.body.toString('latin1')).not.toContain(POST_TITLE)
  })

  it('the same JSON delivered to the service worker shows as a notification', async () => {
    const json = decryptWebPush(received[0].body)
    const message = JSON.parse(json) as {
      v: number
      title: string
      body?: string
      tag?: string
      link?: string
    }
    expect(message.v).toBe(1)
    expect(message.title).toContain(POST_TITLE) // lock-screen FULL: 견본이 내용을 보이는 쪽을 고른다
    if (message.link) expect(message.link.startsWith('/')).toBe(true)

    await until('the service worker registration', () => registrationId || undefined, 15_000)
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin: new URL(baseUrl).origin,
      registrationId,
      data: json,
    })
    const shown = await until(
      'the notification',
      async () => {
        const list = await alice.page.evaluate(async () =>
          (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({
            title: n.title,
            body: n.body,
            tag: n.tag,
          })),
        )
        return list.length > 0 ? list : undefined
      },
      15_000,
    )
    expect(shown[0].title).toBe(message.title)
    expect(shown[0].body).toBe(message.body ?? '')
  })

  it('signing out removes this device first; a new comment sends nothing', async () => {
    const removed = alice.page.waitForResponse(
      (r) => r.request().method() === 'DELETE' && r.url().includes('/api/v1/push/devices/'),
    )
    await alice.page
      .getByRole('button', { name: ko('header.signOut') })
      .first()
      .click()
    const response = await removed
    expect(response.status()).toBe(204)
    // 토큰을 지우기 전에 불렀다 — 인증 머리가 실려 있다
    expect(await response.request().headerValue('authorization')).toMatch(/^Bearer /)
    await alice.page.getByRole('heading', { level: 1, name: ko('login.title') }).waitFor()
    expect(await deviceCount(USER)).toBe(0)

    const before = received.length
    await postComment(bob.page, AFTER_LOGOUT)
    await sleep(8000) // 앞의 푸시가 댓글 뒤 몇 초 안에 왔다 — 그보다 길게 기다려도 요청이 없다
    expect(received).toHaveLength(before)
  })
})

describe('Advertising consent — agree, then night, then withdraw, with the state shown', () => {
  let page: Page
  let context: BrowserContext
  let browser: Browser

  beforeAll(async () => {
    ;({ browser, context, page } = await launch())
  })
  afterAll(async () => {
    await context?.close()
    await browser?.close()
  })

  const a = koAdvertisingLabels
  const agreeButton = (title: string) =>
    page.getByRole('button', { name: a.consent.agreeFor(title) })
  const toggle = (title: string) => page.getByRole('switch', { name: title })

  async function agreeInDialog(title: string) {
    await agreeButton(title).click()
    const dialog = page.getByRole('dialog', { name: title })
    const confirm = dialog.getByRole('button', { name: a.dialog.confirm })
    // 동의문을 읽고 체크하기 전에는 눌리지 않는다
    await pwExpect(confirm).toBeDisabled()
    await dialog.getByRole('checkbox', { name: a.dialog.check }).check()
    await confirm.click()
    await pwExpect(dialog).toHaveCount(0)
  }

  async function withdraw(title: string) {
    await toggle(title).click()
    await page.getByRole('button', { name: a.withdraw.confirm }).click()
  }

  it('starts off, needs the document to be read, and the night consent is locked until then', async () => {
    await signedIn(page, USER)
    await page.goto(`${baseUrl}/settings`)
    await pwExpect(page.getByRole('heading', { name: a.title })).toBeVisible()
    await pwExpect(agreeButton(a.consent.title)).toBeEnabled()
    await pwExpect(agreeButton(a.night.title)).toBeDisabled()
    await pwExpect(page.getByText(a.night.locked)).toBeVisible()
  })

  it('agrees to advertising, then to night advertising', async () => {
    await agreeInDialog(a.consent.title)
    await pwExpect(toggle(a.consent.title)).toBeChecked()
    await pwExpect(agreeButton(a.night.title)).toBeEnabled()
    await agreeInDialog(a.night.title)
    await pwExpect(toggle(a.night.title)).toBeChecked()
  })

  it('withdraws night first, then advertising, and shows the state (nothing stays agreed for the next run)', async () => {
    await withdraw(a.night.title)
    await pwExpect(toggle(a.night.title)).toHaveCount(0)
    await pwExpect(agreeButton(a.night.title)).toBeEnabled()
    await pwExpect(toggle(a.consent.title)).toBeChecked() // 광고 동의는 그대로 — 야간만 철회했다

    await withdraw(a.consent.title)
    await pwExpect(page.getByRole('status').filter({ hasText: /^철회했어요/ })).toBeVisible()
    await pwExpect(page.getByText(a.consent.stopped)).toBeVisible()
    await pwExpect(toggle(a.consent.title)).toHaveCount(0)
    // 광고 동의가 없으면 야간은 다시 잠긴다
    await pwExpect(agreeButton(a.night.title)).toBeDisabled()
    await page.reload()
    await pwExpect(agreeButton(a.consent.title)).toBeEnabled()
  })
})
