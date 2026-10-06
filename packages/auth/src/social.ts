import type { AuthSession } from './session'
import type { TokenStorage } from './tokenStore'
import {
  codeChallengeS256,
  createCodeVerifier,
  createNonce,
  createState,
  hasWebCrypto,
  PkceUnavailableError,
} from './pkce'
import type { AuthTokenResponse, SocialAuthorizeInfo, SocialMode, SocialProof } from './types'

/*
 * 소셜 로그인의 프론트 절반. 백엔드(`modules/auth-social`)는 `POST /auth/social/{provider}/login` 으로 받은
 * `{ authorizationCode, redirectUri }` 만 안다 — 제공자의 authorize 화면으로 보내는 일과 돌아온 `code` 를 읽는 일은 앱의 몫이고,
 * 여기서 돕는다. 백엔드가 정의하지 않은 것(scope 의 의미, 계정 연결 정책)은 만들지 않는다.
 */

export type SocialProviderConfig = {
  clientId: string
  /** 제공자 콘솔에 등록한 콜백 주소 — authorize 요청과 `socialLogin(…, redirectUri)` 에 **바이트까지 같은** 값을 쓴다 */
  redirectUri: string
  /** 백엔드(`GET /auth/methods`)가 알려 주는 PKCE · nonce 처리 — 없으면(옛 백엔드) 둘 다 보내지 않는다 */
  pkce?: SocialMode
  nonce?: SocialMode
  /** 백엔드가 알려 주는 authorize 주소 · scope · 고정 파라미터 — 있으면 이것이 정본이고 아래 `authorizeUrl` · `scope` · `params` · 옛 표는 쓰지 않는다 */
  authorize?: SocialAuthorizeInfo
  /** 앱이 직접 주는 주소(환경변수로 방법을 덮어쓸 때) — `authorize` 가 없을 때만 쓰인다 */
  authorizeUrl?: string
  /** 공백으로 이어 보낸다. `authorize` 가 없을 때만 쓰인다 */
  scope?: string | string[]
  /** 덧붙일 쿼리(`prompt` …). `client_id` `redirect_uri` `response_type` `state` `code_challenge*` `nonce` 는 덮지 못한다 */
  params?: Record<string, string>
}

type Preset = { authorizeUrl: string; scope?: string }

/**
 * **LEGACY** — `authorize` 정보를 보내지 않는 백엔드(FINAL-3 이전)를 위한 대체 표. 새 백엔드는 제공자마다 authorize 주소 · scope 를 `GET /auth/methods` 로 알려 주므로
 * 이 표는 쓰이지 않는다(kakao · naver 는 백엔드가 `authorize: null` 을 보내 이 표가 계속 쓰인다). 제공자를 더할 때 여기에 더하지 않는다 — 백엔드 설정에 더한다.
 */
export const SOCIAL_AUTHORIZE_PRESETS: Readonly<Record<string, Preset>> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email profile',
  },
  kakao: { authorizeUrl: 'https://kauth.kakao.com/oauth/authorize' },
  naver: { authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize' },
}

const uses = (mode: SocialMode | undefined) => mode === 'REQUIRED' || mode === 'SUPPORTED'

/** 이 시도의 PKCE challenge · nonce — 제공자가 쓸 때만 URL 에 실린다 */
export type AuthorizeExtras = { codeChallenge?: string; nonce?: string }

