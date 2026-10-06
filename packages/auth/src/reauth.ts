import { ApiRequestError, ErrorCodes } from '@skeleton/api-client'
import type { TokenStorage } from './tokenStore'

/*
 * 비밀번호 없는 계정(링크 · 소셜로만 가입)의 다시 인증 — 서버는 이메일 변경 · 첫 비밀번호 · 소셜 연결에 `confirmationToken` 을 요구한다
 * (없으면 403 `ACCOUNT.REAUTH_REQUIRED`, 틀리면 400 `ACCOUNT.REAUTH_FAILED`). 토큰은 `POST /account/reauth/confirmation` 이 계정 주소로 보내는
 * `/confirm-reauth?token=` 링크에 있다 — 링크를 열면 도착 화면이 토큰을 **하려던 작업**에 돌려준다. 메일을 다녀오는 동안 하려던 작업을
 * 탭의 sessionStorage 에 기억한다(새로고침에도 남고, 다른 탭 · 기기에는 새지 않는다). 새 비밀번호 같은 비밀은 저장하지 않는다.
 */

/** 다시 인증 뒤에 이어 갈 작업 — 폼이 다시 그릴 수 있는 것만(비밀 없음) */
export type PendingReauthAction =
  | { kind: 'email-change'; newEmail: string }
  | { kind: 'set-password' }
  | { kind: 'link-social'; provider: string }

export type ReauthStore = {
  remember(action: PendingReauthAction): void
  pending(): PendingReauthAction | null
  clearPending(): void
  /** 도착 화면이 받은 토큰을 보관한다 — 하려던 작업이 이 탭에 없었을 때(다른 탭 · 기기에서 연 링크) 다음 제출이 쓴다 */
  stashToken(token: string): void
  hasToken(): boolean
  /** 지우지 않고 본다 — 호출이 성공하기 전에 잃지 않도록(일시 오류면 다시 쓴다) */
  peekToken(): string | null
  /** 보관한 토큰을 지운다(한 번 쓰였거나 서버가 거절한 뒤) */
  clearToken(): void
  /** 한 번 꺼내면 지운다(토큰은 한 번만 쓰인다) — 호출이 끝나기 전에 잃어도 되는 곳에서만. 보통은 `peekToken` + `clearToken` */
  takeToken(): string | null
  /** 하려던 작업과 토큰을 모두 비운다(로그아웃) */
  clear(): void
  /**
   * 이 계정에 묶인 보기. 기록할 때 계정 id 를 함께 적고, 읽을 때 다른 계정이 적은 것은 버린다 —
   * 같은 탭에서 A 가 시작한 이메일 변경이 B 의 본인 확인 링크로 실행되지 않게.
   * `null` 은 로그인하지 않은 상태(그 상태에서 적은 것은 로그인한 뒤에는 읽히지 않는다)
   */
  forAccount(accountId: string | null | undefined): ReauthStore
}

export type ReauthStoreOptions = {
  /** 보통 `window.sessionStorage`. 없거나 막혀 있으면 메모리 */
  storage?: TokenStorage
  now?: () => number
  /** 링크 수명(서버 30분)보다 조금 짧게 — 기본 25분(토큰), 30분(작업) */
  tokenTtlMs?: number
  pendingTtlMs?: number
  /** 저장 키 접두어(기본 `skeleton.reauth.`) — 앱마다 다르게(`authStorageKeys(namespace).reauthPrefix`) */
  prefix?: string
}

type Stamped<T> = { value: T; at: number; accountId?: string | null }

