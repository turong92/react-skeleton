import { authStorageKeys, type RefreshDelivery, type SignInMethodsConfig } from '@skeleton/auth'

/*
 * 이 앱의 로그인 설정.
 *
 * 로그인 방법(비밀번호 · 링크 · 소셜)은 **백엔드가 알려 준다** — 앱은 `GET /auth/methods` 를 물어 그대로 따른다(로딩 · 실패 대체 화면 포함).
 * 환경변수는 선택적 덮어쓰기일 뿐이다:
 *   VITE_AUTH_METHODS             쉼표 목록: `password` · `magic-link`(`magic_link` 도 된다) · 소셜 제공자 코드(`google` · `kakao` · `naver`). 있으면 백엔드에 묻지 않고 이것을 쓴다
 *   VITE_SOCIAL_<제공자>_CLIENT_ID  백엔드가 clientId 를 알려 주지 않는 제공자에 앱이 주는 공개 값(예 `VITE_SOCIAL_GOOGLE_CLIENT_ID`)
 *   VITE_AUTH_REFRESH_DELIVERY    `body`(기본) | `cookie` — 백엔드 `skeleton.auth-session.delivery` 와 같아야 한다(다르면 개발 콘솔에 경고)
 * `new-project.sh --auth-methods a,b` 는 아래 `DEFAULT_AUTH_METHODS` 를 그 목록으로 고정한다(환경변수가 여전히 이긴다).
 */

/**
 * 저장 키 · 락 · 채널 이름의 접두어 — 같은 출처에 앱 둘을 경로로 나눠 올려도 토큰이 섞이지 않게 앱마다 다르다.
 * `new-project.sh` 가 새 프로젝트 이름으로 바꾼다. 바꾸면 이 앱의 로그인 상태는 한 번 풀린다(옛 키 `skeleton.*` 는 쓰이지 않는다 — CHANGELOG)
 */
export const AUTH_NAMESPACE = 'starter-ssr'
export const authKeys = authStorageKeys(AUTH_NAMESPACE)

/** 비어 있으면 백엔드에 묻는다. 목록(`password,magic-link,google`)을 적으면 그 방법으로 고정 — `new-project.sh --auth-methods` 가 이 줄을 쓴다 */
export const DEFAULT_AUTH_METHODS = ''

/**
 * 토큰 전달 방식 — **한 줄 스위치**. `'body'`(기본): 리프레시 토큰을 JS 가 쥐고 `localStorage` 에 둔다(탭 여러 개 · 새로고침에서 로그인 유지).
 * `'cookie'`: 리프레시 토큰이 HttpOnly 쿠키로만 오가 스크립트가 못 읽는다(XSS 에 강함) — 백엔드를 `skeleton.auth-session.delivery=cookie` 로 짝지우고,
 * 프런트 · API 가 같은 사이트여야 한다(`SameSite=Strict`; 개발은 Vite 프록시). 환경변수 `VITE_AUTH_REFRESH_DELIVERY` 가 있으면 그것이 이긴다.
 */
export const DEFAULT_REFRESH_DELIVERY: RefreshDelivery = 'body'

const isMagicLink = (item: string) => item === 'magic-link' || item === 'magic_link'

/** 환경변수 목록 → 방법 설정. 비어 있으면 undefined(= 백엔드에 묻는다) */
export function parseAuthMethods(value: unknown): SignInMethodsConfig | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const list = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return {
    password: list.includes('password'),
    // 백엔드가 쓰는 철자(`magic_link`)와 이 앱의 철자(`magic-link`) 둘 다 — 아니면 소셜 제공자로 읽혀 방법이 하나도 없는 화면이 된다
    magicLink: list.some(isMagicLink),
    social: list
      .filter((item) => item !== 'password' && !isMagicLink(item))
      .map((provider) => ({ provider })),
  }
}

export function parseDelivery(value: unknown): RefreshDelivery {
  if (value === 'cookie' || value === 'body') return value
  return DEFAULT_REFRESH_DELIVERY
}

/** 덮어쓰기(환경변수 → 고정 목록). undefined 면 백엔드가 말하는 대로 */
export const authMethodsOverride = parseAuthMethods(
  import.meta.env.VITE_AUTH_METHODS || DEFAULT_AUTH_METHODS,
)
export const refreshDelivery = parseDelivery(import.meta.env.VITE_AUTH_REFRESH_DELIVERY)

/** 앱이 주는 소셜 clientId — `VITE_SOCIAL_<제공자>_CLIENT_ID` 가 있는 제공자만 */
export function socialClientIds(env: Record<string, unknown>): Record<string, string> {
  const ids: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    const found = /^VITE_SOCIAL_([A-Z0-9]+)_CLIENT_ID$/.exec(key)
    if (found && typeof value === 'string' && value) ids[found[1].toLowerCase()] = value
  }
  return ids
}

/** 덮어쓰기 목록에 든 소셜 제공자 설정(clientId 가 있는 것만) — 콜백 주소는 이 앱의 `/auth/callback` · `/account/link-callback` */
export function socialProviderConfigs(env: Record<string, unknown>, origin: string) {
  const providers: Record<string, { clientId: string; redirectUri: string }> = {}
  for (const { provider } of parseAuthMethods(env.VITE_AUTH_METHODS || DEFAULT_AUTH_METHODS)
    ?.social ?? []) {
    const clientId = env[`VITE_SOCIAL_${provider.toUpperCase()}_CLIENT_ID`]
    if (typeof clientId === 'string' && clientId)
      providers[provider] = { clientId, redirectUri: `${origin}/auth/callback` }
  }
  return providers
}