/** 제공자 authorize 화면으로 보낼 주소(authorization code 흐름). `state` 는 CSRF 방지용으로 항상 붙는다(naver 는 필수) */
export function buildAuthorizeUrl(
  provider: string,
  config: SocialProviderConfig,
  state: string,
  extras: AuthorizeExtras = {},
): string {
  const preset = SOCIAL_AUTHORIZE_PRESETS[provider]
  const base = config.authorize?.url ?? config.authorizeUrl ?? preset?.authorizeUrl
  if (!base)
    throw new Error(
      `social provider "${provider}" has no authorize info: the backend must send it (GET /auth/methods → authorize) or set authorizeUrl in the config`,
    )
  const url = new URL(base)
  const params = config.authorize ? config.authorize.params : (config.params ?? {})
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  const scope = config.authorize
    ? config.authorize.scopes.join(' ')
    : Array.isArray(config.scope)
      ? config.scope.join(' ')
      : (config.scope ?? preset?.scope)
  if (scope) url.searchParams.set('scope', scope)
  else url.searchParams.delete('scope')
  url.searchParams.set('state', state)
  // 제공자가 쓰지 않는 값은 보내지 않는다 — 모르는 파라미터를 거절하는 제공자가 있다
  url.searchParams.delete('code_challenge')
  url.searchParams.delete('code_challenge_method')
  url.searchParams.delete('nonce')
  if (uses(config.pkce) && extras.codeChallenge) {
    url.searchParams.set('code_challenge', extras.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
  }
  if (uses(config.nonce) && extras.nonce) url.searchParams.set('nonce', extras.nonce)
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

/** 이 왕복이 하려는 일 — 같은 제공자 화면이라도 로그인 · 연결 · 다시 인증은 서로의 콜백을 받지 못한다 */
export type SocialAction = 'login' | 'link' | 'reauth'

export type SocialLoginFlowOptions = {
  providers: Record<string, SocialProviderConfig>
  /** `createAuthSession` 의 세션(또는 `socialLogin` 만 가진 것) */
  session: Pick<AuthSession, 'socialLogin'>
  /**
   * `state` · verifier · nonce 를 보관한다. 제공자 화면에 다녀오면 페이지가 새로 뜨므로 `window.sessionStorage` 를 넘긴다
   * (생략하면 메모리 — 같은 페이지에서만 이어진다). 탭마다 따로이므로 다른 탭이 시작한 콜백은 거절된다.
   */
  storage?: TokenStorage
  /** 저장 키 접두어(기본 `skeleton.social.`) */
  storagePrefix?: string
  /** 이 흐름이 받는 왕복의 종류(기본 `login`; 계정 연결 흐름은 `link`) — 다른 종류가 시작한 state 는 소비하지 않고 거절한다 */
  purpose?: 'login' | 'link'
  /** 테스트용 */
  createState?: () => string
}

export type SocialStart = { url: string; state: string }

export type SocialComplete = {
  provider: string
  token: AuthTokenResponse
  context?: unknown
  action: SocialAction
}

export type SocialLoginFlow = {
  /**
   * `state`(+ PKCE verifier · nonce, 제공자가 쓰면)를 만들어 보관하고 authorize 주소를 돌려준다 — 호출자가 `window.location.assign(url)` 한다.
   * PKCE 가 **필수** 인 제공자인데 WebCrypto 가 없으면 `PkceUnavailableError` 로 시작하지 않는다(아무것도 보관하지 않는다).
   * `context`(JSON 으로 직렬화되는 값)는 그 state 에 묶여 콜백 결과로 돌아온다 — 다시 인증 왕복이 「무슨 작업을 · 어느 계정이」 하려던 것인지 싣는 자리(`socialLink`)
   */
  start(
    provider: string,
    context?: unknown,
    options?: { action?: SocialAction },
  ): Promise<SocialStart>
  /** 콜백 쿼리를 확인(state 일치 · 에러 · code)하고 `session.socialLogin(provider, code, redirectUri, { codeVerifier, nonce })` 를 **바로** 부른다(코드는 한 번 · 짧은 수명). 같은 콜백을 두 번 불러도 로그인은 한 번 */
  complete(search: string | URLSearchParams): Promise<SocialComplete>
}

type Pending = {
  provider: string
  redirectUri: string
  purpose: 'login' | 'link'
  action: SocialAction
  codeVerifier?: string
  nonce?: string
  context?: unknown
}

export function createSocialLoginFlow({
  providers,
  session,
  storage,
  storagePrefix = 'skeleton.social.',
  purpose = 'login',
  createState: makeState = createState,
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
    async start(provider, context, options) {
      const config = providers[provider]
      if (!config) throw new Error(`social provider "${provider}" is not configured`)
      const needsVerifier = uses(config.pkce) && hasWebCrypto()
      if (config.pkce === 'REQUIRED' && !needsVerifier) throw new PkceUnavailableError()
      if (config.nonce === 'REQUIRED' && !hasWebCrypto()) throw new PkceUnavailableError()
      const state = makeState()
      const codeVerifier = needsVerifier ? createCodeVerifier() : undefined
      const nonce = uses(config.nonce) && hasWebCrypto() ? createNonce() : undefined
      const url = buildAuthorizeUrl(provider, config, state, {
        ...(codeVerifier ? { codeChallenge: await codeChallengeS256(codeVerifier) } : {}),
        ...(nonce ? { nonce } : {}),
      })
      store.setItem(
        storagePrefix + state,
        JSON.stringify({
          provider,
          redirectUri: config.redirectUri,
          purpose,
          action: options?.action ?? (purpose === 'login' ? 'login' : 'link'),
          ...(codeVerifier ? { codeVerifier } : {}),
          ...(nonce ? { nonce } : {}),
          ...(context === undefined ? {} : { context }),
        } satisfies Pending),
      )
      return { url, state }
    },

    complete(search) {
      const callback = parseSocialCallback(search)
      const known = callback.state ? inflight.get(callback.state) : undefined
      if (known) return known
      const pending = callback.state ? readPending(callback.state) : null
      // 제공자가 에러만 돌려보내고 state 를 빼먹었다 — 서버로 나가는 것이 없으니 에러 그대로 보여 준다(취소를 「위조」로 읽지 않는다)
      if (!callback.state && callback.error) return Promise.reject(providerError(callback))
      if (!callback.state) return Promise.reject(mismatch())
      // 다른 종류의 왕복(연결 · 로그인)이 시작한 state 는 건드리지 않는다 — 그쪽 콜백이 쓴다
      if (!pending || pending.purpose !== purpose) return Promise.reject(mismatch())
      store.removeItem(storagePrefix + callback.state)

      const run = (async () => {
        if (callback.error) throw providerError(callback)
        if (!callback.code)
          throw new SocialLoginCallbackError(
            'missing_code',
            'The callback has no authorization code',
          )
        const proof: SocialProof = {
          ...(pending.codeVerifier ? { codeVerifier: pending.codeVerifier } : {}),
          ...(pending.nonce ? { nonce: pending.nonce } : {}),
        }
        const token = await (Object.keys(proof).length > 0
          ? session.socialLogin(pending.provider, callback.code, pending.redirectUri, proof)
          : session.socialLogin(pending.provider, callback.code, pending.redirectUri))
        return {
          provider: pending.provider,
          token,
          action: pending.action,
          ...(pending.context === undefined ? {} : { context: pending.context }),
        }
      })()
      inflight.set(callback.state, run)
      return run
    },
  }
}

const providerError = (callback: SocialCallback) =>
  new SocialLoginCallbackError(
    'provider_error',
    callback.errorDescription ?? `The provider returned an error: ${callback.error}`,
    callback.error,
  )

const mismatch = () =>
  new SocialLoginCallbackError(
    'state_mismatch',
    'The callback state does not match a login this browser started',
  )