export function createReauthStore({
  storage,
  now = Date.now,
  tokenTtlMs = 25 * 60_000,
  pendingTtlMs = 30 * 60_000,
  prefix = 'skeleton.reauth.',
}: ReauthStoreOptions = {}): ReauthStore {
  const memory = new Map<string, string>()

  function read(key: string): string | null {
    try {
      const value = storage?.getItem(prefix + key)
      if (value !== undefined && value !== null) return value
    } catch {
      // 저장소가 막혔다 — 메모리로
    }
    return memory.get(key) ?? null
  }
  function write(key: string, value: string) {
    memory.set(key, value)
    try {
      storage?.setItem(prefix + key, value)
    } catch {
      // 메모리에는 남았다
    }
  }
  function remove(key: string) {
    memory.delete(key)
    try {
      storage?.removeItem(prefix + key)
    } catch {
      // 괜찮다
    }
  }
  /** `account === undefined` 는 묶지 않은 보기(계정 검사 없음) */
  function readFresh<T>(key: string, ttl: number, account: string | null | undefined): T | null {
    const raw = read(key)
    if (!raw) return null
    try {
      const stamped = JSON.parse(raw) as Stamped<T>
      if (typeof stamped.at !== 'number' || now() - stamped.at > ttl) {
        remove(key)
        return null
      }
      if (account !== undefined && (stamped.accountId ?? null) !== account) {
        remove(key) // 다른 계정(또는 로그아웃 상태)이 적은 것 — 이 계정은 쓸 수 없고 남겨 둘 이유도 없다
        return null
      }
      return stamped.value
    } catch {
      return null
    }
  }

  function view(account: string | null | undefined): ReauthStore {
    const stamp = <T>(value: T) =>
      JSON.stringify({
        value,
        at: now(),
        ...(account === undefined ? {} : { accountId: account }),
      } satisfies Stamped<T>)
    const self: ReauthStore = {
      remember: (action) => write('pending', stamp(action)),
      pending: () => readFresh<PendingReauthAction>('pending', pendingTtlMs, account),
      clearPending: () => remove('pending'),
      stashToken: (token) => write('token', stamp(token)),
      hasToken: () => readFresh<string>('token', tokenTtlMs, account) !== null,
      peekToken: () => readFresh<string>('token', tokenTtlMs, account),
      clearToken: () => remove('token'),
      takeToken() {
        const token = readFresh<string>('token', tokenTtlMs, account)
        remove('token')
        return token
      },
      clear() {
        remove('pending')
        remove('token')
      },
      forAccount: (next) => view(next),
    }
    return self
  }
  return view(undefined)
}

export type SubmitWithReauthOptions<T> = {
  store: ReauthStore
  /** `accountApi.requestReauthConfirmation` — 계정 주소로 링크를 보낸다 */
  requestMail: () => Promise<unknown>
  /** 제출이 끝난 뒤 이어 갈 작업(링크를 열면 도착 화면이 이것을 본다) */
  action: PendingReauthAction
  /** 실제 호출 — 토큰이 있으면 `confirmationToken` 을 받는다 */
  run: (reauth: { confirmationToken?: string }) => Promise<T>
}

export type SubmitWithReauthResult<T> = { status: 'done'; value: T } | { status: 'mail-sent' }

const isReauthFailure = (error: unknown, sentToken: boolean) =>
  error instanceof ApiRequestError &&
  (error.apiError.code === ErrorCodes.ACCOUNT_REAUTH_REQUIRED ||
    (sentToken && error.apiError.code === ErrorCodes.ACCOUNT_REAUTH_FAILED))

/**
 * 비밀번호 없는 계정의 민감한 작업 한 번 — 보관한 토큰이 있으면 실어 보내고, 서버가 다시 인증을 요구하면(`REAUTH_REQUIRED`, 또는 보낸 토큰이
 * 낡아 `REAUTH_FAILED`) 하려던 작업을 기억하고 확인 메일을 요청한다. 그 밖의 실패는 그대로 던진다(429 포함 — 화면이 기다릴 시간을 보인다).
 */
export async function submitWithReauth<T>({
  store,
  requestMail,
  action,
  run,
}: SubmitWithReauthOptions<T>): Promise<SubmitWithReauthResult<T>> {
  const token = store.peekToken()
  try {
    const value = await run(token ? { confirmationToken: token } : {})
    if (token) store.clearToken() // 한 번 쓰였다
    return { status: 'done', value }
  } catch (error) {
    if (!isReauthFailure(error, token !== null)) throw error // 일시 오류면 토큰은 그대로 — 다시 시도할 수 있다
    if (token) store.clearToken() // 서버가 거절한 토큰은 낡았다
    store.remember(action)
    await requestMail()
    return { status: 'mail-sent' }
  }
}
