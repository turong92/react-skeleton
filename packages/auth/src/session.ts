import { ApiRequestError } from '@skeleton/api-client'
import type { AuthApi, RefreshDelivery } from './authApi'
import type { MfaVerifyInput } from './mfa/types'
import { decodeTokenPrincipal } from './principal'
import type { RefreshStore } from './refreshStore'
import { isRetryableRefreshError, type SessionRefresher } from './sessionRefresher'
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
  /** 2단계 인증을 켠 계정의 두 번째 단계 - 1단계가 준 `mfaToken` 과 코드(또는 복구 코드)로 로그인한다(`403 AUTH.MFA_REQUIRED` 뒤) */
  mfaLogin(input: { mfaToken: string } & MfaVerifyInput): Promise<AuthTokenResponse>
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
  /** `restore()` 가 갱신 자격은 있는데 일시 오류로 결과를 못 얻었다 - 상태는 `reconnecting`, 잠시 뒤 스스로 다시 시도한다 */
  let reconnecting = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  function hasUsableCredentials(): boolean {
    const credentials = refreshStore?.get()
    return delivery === 'cookie' ? credentials != null : !!credentials?.refreshToken
  }
  let reconnectAttempts = 0
  let state = compute()

  function compute(): AuthState {
    const token = store.get()
    if (!token) {
      // 「연결 중」은 쓸 수 있는 갱신 자격이 있을 때만 - 자격이 사라졌으면(다른 탭의 로그아웃 · 확정 로그아웃) 비로그인이다
      const waiting = reconnecting && hasUsableCredentials()
      return { status: waiting ? 'reconnecting' : 'anonymous', token: null, principal: null }
    }
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
  function setReconnecting(value: boolean) {
    reconnecting = value
    if (!value) {
      reconnectAttempts = 0
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    refreshState()
  }

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

  const RECONNECT_DELAY_MS = 15_000
  const FIRST_ATTEMPT_WAIT_MS = 3_000
  const MAX_RECONNECT_DELAY_MS = 30_000 // 재시도 간격은 서버 reuse-grace 의 절반(30초)을 넘지 않는다 - sessionRefresher.ts 의 불변식
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
    reconnecting = false
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

  /** 일시 오류(또는 회전 한도)면 「연결 중」으로 두고 점점 뜸하게 다시 시도한다 - 그 밖의 실패(설정 오류 등)는 예전처럼 비로그인 */
  function scheduleReconnect(error: unknown) {
    if (!isRetryableRefreshError(error) || !hasUsableCredentials()) return setReconnecting(false)
    setReconnecting(true)
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, RECONNECT_DELAY_MS * 2 ** reconnectAttempts)
    reconnectAttempts += 1
    reconnectTimer ??= setTimeout(() => {
      reconnectTimer = null
      void restore().catch(() => undefined)
    }, delay)
  }

  async function restore(): Promise<void> {
    if (store.get()) {
      if (reconnecting) setReconnecting(false)
      return
    }
    const credentials = refreshStore?.get()
    if (!hasUsableCredentials()) return setReconnecting(false)
    try {
      if (refresher) {
        // 락 · single-flight 안에서 한 번만 — 죽은 자격이면 갱신기가 두 저장소를 비운다.
        // 첫 시도가 일시 오류면 백오프(약 60초)를 기다리지 않고 「연결 중」으로 넘어간다 - 재시도는 뒤에서 계속되어 성공하면 로그인, 확정 로그아웃이면 로그아웃이 된다
        let early = false
        let resolveEarly: () => void = () => undefined
        const gate = new Promise<void>((resolve) => (resolveEarly = resolve))
        const goEarly = () => {
          early = true
          setReconnecting(true)
          resolveEarly()
        }
        const flight = refresher.refresh(undefined, { onTransient: goEarly })
        // 첫 시도가 오래 걸려도(콜드 스타트) 화면을 비워 두지 않는다 - 그 시도는 단일 비행 그대로 뒤에서 이어진다
        const slow = setTimeout(goEarly, FIRST_ATTEMPT_WAIT_MS)
        try {
          await Promise.race([flight.then(() => undefined), gate])
        } finally {
          clearTimeout(slow)
        }
        if (early) {
          flight.then(() => setReconnecting(false), scheduleReconnect)
          return
        }
      } else {
        try {
          accept(await api.refresh(credentials?.refreshToken ?? null))
        } catch (error) {
          if (error instanceof ApiRequestError && error.apiError.status === 401) {
            refreshStore?.clear() // 죽은 자격을 매 로드마다 내밀지 않는다
            return setReconnecting(false)
          }
          throw error
        }
      }
      setReconnecting(false)
    } catch (error) {
      // 일시 오류: 자격은 그대로 - 로그인 화면으로 보내지 않고 잠시 뒤 다시 시도한다
      scheduleReconnect(error)
      throw error
    }
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
    mfaLogin: async (input) =>
      accept(await (deviceName ? api.mfaVerify(input, { deviceName }) : api.mfaVerify(input))),
    signIn: accept,
    async logout() {
      setReconnecting(false)
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
    restore,
  }
}
