import type { AuthSession } from './session'
import type { TokenStorage } from './tokenStore'
import type { AuthTokenResponse } from './types'

/*
 * 소셜 로그인의 프론트 절반. 백엔드(`modules/auth-social`)는 `POST /auth/social/{provider}/login` 으로 받은
 * `{ authorizationCode, redirectUri }` 만 안다 — 제공자의 authorize 화면으로 보내는 일과 돌아온 `code` 를 읽는 일은 앱의 몫이고,
 * 여기서 돕는다. 백엔드가 정의하지 않은 것(scope 의 의미, 계정 연결 정책)은 만들지 않는다.
 */

export type SocialProviderConfig = {
  clientId: string
  /** 제공자 콘솔에 등록한 콜백 주소 — authorize 요청과 `socialLogin(…, redirectUri)` 에 같은 값을 쓴다 */
  redirectUri: string
  /** 없으면 `google` · `kakao` · `naver` 는 알려진 주소를 쓴다. 다른 제공자는 필수 */
  authorizeUrl?: string
  /** 공백으로 이어 보낸다. 없으면 프리셋 값(google 만 있다) */
  scope?: string | string[]
  /** 덧붙일 쿼리(`prompt` …). `client_id` `redirect_uri` `response_type` `state` 는 덮지 못한다 */
  params?: Record<string, string>
}

type Preset = { authorizeUrl: string; scope?: string }

/** 백엔드에 제공자 모듈이 있는 세 곳의 authorize 주소(공개된 제공자 사양). scope 는 앱 콘솔 설정에 달려 있어 google 만 기본값을 둔다 */
export const SOCIAL_AUTHORIZE_PRESETS: Readonly<Record<string, Preset>> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
  },
  kakao: { authorizeUrl: 'https://kauth.kakao.com/oauth/authorize' },
  naver: { authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize' },
}

/** 제공자 authorize 화면으로 보낼 주소(authorization code 흐름). `state` 는 CSRF 방지용으로 항상 붙는다(naver 는 필수) */
export function buildAuthorizeUrl(
  provider: string,
  config: SocialProviderConfig,
  state: string,
): string {
  const preset = SOCIAL_AUTHORIZE_PRESETS[provider]
  const base = config.authorizeUrl ?? preset?.authorizeUrl
  if (!base)
    throw new Error(
      `social provider "${provider}" has no preset: set its authorizeUrl in the config`,
    )
  const url = new URL(base)
  for (const [key, value] of Object.entries(config.params ?? {})) url.searchParams.set(key, value)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  const scope = Array.isArray(config.scope)
    ? config.scope.join(' ')
    : (config.scope ?? preset?.scope)
  if (scope) url.searchParams.set('scope', scope)
  url.searchParams.set('state', state)
  return url.toString()
}

export type SocialCallback = {
  code?: string
  state?: string
  error?: string
  errorDescription?: string
}

/** 콜백 주소의 쿼리(`location.search` · `URLSearchParams`)에서 `code` · `state` · 제공자 에러를 읽는다 */
export function parseSocialCallback(search: string | URLSearchParams): SocialCallback {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search
  const result: SocialCallback = {}
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')
  const description = params.get('error_description')
  if (code) result.code = code
  if (state) result.state = state
  if (error) result.error = error
  if (description) result.errorDescription = description
  return result
}

export type SocialLoginCallbackFailure = 'state_mismatch' | 'provider_error' | 'missing_code'

/** 콜백을 로그인으로 잇지 못했다(요청은 나가지 않았다). 백엔드가 거절한 경우는 `ApiRequestError` 가 그대로 나간다 */
export class SocialLoginCallbackError extends Error {
  readonly reason: SocialLoginCallbackFailure
  /** 제공자가 돌려준 `error`(예: `access_denied`) */
  readonly providerError?: string

  constructor(reason: SocialLoginCallbackFailure, message: string, providerError?: string) {
    super(message)
    this.name = 'SocialLoginCallbackError'
    this.reason = reason
    this.providerError = providerError
  }
}

export type SocialLoginFlowOptions = {
  providers: Record<string, SocialProviderConfig>
  /** `createAuthSession` 의 세션(또는 `socialLogin` 만 가진 것) */
  session: Pick<AuthSession, 'socialLogin'>
  /**
   * `state` 를 보관한다. 제공자 화면에 다녀오면 페이지가 새로 뜨므로 `window.sessionStorage` 를 넘긴다
   * (생략하면 메모리 — 같은 페이지에서만 이어진다).
   */
  storage?: TokenStorage
  /** 저장 키 접두어(기본 `skeleton.social.`) */
  storagePrefix?: string
  /** 테스트용 */
  createState?: () => string
}

export type SocialLoginFlow = {
  /** `state` 를 만들어 보관하고 authorize 주소를 돌려준다 — 호출자가 `window.location.assign(url)` 한다 */
  start(provider: string): { url: string; state: string }
  /** 콜백 쿼리를 확인(state 일치 · 에러 · code)하고 `session.socialLogin(provider, code, redirectUri)` 를 부른다. 같은 콜백을 두 번 불러도 로그인은 한 번 */
  complete(
    search: string | URLSearchParams,
  ): Promise<{ provider: string; token: AuthTokenResponse }>
}

type Pending = { provider: string; redirectUri: string }

export function createSocialLoginFlow({
  providers,
  session,
  storage,
  storagePrefix = 'skeleton.social.',
  createState = () => globalThis.crypto.randomUUID(),
}: SocialLoginFlowOptions): SocialLoginFlow {
  const memory = new Map<string, string>()
  const store: TokenStorage = storage ?? {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  }
  const inflight = new Map<string, ReturnType<SocialLoginFlow['complete']>>()

  function readPending(state: string): Pending | null {
    try {
      const raw = store.getItem(storagePrefix + state)
      return raw ? (JSON.parse(raw) as Pending) : null
    } catch {
      return null
    }
  }

  return {
    start(provider) {
      const config = providers[provider]
      if (!config) throw new Error(`social provider "${provider}" is not configured`)
      const state = createState()
      const url = buildAuthorizeUrl(provider, config, state)
      store.setItem(
        storagePrefix + state,
        JSON.stringify({ provider, redirectUri: config.redirectUri } satisfies Pending),
      )
      return { url, state }
    },

    complete(search) {
      const callback = parseSocialCallback(search)
      const pending = callback.state ? readPending(callback.state) : null
      if (!callback.state) return Promise.reject(mismatch())
      const known = inflight.get(callback.state)
      if (known) return known
      if (!pending) return Promise.reject(mismatch())
      store.removeItem(storagePrefix + callback.state)

      const run = (async () => {
        if (callback.error)
          throw new SocialLoginCallbackError(
            'provider_error',
            callback.errorDescription ?? `The provider returned an error: ${callback.error}`,
            callback.error,
          )
        if (!callback.code)
          throw new SocialLoginCallbackError(
            'missing_code',
            'The callback has no authorization code',
          )
        const token = await session.socialLogin(
          pending.provider,
          callback.code,
          pending.redirectUri,
        )
        return { provider: pending.provider, token }
      })()
      inflight.set(callback.state, run)
      return run
    },
  }
}

const mismatch = () =>
  new SocialLoginCallbackError(
    'state_mismatch',
    'The callback state does not match a login this browser started',
  )
