/** 로그인 뒤 돌아갈 곳을 다루는 도우미 — 같은 출처의 경로만 믿는다(열린 리다이렉트 방지) */

const AUTH_PREFIXES = [
  '/login',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/magic-link',
  '/auth/callback',
]

export function locationPath(location: {
  pathname: string
  search?: string
  hash?: string
}): string {
  return `${location.pathname}${location.search ?? ''}${location.hash ?? ''}`
}

/**
 * 같은 출처의 경로만 통과(아니면 `fallback`). 제어 문자(탭 · 줄바꿈 · NUL …)와 역슬래시는 URL 파서가 지우거나 `/` 로 바꿔
 * `/\t/evil.example` 이 `//evil.example` 이 되므로 처음부터 거절하고, 그 뒤에도 실제로 URL 로 풀어 출처가 같은지 확인한다.
 */
export function safeReturnPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value === '') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  // eslint-disable-next-line no-control-regex -- 제어 문자를 막는 것이 목적이다
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback
  try {
    const base = 'https://same-origin.invalid'
    if (new URL(value, base).origin !== base) return fallback
  } catch {
    return fallback
  }
  return value
}

/**
 * `RequireAuth` 가 `location.state.from` 에 담아 보낸 곳 → 로그인 뒤 갈 경로. 없거나 이상하면 `fallback`.
 * 로그인 · 가입 같은 인증 화면 자신으로는 돌려보내지 않는다(되돌아오는 고리 방지).
 */
export function postSignInTarget(
  state: unknown,
  fallback = '/',
  authPrefixes: readonly string[] = AUTH_PREFIXES,
): string {
  const from = (state as { from?: unknown } | null)?.from
  if (
    typeof from !== 'object' ||
    from === null ||
    typeof (from as { pathname?: unknown }).pathname !== 'string'
  )
    return fallback
  const location = from as { pathname: string; search?: string; hash?: string }
  if (
    authPrefixes.some(
      (prefix) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
    )
  )
    return fallback
  return safeReturnPath(locationPath(location), fallback)
}

type SessionStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const RETURN_KEY = 'skeleton.returnTo'

/** 사이트를 벗어나는 흐름(소셜 로그인)을 시작하기 전에 돌아올 곳을 적어 둔다 — 저장소가 막혀도 조용히 넘어간다 */
export function rememberReturnTo(path: string, storage?: SessionStorageLike): void {
  try {
    ;(storage ?? sessionStorage).setItem(RETURN_KEY, safeReturnPath(path))
  } catch {
    // 못 적어도 로그인은 된다 — 기본 위치로 간다
  }
}

/** `rememberReturnTo` 로 적은 곳을 한 번 읽고 지운다 */
export function consumeReturnTo(fallback = '/', storage?: SessionStorageLike): string {
  try {
    const store = storage ?? sessionStorage
    const value = store.getItem(RETURN_KEY)
    store.removeItem(RETURN_KEY)
    return safeReturnPath(value, fallback)
  } catch {
    return fallback
  }
}
