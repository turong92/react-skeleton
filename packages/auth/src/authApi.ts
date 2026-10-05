import type { ApiClient } from '@skeleton/api-client'
import type { AuthPrincipal, AuthTokenResponse, PasswordLoginRequest } from './types'

export type AuthApi = {
  /** `POST /auth/login` */
  login(credentials: PasswordLoginRequest): Promise<AuthTokenResponse>
  /** `GET /auth/me` — 인증은 클라이언트의 `getAuthHeaders` 가 붙인다 */
  me(): Promise<AuthPrincipal>
  /** `POST /auth/social/{provider}/login` (auth-social 모듈) */
  socialLogin(
    provider: string,
    authorizationCode: string,
    redirectUri?: string,
  ): Promise<AuthTokenResponse>
}

/** 백엔드 `modules/auth` · `modules/auth-social` 계약을 그대로 부르는 얇은 호출 모음. 토큰은 저장하지 않는다(`createAuthSession`) */
export function createAuthApi(client: Pick<ApiClient, 'value'>): AuthApi {
  return {
    login: (credentials) =>
      client.value<AuthTokenResponse>('/auth/login', {
        method: 'POST',
        json: credentials,
        skipAuth: true,
      }),
    me: () => client.value<AuthPrincipal>('/auth/me'),
    socialLogin: (provider, authorizationCode, redirectUri) =>
      client.value<AuthTokenResponse>(`/auth/social/${encodeURIComponent(provider)}/login`, {
        method: 'POST',
        json: { authorizationCode, redirectUri },
        skipAuth: true,
      }),
  }
}
