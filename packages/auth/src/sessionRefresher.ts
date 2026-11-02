import {
  ApiRequestError,
  ClientErrorCodes,
  ErrorCodes,
  retryAfterSeconds,
  type UnauthorizedContext,
} from '@skeleton/api-client'
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
  /** 지금 시각(밀리초) — 기본 `Date.now`. 백오프 시계를 시험에서 돌릴 때 */
  now?: () => number
}

/** `onTransient`: 일시 오류로 첫 시도가 실패해 백오프로 들어갈 때 한 번 - 호출자가 기다리지 않고 「연결 중」으로 넘어가게 한다 */
export type RefreshHooks = { onTransient?: () => void }

export type SessionRefresher = {
  /**
   * 갱신 한 번(탭 안에서는 진행 중인 것 하나로 합친다). 이미 다른 요청 · 탭이 갱신했으면 서버를 부르지 않고 true.
   * 갱신할 수 없어 세션이 끝났으면 false, 네트워크 · 서버 오류는 던진다(세션은 그대로).
   */
  refresh(failedAuthorization?: string, hooks?: RefreshHooks): Promise<boolean>
  /** `createApiClient({ recoverUnauthorized })` 에 꽂는다 */
  recover(context: UnauthorizedContext): Promise<boolean>
}

/**
 * 서버가 응답을 못 줬거나(네트워크 · 타임아웃 · 408 · 429 · 5xx) 백엔드가 만들지 않은 401(프록시 등, `AUTH.*` 코드가 없다) — 세션에 대한 판정이 아니다.
 * `AUTH.*` 의 401 은 서버의 확정이다. 코드 없는 401 은 연달아 5번까지만 일시 오류이고, 그 뒤에도 401 이면 로그아웃이다.
 */
function isTransient(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false
  const { status, code } = error.apiError
  if (code === ErrorCodes.AUTH_TOO_MANY_REFRESHES) return false
  return (
    status === 0 ||
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    (status === 401 && !code.startsWith('AUTH.'))
  )
}

/** 나중에 다시 해 볼 만한 실패인가 - 일시 오류이거나 회전 한도(429 `AUTH.TOO_MANY_REFRESHES`) */
export function isRetryableRefreshError(error: unknown): boolean {
  return (
    isTransient(error) ||
    (error instanceof ApiRequestError && error.apiError.code === ErrorCodes.AUTH_TOO_MANY_REFRESHES)
  )
}

const DEFAULT_LOCK_NAME = 'skeleton.auth.refresh'
/** `429 AUTH.TOO_MANY_REFRESHES` 뒤의 기다림 — `Retry-After` 가 없으면 30초, 연속이면 두 배씩, 10분을 넘지 않는다 */
const DEFAULT_BACKOFF_SECONDS = 30
const MAX_BACKOFF_SECONDS = 600
/**
 * 일시 오류의 재시도 간격 - **같은 토큰으로 일시 오류가 이어지는 동안 계속** 보낸다. 간격은 2·4·8·16·30초, 그 뒤 30초 고정.
 * 불변식: **재시도 간격 ≤ 서버 `reuse-grace` ÷ 2** (권장 grace 60초 → 30초). 서버의 유예 시계는 서버가 깨어나 회전을 처리한 순간부터 도므로,
 * 서버가 기동에 몇 초(몇 분)가 걸리든 회전 뒤 다음 재시도는 반드시 유예 안에 들어온다. 간격을 30초 위로 올리거나 재시도를 시간으로 끊지 않는다.
 */
const TRANSIENT_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000]
const MAX_RETRY_INTERVAL_MS = 30_000
/** 코드 없는 401 이 이만큼 연달아 오면(다른 오류 없이) 프록시가 아니라 서버의 답으로 보고 로그아웃한다 */
/** 일반 요청이 갱신 비행을 기다리는 상한 - 갱신 요청 타임아웃(45초)과 같다 */
const REQUEST_WAIT_LIMIT_MS = 45_000
const MAX_CODELESS_401_IN_A_ROW = 5

