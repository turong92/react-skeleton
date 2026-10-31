import { getInstallationId } from './installationId'
import type { PushApi } from './pushApi'
import type { PushStorage } from './storage'
import { browserPushStorage } from './storage'
import type { PushSupport } from './types'

export type { PushStorage } from './storage'

/** 브라우저의 구독 한 개 중 이 패키지가 읽는 부분 */
export type PushSubscriptionLike = {
  endpoint: string
  options?: { applicationServerKey?: ArrayBuffer | null }
  toJSON(): { keys?: Record<string, string> }
  unsubscribe(): Promise<boolean>
}

export type PushRegistrationLike = {
  pushManager: {
    getSubscription(): Promise<PushSubscriptionLike | null>
    subscribe(options: {
      userVisibleOnly: true
      applicationServerKey: Uint8Array<ArrayBuffer>
    }): Promise<PushSubscriptionLike>
  }
}

/** 브라우저가 푸시에 대해 아는 것 — 시험과 스토리는 가짜로 바꾼다 */
export type PushEnv = {
  support(): PushSupport
  permission(): NotificationPermission
  requestPermission(): Promise<NotificationPermission>
  /** 서비스 워커를 등록하고(이미 있으면 그대로) 준비된 등록을 돌려준다 */
  registration(): Promise<PushRegistrationLike>
}

export type PushDeps = {
  api: PushApi
  env: PushEnv
  storage: PushStorage
  accountId: string
  /** 기기 이름(서버가 내 기기 표에 보인다) */
  label?: string
}

const enabledKey = (accountId: string) => `skeleton.push.enabled.${accountId}`

/** 이 브라우저에서 이 계정이 푸시를 켠 표시 — 계정별이라 다른 사람이 로그인해도 자동으로 켜지지 않는다 */
export function isPushEnabled(storage: PushStorage, accountId: string): boolean {
  try {
    return storage.getItem(enabledKey(accountId)) === '1'
  } catch {
    return false
  }
}

