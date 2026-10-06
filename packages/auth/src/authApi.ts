import type { ApiClient } from '@skeleton/api-client'
import type {
  AuthMethodsWire,
  AuthPrincipal,
  AuthTokenResponse,
  PasswordLoginRequest,
  SocialProof,
} from './types'

/** 리프레시 토큰이 오가는 방식 — 백엔드 `skeleton.auth-session.delivery`(`body` 기본 | `cookie`)와 같아야 한다 */
export type RefreshDelivery = 'body' | 'cookie'

export type AuthApi = {
  /** `GET /auth/methods` — 백엔드가 열어 둔 로그인 방법 · 소셜 제공자의 공개 값(캐시 가능, 인증 없음). 앱은 환경변수 대신 이것을 따른다 */
  methods(): Promise<AuthMethodsWire>
  /** `POST /auth/login` — `deviceName` 은 `X-Device-Name` 헤더로 가서 세션 목록에 보인다 */
  login(
    credentials: PasswordLoginRequest,
    options?: { deviceName?: string },
  ): Promise<AuthTokenResponse>
  /** `GET /auth/me` — 인증은 클라이언트의 `getAuthHeaders` 가 붙인다 */
  me(): Promise<AuthPrincipal>
  /** `POST /auth/social/{provider}/login` (auth-social 모듈) */
  socialLogin(
    provider: string,
    authorizationCode: string,
    redirectUri?: string,
    /** 이 시도의 PKCE `codeVerifier` · `nonce` — 백엔드가 알려 준 제공자만(없으면 보내지 않는다) */
    proof?: SocialProof,
  ): Promise<AuthTokenResponse>
  /** `POST /auth/refresh` (auth-session) — body 모드는 토큰을 본문으로, cookie 모드는 쿠키(+`X-Requested-With`)로 */
  refresh(refreshToken: string | null): Promise<AuthTokenResponse>
  /** `POST /auth/logout` (auth-session) — 멱등, 항상 204 */
  logout(refreshToken: string | null): Promise<void>
  /** `POST /auth/magic-link/request` (auth-magic-link) — 항상 202(없는 주소여도 같다) */
  magicLinkRequest(email: string, captchaToken?: string): Promise<void>
  /** `POST /auth/magic-link/redeem` — 메일 링크의 토큰을 로그인으로 바꾼다(410 `ACCOUNT.TOKEN_INVALID`). `deviceName` 은 로그인처럼 `X-Device-Name` 헤더로 간다 */
  magicLinkRedeem(token: string, options?: { deviceName?: string }): Promise<AuthTokenResponse>
}

export type AuthApiOptions = {
  /** 기본 `body`. `cookie` 면 갱신 · 로그아웃에 CSRF 헤더를 붙인다(클라이언트는 `withCredentials: true` 로 만든다) */
  delivery?: RefreshDelivery
}

const CSRF_HEADERS = { 'X-Requested-With': 'fetch' }

/** 백엔드 `modules/auth` · `auth-social` · `auth-session` · `auth-magic-link` 계약을 그대로 부르는 얇은 호출 모음. 토큰은 저장하지 않는다(`createAuthSession`) */
export function createAuthApi(
  client: Pick<ApiClient, 'value' | 'noContent'>,
  { delivery = 'body' }: AuthApiOptions = {},
): AuthApi {
  const csrf = delivery === 'cookie' ? { headers: CSRF_HEADERS } : {}
  const tokenBody = (refreshToken: string | null) =>
    delivery === 'cookie' || refreshToken === null ? {} : { refreshToken }
  return {
    methods: () => client.value<AuthMethodsWire>('/auth/methods', { skipAuth: true }),
    login: (credentials, options) =>
      client.value<AuthTokenResponse>('/auth/login', {
        method: 'POST',
        json: credentials,
        skipAuth: true,
        ...(options?.deviceName ? { headers: { 'X-Device-Name': options.deviceName } } : {}),
      }),
    me: () => client.value<AuthPrincipal>('/auth/me'),
    socialLogin: (provider, authorizationCode, redirectUri, proof) =>
      client.value<AuthTokenResponse>(`/auth/social/${encodeURIComponent(provider)}/login`, {
        method: 'POST',
        json: { authorizationCode, redirectUri, ...proof },
        skipAuth: true,
      }),
    refresh: (refreshToken) =>
      client.value<AuthTokenResponse>('/auth/refresh', {
        method: 'POST',
        json: tokenBody(refreshToken),
        skipAuth: true,
        ...csrf,
      }),
    logout: (refreshToken) =>
      client.noContent('/auth/logout', {
        method: 'POST',
        json: tokenBody(refreshToken),
        skipAuth: true,
        ...csrf,
      }),
    magicLinkRequest: async (email, captchaToken) => {
      await client.value('/auth/magic-link/request', {
        method: 'POST',
        json: { email, ...(captchaToken ? { captchaToken } : {}) },
        skipAuth: true,
      })
    },
    magicLinkRedeem: (token, options) =>
      client.value<AuthTokenResponse>('/auth/magic-link/redeem', {
        method: 'POST',
        json: { token },
        skipAuth: true,
        ...(options?.deviceName ? { headers: { 'X-Device-Name': options.deviceName } } : {}),
      }),
  }
}