/**
 * 액세스 토큰 갱신 — 401 마다 세우지 않고 한 번으로 합치고(single-flight), 갱신이 돌려준 **새 리프레시 토큰을 먼저 저장**한 뒤
 * 새 액세스 토큰을 내보낸다(옛 리프레시 토큰은 두 번 다시 보내지 않는다 — 재사용은 서버가 세션 전체를 끊는다).
 * 여러 탭은 `navigator.locks` 로 줄 세우고, 락 안에서 저장소를 다시 읽어 이미 갱신됐으면 그 결과를 쓴다.
 * `AUTH.REFRESH_INVALID` · `REFRESH_REUSED` · `ACCOUNT_SUSPENDED` 이면 두 저장소를 비우고 `onSessionEnded` 를 부른다.
 * **일시 오류**(네트워크 · 타임아웃 · 408 · 429 · 5xx · `AUTH.*` 코드 없는 401)는 서버가 회전에 성공했는데 응답만 잃었을 수 있다 — **같은 토큰으로** 지수 백오프(일시 오류가 이어지는 동안 계속, 간격 30초 상한)로 다시 보낸다
 * (서버의 `reuse-grace` 가 같은 후속 토큰을 돌려준다). 대기는 탭 락 밖에서 하고 시도마다 락을 다시 잡으며, 숨은 탭은 멈췄다가 보이면 곧바로 이어 간다.
 * **코드 없는 401 이 연달아 5번이면 로그아웃**한다(앞단이 백엔드 오류 본문을 그대로 넘겨야 한다).
 * `429 AUTH.TOO_MANY_REFRESHES`(세션이 10분에 30번 넘게 회전)는 **세션이 멀쩡하다** — 로그아웃하지 않고 그 429 를 일시 오류로 내보낸 뒤,
 * 기다릴 시간(`Retry-After`, 연속이면 두 배씩 · 최대 10분)이 지나기 전에는 서버를 다시 부르지 않고 같은 오류를 돌려준다.
 */