function setEnabled(storage: PushStorage, accountId: string, on: boolean) {
  try {
    if (on) storage.setItem(enabledKey(accountId), '1')
    else storage.removeItem(enabledKey(accountId))
  } catch {
    // 저장소가 막혔다 — 표시 없이도 동작은 한다(다음 방문에 자동 맞추기만 빠진다)
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function sameKey(subscription: PushSubscriptionLike, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey
  if (!current) return false
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

/** 구독을 (필요하면 새로) 만들어 서버에 등록한다. 서버가 웹 푸시를 켜지 않았으면 false */
async function subscribeAndRegister(deps: PushDeps): Promise<boolean> {
  const config = await deps.api.config()
  if (!config.webPush) return false
  const key = keyBytes(config.webPush.publicKey)
  const { pushManager } = await deps.env.registration()
  let subscription = await pushManager.getSubscription()
  if (subscription && !sameKey(subscription, key)) {
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const keys = subscription.toJSON().keys
  if (!keys?.p256dh || !keys.auth) throw new Error('The push subscription has no keys')
  await deps.api.registerDevice(getInstallationId(deps.storage), {
    kind: 'WEBPUSH',
    endpoint: subscription.endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    ...(deps.label ? { label: deps.label } : {}),
  })
  return true
}

export type EnableResult = 'enabled' | 'denied' | 'dismissed' | 'unavailable'

/**
 * 「알림 받기」 — **사용자의 클릭 처리기 안에서만** 부른다(브라우저가 클릭 밖의 권한 요청을 막거나 깎아 둔다).
 * 권한 → 구독 → 서버 등록 → 켬 표시 순서이고, 권한 창을 닫으면 `dismissed`, 거절하면 `denied`.
 */
export async function enablePush(deps: PushDeps): Promise<EnableResult> {
  if (deps.env.support() !== 'supported') return 'unavailable'
  let permission = deps.env.permission()
  if (permission === 'default') permission = await deps.env.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'dismissed'
  if (!(await subscribeAndRegister(deps))) return 'unavailable'
  setEnabled(deps.storage, deps.accountId, true)
  return 'enabled'
}

export type SyncResult = 'off' | 'synced' | 'revoked' | 'unavailable'

/**
 * 로그인 뒤 · 창이 다시 보일 때 서버와 브라우저를 맞춘다. **권한은 절대 묻지 않는다.**
 * 켬 표시가 있고 권한이 `granted` 면 구독이 없거나 공개 키가 다를 때 다시 구독하고 등록(=`last_seen_at` 갱신).
 * 권한이 `denied` 로 바뀌었으면 서버에서 이 기기를 지우고 표시를 거둔다.
 */
export async function syncPush(deps: PushDeps): Promise<SyncResult> {
  if (!isPushEnabled(deps.storage, deps.accountId)) return 'off'
  if (deps.env.support() !== 'supported') return 'unavailable'
  const permission = deps.env.permission()
  if (permission === 'denied') {
    await deps.api.removeDevice(getInstallationId(deps.storage))
    setEnabled(deps.storage, deps.accountId, false)
    return 'revoked'
  }
  if (permission !== 'granted') return 'off'
  return (await subscribeAndRegister(deps)) ? 'synced' : 'unavailable'
}

/** 「푸시 끄기」 — 서버의 이 기기 줄을 지우고 브라우저 구독을 거둔다 */
export async function disablePush(deps: PushDeps): Promise<void> {
  await deps.api.removeDevice(getInstallationId(deps.storage))
  setEnabled(deps.storage, deps.accountId, false)
  if (deps.env.support() !== 'supported') return
  const { pushManager } = await deps.env.registration()
  await (await pushManager.getSubscription())?.unsubscribe()
}

/**
 * 로그아웃 — **앱이 토큰을 지우기 전에** 부르고 끝나길 기다린다(`await unregisterPush(api); clearTokens()`).
 * 인증이 필요한 호출이라 토큰을 지운 뒤에는 서버의 기기 줄을 못 지운다. 실패해도 던지지 않는다 — 로그아웃은 막히지 않는다
 * (서버는 세션이 끊길 때 그 세션의 기기도 정리한다).
 */
export async function unregisterPush(
  api: Pick<PushApi, 'removeDevice'>,
  { storage = browserPushStorage() }: { storage?: PushStorage } = {},
): Promise<void> {
  try {
    await api.removeDevice(getInstallationId(storage))
  } catch {
    // 로그아웃을 막지 않는다
  }
}

/** 이 브라우저의 푸시 지원 — iOS 는 홈 화면에 추가한 앱에서만 되고, 서비스 워커 · `PushManager` · `Notification` 중 없으면 안 된다 */
export function pushSupport(
  win: Window | undefined = typeof window === 'undefined' ? undefined : window,
): PushSupport {
  if (!win) return 'unsupported'
  const nav = win.navigator as Navigator & { standalone?: boolean }
  const ios =
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  if (ios) {
    const standalone =
      nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches
    if (!standalone) return 'needs-install'
  }
  const ok = 'serviceWorker' in nav && 'PushManager' in win && 'Notification' in win
  return ok ? 'supported' : 'unsupported'
}

/** 실제 브라우저 — `serviceWorkerUrl` 의 워커를 등록한다(`pushServiceWorker` 플러그인이 내는 파일) */
export function browserPushEnv({ serviceWorkerUrl }: { serviceWorkerUrl: string }): PushEnv {
  return {
    support: () => pushSupport(),
    permission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission(),
    registration: async () => {
      await navigator.serviceWorker.register(serviceWorkerUrl)
      return navigator.serviceWorker.ready
    },
  }
}

const snoozeKey = (accountId: string) => `skeleton.push.prompt-snoozed-until.${accountId}`
const DAY_MS = 24 * 60 * 60 * 1000

/** 「나중에」를 눌러 앱 안 띠를 쉬는 중이다 */
export function isPromptSnoozed(
  storage: PushStorage,
  accountId: string,
  now: number = Date.now(),
): boolean {
  try {
    return Number(storage.getItem(snoozeKey(accountId)) ?? 0) > now
  } catch {
    return false
  }
}

export function snoozePrompt(
  storage: PushStorage,
  accountId: string,
  days: number,
  now: number = Date.now(),
): void {
  try {
    storage.setItem(snoozeKey(accountId), String(now + days * DAY_MS))
  } catch {
    // 저장소가 막혔다 — 이 페이지에서만 숨긴다
  }
}
