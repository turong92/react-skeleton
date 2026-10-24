import { ApiRequestError } from '@skeleton/api-client'
import type { AuthApi, RefreshDelivery } from './authApi'
import { decodeTokenPrincipal } from './principal'
import type { RefreshStore } from './refreshStore'
import type { SessionRefresher } from './sessionRefresher'
import type { TokenStore } from './tokenStore'
import type {
  AuthPrincipal,
  AuthState,
  AuthTokenResponse,
  WirePrincipal,
  PasswordLoginRequest,
  SocialProof,
} from './types'

export type AuthSession = {
  /** 바뀌기 전까지 같은 객체를 돌려준다(`useSyncExternalStore` 용) */
  getState(): AuthState
  subscribe(listener: () => void): () => void
  login(credentials: PasswordLoginRequest): Promise<AuthTokenResponse>
  socialLogin(
    provider: string,
    authorizationCode: string,
    redirectUri?: string,
    proof?: SocialProof,
  ): Promise<AuthTokenResponse>
  /** 메일 링크(`/magic-link?token=`)의 토큰으로 로그인한다 */
  magicLinkLogin(token: string): Promise<AuthTokenResponse>
  /** 탈퇴 유예 중 로그인이 준 `restoreToken` 으로 탈퇴를 취소하고 로그인한다(`403 AUTH.ACCOUNT_DELETION_PENDING` 뒤) */
  cancelDeletion(restoreToken: string): Promise<AuthTokenResponse>
  /** 다른 흐름이 받은 토큰 응답을 이 세션에 들인다 */
  signIn(response: AuthTokenResponse): AuthTokenResponse
  /** 이 기기에서 먼저 로그아웃(저장소 비움 — 동기)한 뒤 서버에 세션 폐기를 알린다. 서버가 실패해도 로그아웃은 유지 */
  logout(): Promise<void>
  /** `GET /auth/me` 로 principal 을 다시 읽는다 */
  refresh(): Promise<AuthPrincipal>
  /** 권한을 받지 못해 멈춘 뒤(`permissionsFailed`) 다시 묻는다 */
  retryPermissions(): void
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
  // 권한은 로그인 · 갱신 응답과 `/auth/me` 가 준다(토큰 claim 에는 없다. 권한을 안 싣는 옛 서버의 응답도 있다). 이 토큰으로 이미 받았거나 묻는 중이면 다시 묻지 않는다
  let permissionsAskedFor: string | null = null
  /** 마지막으로 받은 권한 - 토큰이 갱신돼(갱신기 · 다른 탭이 저장소에 직접 쓴다) 같은 계정의 새 토큰이 오면 `/auth/me` 가 답할 때까지 이어 쓴다 */
  let lastPermissions: { accountId: string; permissions: string[] } | null = null
  let decoded: { token: string; principal: AuthPrincipal | null } | null = null
  let retry: {
    token: string
    attempts: number
    timer: ReturnType<typeof setTimeout> | null
  } | null = null
  /** 이 토큰의 권한을 받으려다 포기했다 - 화면이 「다시 시도」를 보인다 */
  let permissionsFailedFor: string | null = null
  let state = compute()

  function compute(): AuthState {
    const token = store.get()
    if (!token) return { status: 'anonymous', token: null, principal: null }
    const failed = permissionsFailedFor === token ? { permissionsFailed: true as const } : {}
    if (known?.token === token)
      return { status: 'authenticated', token, principal: known.principal, ...failed }
    if (decoded?.token !== token) {
      const claims = decodeTokenPrincipal(token)
      const carried =
        claims && lastPermissions?.accountId === claims.accountId
          ? lastPermissions.permissions
          : null
      decoded = { token, principal: claims && { ...claims, permissions: carried } }
    }
    return { status: 'authenticated', token, principal: decoded.principal, ...failed }
  }

  // 저장소를 둘 다 바꾸는 동안에는 알리지 않는다 — 한쪽만 바뀐 중간 상태(옛 토큰 + 새 principal)가 구독자에게 새면 계정이 잠깐 「모르는 사람」으로 보인다
  let batching = false
  function refreshState() {
    if (batching) return
    const next = compute()
    if (
      next.status === state.status &&
      next.token === state.token &&
      next.principal === state.principal &&
      next.permissionsFailed === state.permissionsFailed
    )
      return
    state = next
    listeners.forEach((listener) => listener())
    if (listeners.size > 0) completePermissions()
  }

  function withPermissions(principal: WirePrincipal, fallback: string[] | null): AuthPrincipal {
    return { ...principal, permissions: principal.permissions ?? fallback }
  }

  function remember(principal: AuthPrincipal) {
    if (principal.permissions)
      lastPermissions = { accountId: principal.accountId, permissions: principal.permissions }
  }

  const RETRY_ATTEMPTS = 3
  const RETRY_DELAY_MS = 2000

  function completePermissions() {
    const token = store.get()
    if (!token || permissionsAskedFor === token) return
    permissionsAskedFor = token
    Promise.resolve()
      .then(() => api.me())
      .then((principal) => {
        if (store.get() !== token) return
        const filled = withPermissions(principal, [])
        known = { token, principal: filled }
        remember(filled)
        retry = null
        permissionsFailedFor = null
        refreshState()
      })
      .catch(() => {
        // 화면을 숨기는 용도일 뿐이라 조용히 - 권한은 모르는(null) 채로 두고(차단 화면을 띄우지 않는다) 몇 번만 다시 묻는다
        if (store.get() !== token || permissionsAskedFor !== token) return
        permissionsAskedFor = null
        const attempts = (retry?.token === token ? retry.attempts : 0) + 1
        if (attempts >= RETRY_ATTEMPTS) {
          permissionsAskedFor = token // 더는 묻지 않는다 - 「다시 시도」 · 다음 갱신 · 로그인 · 새로고침이 다시 시작한다
          permissionsFailedFor = token
          refreshState()
          return
        }
        retry = {
          token,
          attempts,
          timer: setTimeout(() => {
            if (retry?.token === token) retry.timer = null
            completePermissions()
          }, RETRY_DELAY_MS * attempts),
        }
      })
  }

  store.subscribe(refreshState)
  refreshStore?.subscribe(refreshState)

  function accept(response: AuthTokenResponse) {
    // 응답에 권한이 있으면 그 값을 쓴다. 없으면(옛 서버) 같은 계정의 이전 값을 잠깐 이어 쓰고 `/auth/me` 로 다시 받는다 - 토큰이 갱신될 때마다 메뉴가 깜박이지 않게
    const carried =
      lastPermissions?.accountId === response.principal.accountId
        ? lastPermissions.permissions
        : null
    const principal = withPermissions(response.principal, carried)
    known = { token: response.accessToken, principal }
    remember(principal)
    permissionsAskedFor = response.principal.permissions ? response.accessToken : null
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
      completePermissions()
      return () => {
        listeners.delete(listener)
      }
    },
    login: async (credentials) =>
      accept(await (deviceName ? api.login(credentials, { deviceName }) : api.login(credentials))),
    socialLogin: async (provider, authorizationCode, redirectUri, proof) =>
      accept(
        await (proof
          ? api.socialLogin(provider, authorizationCode, redirectUri, proof)
          : api.socialLogin(provider, authorizationCode, redirectUri)),
      ),
    magicLinkLogin: async (token) =>
      accept(
        await (deviceName
          ? api.magicLinkRedeem(token, { deviceName })
          : api.magicLinkRedeem(token)),
      ),
    cancelDeletion: async (restoreToken) =>
      accept(
        await (deviceName
          ? api.cancelDeletion(restoreToken, { deviceName })
          : api.cancelDeletion(restoreToken)),
      ),
    signIn: accept,
    async logout() {
      const refreshToken = refreshStore?.get()?.refreshToken ?? null
      const hadSession = store.get() !== null || refreshStore?.get() != null
      known = null
      lastPermissions = null
      decoded = null
      permissionsAskedFor = null
      permissionsFailedFor = null
      if (retry?.timer) clearTimeout(retry.timer)
      retry = null
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
    retryPermissions() {
      if (retry?.timer) clearTimeout(retry.timer)
      retry = null
      permissionsFailedFor = null
      permissionsAskedFor = null
      refreshState()
      completePermissions()
    },
    async refresh() {
      const principal = withPermissions(await api.me(), [])
      const token = store.get()
      if (token) {
        known = { token, principal }
        remember(principal)
        permissionsAskedFor = token
      }
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
