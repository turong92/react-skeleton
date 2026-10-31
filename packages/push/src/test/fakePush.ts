import type { PushApi } from '../pushApi'
import type { PushEnv, PushStorage, PushSubscriptionLike } from '../pushClient'
import type { PushConfig, PushDevice, PushPreference, PushSupport } from '../types'

/** URL-safe base64 로 적은 65바이트(0x04 로 시작하는 P-256 점) — 시험용 VAPID 공개 키 */
export const KEY_A = `BA${'A'.repeat(85)}`
/** KEY_A 와 다른 키 */
export const KEY_B = `BB${'A'.repeat(85)}`

export function memoryStorage(initial: Record<string, string> = {}): PushStorage & {
  data: Map<string, string>
} {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

function bytesOf(base64url: string): ArrayBuffer {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0)).buffer
}

export type FakePushState = {
  support: PushSupport
  permission: NotificationPermission
  /** 사용자가 권한 창에서 고를 답 */
  answer: NotificationPermission
  subscription: PushSubscriptionLike | null
  log: string[]
}

/** 브라우저를 흉내 내는 환경 — 부른 것이 `log` 에 남는다 */
export function fakePushEnv(
  initial: Partial<Pick<FakePushState, 'support' | 'permission' | 'answer'>> & {
    subscribedWith?: string
  } = {},
): PushEnv & { state: FakePushState } {
  const state: FakePushState = {
    support: initial.support ?? 'supported',
    permission: initial.permission ?? 'default',
    answer: initial.answer ?? 'granted',
    subscription: null,
    log: [],
  }
  const make = (key: string): PushSubscriptionLike => ({
    endpoint: 'https://push.example.com/send/abc',
    options: { applicationServerKey: bytesOf(key) },
    toJSON: () => ({ keys: { p256dh: 'p256dh-key', auth: 'auth-secret' } }),
    unsubscribe: async () => {
      state.log.push('unsubscribe')
      state.subscription = null
      return true
    },
  })
  if (initial.subscribedWith) state.subscription = make(initial.subscribedWith)
  return {
    state,
    support: () => state.support,
    permission: () => state.permission,
    requestPermission: async () => {
      state.log.push('requestPermission')
      state.permission = state.answer
      return state.permission
    },
    registration: async () => ({
      pushManager: {
        getSubscription: async () => state.subscription,
        subscribe: async (options) => {
          state.log.push('subscribe')
          const key = options.applicationServerKey
          state.subscription = make(
            btoa(String.fromCharCode(...key))
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, ''),
          )
          return state.subscription
        },
      },
    }),
  }
}

const baseConfig: PushConfig = {
  webPush: { publicKey: KEY_A },
  fcm: false,
  types: ['NOTE_UPDATED', 'comment.created'],
  advertisingTypes: [],
}

/** 서버를 흉내 내는 가짜 API — 부른 것이 `log` 에 남는다 */
export function fakePushApi(
  overrides: {
    config?: Partial<PushConfig>
    devices?: PushDevice[]
    preferences?: PushPreference[]
  } = {},
) {
  const log: string[] = []
  let devices = overrides.devices ?? []
  let preferences = overrides.preferences ?? [
    { type: 'NOTE_UPDATED', push: true, allChannelsMuted: false },
    { type: 'comment.created', push: true, allChannelsMuted: false },
  ]
  const api: PushApi = {
    config: async () => ({ ...baseConfig, ...overrides.config }),
    devices: async () => ({ items: devices }),
    registerDevice: async (installationId, body) => {
      log.push(`PUT ${installationId} ${body.endpoint}`)
      const device: PushDevice = {
        installationId,
        kind: 'WEBPUSH',
        platform: null,
        label: body.label ?? null,
        createdAt: '2026-01-01T00:00:00Z',
        lastSeenAt: '2026-01-01T00:00:00Z',
      }
      devices = [device, ...devices.filter((d) => d.installationId !== installationId)]
      return device
    },
    removeDevice: async (installationId) => {
      log.push(`DELETE ${installationId}`)
      devices = devices.filter((d) => d.installationId !== installationId)
    },
    sendTest: async (installationId) => void log.push(`TEST ${installationId}`),
    preferences: async () => ({ items: preferences }),
    setPreference: async (type, enabled) => {
      log.push(`PREF ${type} ${enabled}`)
      preferences = preferences.map((p) => (p.type === type ? { ...p, push: enabled } : p))
      return preferences.find((p) => p.type === type)!
    },
  }
  return { api, log }
}
