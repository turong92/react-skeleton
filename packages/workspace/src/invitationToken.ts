/** `window` 의 필요한 부분 — 시험은 가짜를 준다 */
export type UrlHost = {
  location: { pathname: string; search: string; hash: string }
  history: { state: unknown; replaceState(state: unknown, title: string, url: string): void }
}

/** 탭 저장소(`sessionStorage`)의 필요한 부분 */
export type TokenStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type InvitationTokenStore = {
  read(): string | null
  write(token: string): void
  clear(): void
}

/** 탭 저장소의 칸 이름 */
export const INVITATION_TOKEN_STORAGE_KEY = 'skeleton.workspace.invitation'
export const INVITATION_TOKEN_PARAM = 'token'

/** 이 탭의 저장소 — 막혀 있으면(사생활 보호 창 등) 없는 것으로 */
export function browserSessionStorage(): TokenStorage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    return undefined
  }
}

/**
 * 초대 토큰을 이 탭에만 둔다 — 로그인 · 가입으로 다녀오는 동안 잃지 않게. 저장소가 없거나 던져도 읽기 · 쓰기가 터지지 않는다
 * (그러면 토큰은 이번 화면의 메모리에만 있고, 다녀오면 메일 링크를 다시 눌러야 한다)
 */
export function createInvitationTokenStore(
  storage: TokenStorage | undefined,
  key = INVITATION_TOKEN_STORAGE_KEY,
): InvitationTokenStore {
  return {
    read() {
      try {
        return storage?.getItem(key) || null
      } catch {
        return null
      }
    },
    write(token) {
      try {
        storage?.setItem(key, token)
      } catch {
        // 저장소가 막혔다 — 화면의 메모리에만 둔다
      }
    },
    clear() {
      try {
        storage?.removeItem(key)
      } catch {
        // 위와 같다
      }
    },
  }
}

function without(raw: string, prefix: '?' | '#'): { value: string; token: string | null } {
  const params = new URLSearchParams(raw.replace(/^[?#]/, ''))
  const token = params.get(INVITATION_TOKEN_PARAM)
  if (token === null) return { value: raw, token: null }
  params.delete(INVITATION_TOKEN_PARAM)
  const rest = params.toString()
  return { value: rest ? `${prefix}${rest}` : '', token }
}

/**
 * 주소의 `?token=` 을 읽어 이 탭 저장소로 옮기고 주소창 · 히스토리에서 지운다(`history.replaceState` — 어깨너머 · 뒤로 가기 · 공유로 새지 않게).
 * 주소에 없으면(로그인하고 돌아온 길) 저장소에서 읽는다. 서버(`window` 없음)에서는 아무것도 안 한다.
 * (`@skeleton/auth` 의 scrubUrlParams 와 같은 일이지만 패키지끼리 import 하지 않는다)
 */
export function takeInvitationToken(
  store: InvitationTokenStore,
  host: UrlHost | undefined = typeof window === 'undefined' ? undefined : window,
): string | null {
  if (!host) return store.read()
  const { pathname, search, hash } = host.location
  const fromSearch = without(search, '?')
  const fromHash = without(hash, '#')
  const token = fromSearch.token ?? fromHash.token
  if (token === null) return store.read()
  store.write(token)
  host.history.replaceState(
    host.history.state,
    '',
    `${pathname}${fromSearch.value}${fromHash.value}`,
  )
  return token
}

/** 이 탭에 아직 수락하지 않은 초대 토큰이 있는가 — 로그인 · 가입으로 다녀온 앱이 `/invite` 로 돌려보낼지 정한다 */
export function hasPendingInvitation(storage: TokenStorage | undefined = browserSessionStorage()) {
  return createInvitationTokenStore(storage).read() !== null
}
