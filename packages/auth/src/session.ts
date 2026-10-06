import { ApiRequestError } from '@skeleton/api-client'
import type { AuthApi, RefreshDelivery } from './authApi'
import { decodeTokenPrincipal } from './principal'
import type { RefreshStore } from './refreshStore'
import type { SessionRefresher } from './sessionRefresher'
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
  /** 메일 링크(`/magic-link?token=`)의 토큰으로 로그인한다 */
  magicLinkLogin(token: string): Promise<AuthTokenResponse>
  /** 다른 흐름이 받은 토큰 응답을 이 세션에 들인다 */
  signIn(response: AuthTokenResponse): AuthTokenResponse
  /** 이 기기에서 먼저 로그아웃(저장소 비움 — 동기)한 뒤 서버에 세션 폐기를 알린다. 서버가 실패해도 로그아웃은 유지 */
  logout(): Promise<void>
  /** `GET /auth/me` 로 principal 을 다시 읽는다 */
  refresh(): Promise<AuthPrincipal>
  /** 액세스 토큰은 없지만 갱신 자격이 남아 있으면(새 탭 · 쿠키 모드 표식) 갱신해 로그인 상태를 되살린다. 앱 시작 때 한 번 */
  restore(): Promise<void>
}

export type AuthSessionOptions = {
  api: AuthApi
  store: TokenStore
  /** 주면 로그인 응답의 리프레시 토큰(또는 쿠키 모드의 표식)을 이 저장소에 둔다. 토큰 갱신(`createSessionRefresher`)과 같은 저장소를 쓴다 */
  refreshStore?: RefreshStore
  /** 기본 `body` */
  delivery?: RefreshDelivery
  /** 주면 `restore()` 가 이 갱신기(single-flight · 탭 락 · 죽은 자격 비우기)를 거친다. 앱이 `recoverUnauthorized` 에 꽂은 것과 같은 것을 준다 */
  refresher?: Pick<SessionRefresher, 'refresh'>
  /** 로그인 때 서버에 보여 줄 기기 이름(`X-Device-Name`) */
  deviceName?: string
}

/**
 * 토큰 저장소 + 인증 API 를 묶은 세션. React 없이 테스트된다 — `AuthProvider` 는 이 세션을 구독할 뿐이다.
 * principal 은 로그인 응답 → `refresh()` → 토큰 claim 순으로 얻는다.
 */
export function createAuthSession({
  api,
  store,
  refreshStore,
  delivery = 'body',
  deviceName,
  refresher,
}: AuthSessionOptions): AuthSession {
  const listeners = new Set<() => void>()
  let known: { token: string; principal: AuthPrincipal | null } | null = null
  let state = compute()

  function compute(): AuthState {
    const token = store.get()
    if (!token) return { status: 'anonymous', token: null, principal: null }
    const principal = known?.token === token ? known.principal : decodeTokenPrincipal(token)
    return { status: 'authenticated', token, principal }
  }

  // 저장소를 둘 다 바꾸는 동안에는 알리지 않는다 — 한쪽만 바뀐 중간 상태(옛 토큰 + 새 principal)가 구독자에게 새면 계정이 잠깐 「모르는 사람」으로 보인다
  let batching = false
  function refreshState() {
    if (batching) return
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
  refreshStore?.subscribe(refreshState)

  function accept(response: AuthTokenResponse) {
    known = { token: response.accessToken, principal: response.principal }
    // 리프레시 자격을 먼저 — 액세스 토큰이 보이는 순간 갱신이 필요해도 새 자격이 있다
    batching = true
    try {
      refreshStore?.set({
        refreshToken: delivery === 'cookie' ? null : (response.refreshToken ?? null),
        refreshExpiresAt: response.refreshExpiresAt,
        sessionId: response.sessionId,
      })
      store.set(response.accessToken)
    } finally {
      batching = false
    }
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
    login: async (credentials) =>
      accept(await (deviceName ? api.login(credentials, { deviceName }) : api.login(credentials))),
    socialLogin: async (provider, authorizationCode, redirectUri) =>
      accept(await api.socialLogin(provider, authorizationCode, redirectUri)),
    magicLinkLogin: async (token) => accept(await api.magicLinkRedeem(token)),
    signIn: accept,
    async logout() {
      const refreshToken = refreshStore?.get()?.refreshToken ?? null
      const hadSession = store.get() !== null || refreshStore?.get() != null
      known = null
      batching = true
      try {
        refreshStore?.clear()
        store.clear()
      } finally {
        batching = false
      }
      refreshState()
      if (!hadSession) return
      try {
        await api.logout(refreshToken)
      } catch {
        // 이 기기는 이미 로그아웃했다 — 서버 폐기는 만료로도 끝난다
      }
    },
    async refresh() {
      const principal = await api.me()
      const token = store.get()
      if (token) known = { token, principal }
      refreshState()
      return principal
    },
    async restore() {
      if (store.get()) return
      const credentials = refreshStore?.get()
      const usable = delivery === 'cookie' ? credentials != null : !!credentials?.refreshToken
      if (!usable) return
      if (refresher) {
        // 락 · single-flight 안에서 한 번만 — 죽은 자격이면 갱신기가 두 저장소를 비운다
        await refresher.refresh()
        return
      }
      try {
        accept(await api.refresh(credentials?.refreshToken ?? null))
      } catch (error) {
        if (error instanceof ApiRequestError && error.apiError.status === 401) {
          refreshStore?.clear() // 죽은 자격을 매 로드마다 내밀지 않는다
          return
        }
        throw error
      }
    },
  }
}
