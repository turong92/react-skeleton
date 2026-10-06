import type { AuthApi, RefreshDelivery } from './authApi'
import type { SignInMethodsConfig } from './screens/methods'
import type { SocialProviderConfig } from './social'
import type { AuthMethodsWire } from './types'

/*
 * 로그인 방법 발견 — 백엔드의 `GET /auth/methods` 가 말해 주는 것을 앱이 따른다(환경변수는 선택적 덮어쓰기).
 * 모양은 계약 FINAL-2b. 옛 백엔드(엔드포인트 없음 · 일부 필드 없음)에서도 안전한 쪽(비밀번호만 · 가입 닫힘)으로 읽는다.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export function normalizeMethodsInfo(raw: unknown): AuthMethodsWire {
  const source = isRecord(raw) ? raw : {}
  const signUp = isRecord(source.signUp) ? source.signUp : {}
  const social = Array.isArray(source.social) ? source.social : []
  return {
    methods: Array.isArray(source.methods)
      ? source.methods.filter((m): m is string => typeof m === 'string')
      : [],
    signUp: {
      password: signUp.password === true,
      emailVerification: signUp.emailVerification === true,
      social: signUp.social === true,
    },
    social: social
      .filter(
        (entry): entry is Record<string, unknown> =>
          isRecord(entry) && typeof entry.provider === 'string',
      )
      .map((entry) => ({
        provider: entry.provider as string,
        clientId: typeof entry.clientId === 'string' ? entry.clientId : null,
        redirectUri: typeof entry.redirectUri === 'string' ? entry.redirectUri : null,
      })),
    captchaRequired: source.captchaRequired === true,
    refreshDelivery:
      source.refreshDelivery === 'body' || source.refreshDelivery === 'cookie'
        ? source.refreshDelivery
        : null,
  }
}

export type DiscoveredMethods = {
  methods: SignInMethodsConfig
  /** 비밀번호 가입이 열려 있는가(가입 화면을 보일지) */
  signUp: boolean
  /** 소셜 리다이렉트에 필요한 공개 값 — 제공자 코드 → `createSocialLoginFlow` 설정 */
  providers: Record<string, SocialProviderConfig>
}

export type MethodsFromInfoOptions = {
  /** 백엔드가 clientId 를 모르는 제공자에 앱이 줄 clientId(보통 `VITE_SOCIAL_<제공자>_CLIENT_ID`) */
  clientIds?: Record<string, string | undefined>
  /** 백엔드가 `redirectUri` 를 안 줄 때 쓸 이 앱의 소셜 로그인 콜백 주소 */
  defaultRedirectUri?: string
}

/** 백엔드의 답을 화면이 쓰는 모양으로 — clientId 가 있는(백엔드 또는 앱이 준) 제공자만 버튼이 된다 */
export function methodsFromInfo(
  info: AuthMethodsWire,
  { clientIds = {}, defaultRedirectUri = '' }: MethodsFromInfoOptions = {},
): DiscoveredMethods {
  const providers: Record<string, SocialProviderConfig> = {}
  for (const entry of info.social) {
    const clientId = entry.clientId ?? clientIds[entry.provider]
    if (!clientId) continue
    providers[entry.provider] = {
      clientId,
      redirectUri: entry.redirectUri ?? defaultRedirectUri,
    }
  }
  return {
    methods: {
      password: info.methods.includes('password'),
      magicLink: info.methods.includes('magic_link'),
      social: Object.keys(providers).map((provider) => ({ provider })),
    },
    signUp: info.signUp.password,
    providers,
  }
}

/** 백엔드의 리프레시 전달 방식과 이 앱의 설정이 다르면 한 줄 — 갱신이 조용히 실패한다(쿠키 ↔ 본문). 같거나 백엔드가 모르면 null */
export function deliveryMismatch(
  info: AuthMethodsWire,
  configured: RefreshDelivery,
): string | null {
  if (info.refreshDelivery === null || info.refreshDelivery === configured) return null
  return `The backend delivers the refresh token by "${info.refreshDelivery}" but this app is configured for "${configured}" (VITE_AUTH_REFRESH_DELIVERY) — token refresh will fail until both agree.`
}

const FIVE_MINUTES = 5 * 60_000
const cache = new WeakMap<
  AuthApi,
  { at: number; promise: Promise<AuthMethodsWire>; value?: AuthMethodsWire }
>()

/**
 * 한 API 당 한 번 묻고 5분 동안 모든 화면이 같은 답을 쓴다(백엔드의 `Cache-Control: max-age=300` 과 같은 길이).
 * 실패는 기억하지 않는다 — 다음 화면 · 다시 시도가 다시 묻는다.
 */
export function loadAuthMethods(
  api: AuthApi,
  { now = Date.now }: { now?: () => number } = {},
): Promise<AuthMethodsWire> {
  const known = cache.get(api)
  if (known && now() - known.at < FIVE_MINUTES) return known.promise
  const promise = api.methods().then(normalizeMethodsInfo)
  const entry: { at: number; promise: Promise<AuthMethodsWire>; value?: AuthMethodsWire } = {
    at: now(),
    promise,
  }
  cache.set(api, entry)
  promise.then(
    (value) => {
      entry.value = value
    },
    () => {
      if (cache.get(api) === entry) cache.delete(api) // 실패는 기억하지 않는다
    },
  )
  return promise
}

/** 이미 받아 둔(5분 안의) 답 — 화면 사이를 오갈 때 로딩 깜박임 없이 바로 그린다. 없으면 undefined */
export function peekAuthMethods(
  api: AuthApi,
  { now = Date.now }: { now?: () => number } = {},
): AuthMethodsWire | undefined {
  const known = cache.get(api)
  return known && now() - known.at < FIVE_MINUTES ? known.value : undefined
}

export function clearAuthMethodsCache(api: AuthApi): void {
  cache.delete(api)
}
