import type { AuthApi } from './authApi'
import { decodeTokenPrincipal } from './principal'
import type { TokenStore } from './tokenStore'
import type { AuthPrincipal, AuthState, AuthTokenResponse, PasswordLoginRequest } from './types'

export type AuthSession = {
  /** 바뀌기 전까지 같은 객체를 돌려준다(`useSyncExternalStore` 용) */
  getState(): AuthState
  subscribe(listener: () => void): () => void
  login(credentials: PasswordLoginRequest): Promise<AuthTokenResponse>
  socialLogin(
    provider: string,
    authorizationCode: string,
    redirectUri?: string,
  ): Promise<AuthTokenResponse>
  logout(): void
  /** `GET /auth/me` 로 principal 을 다시 읽는다 */
  refresh(): Promise<AuthPrincipal>
}

export type AuthSessionOptions = {
  api: AuthApi
  store: TokenStore
}

/**
 * 토큰 저장소 + 인증 API 를 묶은 세션. React 없이 테스트된다 — `AuthProvider` 는 이 세션을 구독할 뿐이다.
 * principal 은 로그인 응답 → `refresh()` → 토큰 claim 순으로 얻는다.
 */
export function createAuthSession({ api, store }: AuthSessionOptions): AuthSession {
  const listeners = new Set<() => void>()
  let known: { token: string; principal: AuthPrincipal | null } | null = null
  let state = compute()

  function compute(): AuthState {
    const token = store.get()
    if (!token) return { status: 'anonymous', token: null, principal: null }
    const principal = known?.token === token ? known.principal : decodeTokenPrincipal(token)
    return { status: 'authenticated', token, principal }
  }

  function refreshState() {
    const next = compute()
    if (
      next.status === state.status &&
      next.token === state.token &&
      next.principal === state.principal
    )
      return
    state = next
    listeners.forEach((listener) => listener())
  }

  store.subscribe(refreshState)

  async function accept(response: AuthTokenResponse) {
    known = { token: response.accessToken, principal: response.principal }
    store.set(response.accessToken)
    refreshState()
    return response
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    login: async (credentials) => accept(await api.login(credentials)),
    socialLogin: async (provider, authorizationCode, redirectUri) =>
      accept(await api.socialLogin(provider, authorizationCode, redirectUri)),
    logout() {
      known = null
      store.clear()
      refreshState()
    },
    async refresh() {
      const principal = await api.me()
      const token = store.get()
      if (token) known = { token, principal }
      refreshState()
      return principal
    },
  }
}
