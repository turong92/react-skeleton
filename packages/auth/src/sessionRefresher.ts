import { ApiRequestError, ErrorCodes, type UnauthorizedContext } from '@skeleton/api-client'
import type { RefreshStore } from './refreshStore'
import type { TokenStore } from './tokenStore'
import type { AuthTokenResponse } from './types'

/** 세션이 끝난 이유 — 앱이 로그인 화면에서 한 줄로 알려 준다 */
export type SessionEndReason = 'expired' | 'reuse-detected' | 'suspended' | 'unauthenticated'

/** `navigator.locks` 의 필요한 부분 — 같은 출처의 탭들이 갱신을 한 줄로 세운다 */
export type LockManagerLike = {
  request<T>(name: string, run: () => Promise<T>): Promise<T>
}

export type SessionRefresherOptions = {
  tokens: TokenStore
  refreshTokens: RefreshStore
  /** `body`(기본 · 리프레시 토큰을 JS 가 쥔다) | `cookie`(HttpOnly 쿠키 · 백엔드 `skeleton.auth-session.delivery` 와 같아야 한다) */
  delivery: 'body' | 'cookie'
  /** `POST /auth/refresh` — body 모드는 토큰, cookie 모드는 null. `authApi.refresh` 를 늦게 잇는다(api 가 이 훅이 꽂힌 클라이언트를 쓰므로) */
  refresh: (refreshToken: string | null) => Promise<AuthTokenResponse>
  /** 갱신이 불가능해 로그아웃한 뒤에 한 번 */
  onSessionEnded?: (reason: SessionEndReason) => void
  /** 기본: 브라우저의 `navigator.locks`(있으면). `false` 면 탭 안 합치기만 한다 */
  locks?: LockManagerLike | false
  lockName?: string
}

export type SessionRefresher = {
  /**
   * 갱신 한 번(탭 안에서는 진행 중인 것 하나로 합친다). 이미 다른 요청 · 탭이 갱신했으면 서버를 부르지 않고 true.
   * 갱신할 수 없어 세션이 끝났으면 false, 네트워크 · 서버 오류는 던진다(세션은 그대로).
   */
  refresh(failedAuthorization?: string): Promise<boolean>
  /** `createApiClient({ recoverUnauthorized })` 에 꽂는다 */
  recover(context: UnauthorizedContext): Promise<boolean>
}

const DEFAULT_LOCK_NAME = 'skeleton.auth.refresh'

/**
 * 액세스 토큰 갱신 — 401 마다 세우지 않고 한 번으로 합치고(single-flight), 갱신이 돌려준 **새 리프레시 토큰을 먼저 저장**한 뒤
 * 새 액세스 토큰을 내보낸다(옛 리프레시 토큰은 두 번 다시 보내지 않는다 — 재사용은 서버가 세션 전체를 끊는다).
 * 여러 탭은 `navigator.locks` 로 줄 세우고, 락 안에서 저장소를 다시 읽어 이미 갱신됐으면 그 결과를 쓴다.
 * `AUTH.REFRESH_INVALID` · `REFRESH_REUSED` · `ACCOUNT_SUSPENDED` 이면 두 저장소를 비우고 `onSessionEnded` 를 부른다.
 */
export function createSessionRefresher(options: SessionRefresherOptions): SessionRefresher {
  const { tokens, refreshTokens, delivery, onSessionEnded } = options
  let inFlight: Promise<boolean> | null = null

  function end(reason: SessionEndReason): false {
    refreshTokens.clear()
    tokens.clear()
    onSessionEnded?.(reason)
    return false
  }

  async function run(failedToken: string | undefined): Promise<boolean> {
    // 락을 기다리는 사이 다른 탭이 갱신했을 수 있다 — 저장소를 다시 읽어 본다
    tokens.reload()
    refreshTokens.reload()
    const current = tokens.get()
    if (failedToken && current && current !== failedToken) return true
    const credentials = refreshTokens.get()
    const usable = delivery === 'cookie' ? credentials !== null : !!credentials?.refreshToken
    if (!usable) return end('unauthenticated')
    let response: AuthTokenResponse
    try {
      response = await options.refresh(credentials?.refreshToken ?? null)
    } catch (error) {
      if (error instanceof ApiRequestError) {
        const { status, code } = error.apiError
        if (code === ErrorCodes.AUTH_REFRESH_REUSED) return end('reuse-detected')
        if (code === ErrorCodes.AUTH_ACCOUNT_SUSPENDED) return end('suspended')
        if (status === 401) return end('expired')
      }
      throw error
    }
    // 응답을 기다리는 사이 로그아웃했거나(같은 탭 · 다른 탭) 다른 로그인으로 바뀌었다면 이 응답은 낡았다 — 세션을 되살리지 않는다
    tokens.reload()
    refreshTokens.reload()
    if (JSON.stringify(refreshTokens.get()) !== JSON.stringify(credentials)) return false
    // 회전: 새 리프레시 토큰이 먼저 — 그 사이 다른 요청이 새 액세스 토큰으로 갱신을 다시 걸어도 새 리프레시 토큰을 쓴다
    refreshTokens.set({
      refreshToken: delivery === 'cookie' ? null : (response.refreshToken ?? null),
      refreshExpiresAt: response.refreshExpiresAt,
      sessionId: response.sessionId ?? credentials?.sessionId,
    })
    tokens.set(response.accessToken)
    return true
  }

  function withLock<T>(task: () => Promise<T>): Promise<T> {
    const locks =
      options.locks === false
        ? undefined
        : (options.locks ??
          (typeof navigator !== 'undefined'
            ? (navigator as { locks?: LockManagerLike }).locks
            : undefined))
    return locks ? locks.request(options.lockName ?? DEFAULT_LOCK_NAME, task) : task()
  }

  function refresh(failedAuthorization?: string): Promise<boolean> {
    if (inFlight) return inFlight
    const failedToken = failedAuthorization?.replace(/^Bearer\s+/i, '')
    const flight = withLock(() => run(failedToken)).finally(() => {
      if (inFlight === flight) inFlight = null
    })
    inFlight = flight
    return flight
  }

  return {
    refresh,
    recover: ({ failedAuthorization }) => refresh(failedAuthorization),
  }
}