export function createSessionRefresher(options: SessionRefresherOptions): SessionRefresher {
  const { tokens, refreshTokens, delivery, onSessionEnded } = options
  const now = options.now ?? Date.now
  let inFlight: Promise<boolean> | null = null
  const transientHooks = new Set<() => void>()
  /** 백오프 중이면 그때까지 · 마지막 429 · 연속 횟수 */
  let backoff: { until: number; error: ApiRequestError; streak: number } | null = null

  function end(reason: SessionEndReason): false {
    backoff = null
    refreshTokens.clear()
    tokens.clear()
    onSessionEnded?.(reason)
    return false
  }

  type Attempt = { done: boolean } | { error: unknown; sent: string }

  async function run(failedToken: string | undefined): Promise<boolean> {
    let first: string | null = null // 첫 시도에 쓴 자격 - 이 자격이 바뀌면 더 보내지 않는다
    let codeless401 = 0
    for (let attempt = 0; ; attempt += 1) {
      const result = await withLock<Attempt>(() => once(failedToken, attempt === 0, first))
      if ('done' in result) return result.done
      first ??= result.sent
      const { error } = result
      codeless401 =
        isTransient(error) && (error as ApiRequestError).apiError.status === 401
          ? codeless401 + 1
          : 0
      if (!isTransient(error) || codeless401 >= MAX_CODELESS_401_IN_A_ROW)
        return settleFailure(error)
      transientHooks.forEach((hook) => hook())
      transientHooks.clear()
      const wait = TRANSIENT_RETRY_DELAYS_MS[attempt] ?? MAX_RETRY_INTERVAL_MS
      await new Promise((resolve) => setTimeout(resolve, wait)) // 락 밖에서 쉰다
      await untilVisible() // 숨은 탭은 멈췄다가 보이면 곧바로 이어 간다
    }
  }

  function untilVisible(): Promise<void> {
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const onChange = () => {
        if (document.visibilityState === 'hidden') return
        document.removeEventListener('visibilitychange', onChange)
        resolve()
      }
      document.addEventListener('visibilitychange', onChange)
    })
  }

  /** 락 안에서 서버를 한 번 부른다 */
  async function once(
    failedToken: string | undefined,
    isFirst: boolean,
    sentWith: string | null,
  ): Promise<Attempt> {
    // 락을 기다리는 사이 다른 탭이 갱신했을 수 있다 — 저장소를 다시 읽어 본다
    tokens.reload()
    refreshTokens.reload()
    const credentials = refreshTokens.get()
    if (isFirst) {
      const current = tokens.get()
      if (failedToken && current && current !== failedToken) return { done: true }
    } else if (JSON.stringify(credentials) !== sentWith) {
      // 기다리는 사이 로그아웃했거나 다른 탭이 갱신했다 - 더 보내지 않는다
      return { done: tokens.get() !== null }
    }
    const usable = delivery === 'cookie' ? credentials !== null : !!credentials?.refreshToken
    if (!usable) return { done: end('unauthenticated') }
    let response: AuthTokenResponse
    try {
      response = await options.refresh(credentials?.refreshToken ?? null)
    } catch (error) {
      return { error, sent: JSON.stringify(credentials) }
    }
    // 응답을 기다리는 사이 로그아웃했거나(같은 탭 · 다른 탭) 다른 로그인으로 바뀌었다면 이 응답은 낡았다 — 세션을 되살리지 않는다
    tokens.reload()
    refreshTokens.reload()
    if (JSON.stringify(refreshTokens.get()) !== JSON.stringify(credentials)) return { done: false }
    // 회전: 새 리프레시 토큰이 먼저 — 그 사이 다른 요청이 새 액세스 토큰으로 갱신을 다시 걸어도 새 리프레시 토큰을 쓴다
    refreshTokens.set({
      refreshToken: delivery === 'cookie' ? null : (response.refreshToken ?? null),
      refreshExpiresAt: response.refreshExpiresAt,
      sessionId: response.sessionId ?? credentials?.sessionId,
    })
    tokens.set(response.accessToken)
    backoff = null
    return { done: true }
  }

  /** 재시도할 수 없는 실패 - 서버가 세션을 닫았다고 말했거나 코드 없는 401 이 계속되면 로그아웃, 아니면 던진다(세션은 그대로) */
  function settleFailure(error: unknown): false {
    if (error instanceof ApiRequestError) {
      const { code, status } = error.apiError
      if (code === ErrorCodes.AUTH_REFRESH_REUSED) return end('reuse-detected')
      if (code === ErrorCodes.AUTH_ACCOUNT_SUSPENDED) return end('suspended')
      if (code === ErrorCodes.AUTH_REFRESH_INVALID || status === 401) return end('expired')
      const streak = (backoff?.streak ?? 0) + 1
      if (code === ErrorCodes.AUTH_TOO_MANY_REFRESHES) {
        const asked = retryAfterSeconds(error) ?? DEFAULT_BACKOFF_SECONDS
        const wait = Math.min(MAX_BACKOFF_SECONDS, Math.max(1, asked) * 2 ** (streak - 1))
        backoff = { until: now() + wait * 1000, error, streak }
      }
    }
    throw error
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

  function refresh(failedAuthorization?: string, hooks?: RefreshHooks): Promise<boolean> {
    if (inFlight) {
      if (hooks?.onTransient) transientHooks.add(hooks.onTransient)
      return inFlight
    }
    if (backoff && now() < backoff.until) return Promise.reject(backoff.error)
    if (hooks?.onTransient) transientHooks.add(hooks.onTransient)
    const failedToken = failedAuthorization?.replace(/^Bearer\s+/i, '')
    const flight = run(failedToken).finally(() => {
      if (inFlight === flight) inFlight = null
      transientHooks.clear()
    })
    inFlight = flight
    return flight
  }

  /** 갱신 비행에 붙은 일반 요청은 최대 45초(갱신 타임아웃과 같게)만 기다린다 - 그 뒤엔 일시 오류로 실패해 화면이 오류 · 다시 시도를 보이게 한다. 비행 자체는 뒤에서 계속된다 */
  function withWaitLimit(flight: Promise<boolean>): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new ApiRequestError(
              {
                code: ClientErrorCodes.NETWORK_ERROR,
                title: 'Session refresh is taking too long',
                status: 0,
                timestamp: new Date().toISOString(),
              },
              'refresh-wait',
              'refresh-wait',
              'refresh-wait',
            ),
          ),
        REQUEST_WAIT_LIMIT_MS,
      )
      flight.then(resolve, reject).finally(() => clearTimeout(timer))
    })
  }

  return {
    refresh,
    recover: ({ failedAuthorization }) => withWaitLimit(refresh(failedAuthorization)),
  }
}
