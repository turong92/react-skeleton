import type { RefreshDelivery, SignInMethodsConfig } from '@skeleton/auth'

/**
 * 이 앱이 켠 로그인 방법 · 리프레시 전달 방식 — 환경변수 한 곳에서 정한다(켜고 끄는 일이 코드 수정이 아니다).
 *   VITE_AUTH_METHODS             쉼표 목록: `password` · `magic-link` · 소셜 제공자 코드(`google` · `kakao` · `naver`). 기본 `password,magic-link`
 *   VITE_SOCIAL_<제공자>_CLIENT_ID  소셜 제공자의 clientId(예 `VITE_SOCIAL_GOOGLE_CLIENT_ID`) — 있어야 그 제공자의 버튼이 의미를 가진다
 *   VITE_AUTH_REFRESH_DELIVERY    `body`(기본) | `cookie` — 백엔드 `skeleton.auth-session.delivery` 와 같아야 한다
 * 백엔드는 같은 방법의 모듈 · 설정(auth-magic-link · auth-social-*)을 켜 두어야 한다.
 */
export function parseAuthMethods(value: unknown): SignInMethodsConfig {
  const list = (typeof value === 'string' && value.trim() ? value : 'password,magic-link')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return {
    password: list.includes('password'),
    magicLink: list.includes('magic-link'),
    social: list
      .filter((item) => item !== 'password' && item !== 'magic-link')
      .map((provider) => ({ provider })),
  }
}

export function parseDelivery(value: unknown): RefreshDelivery {
  return value === 'cookie' ? 'cookie' : 'body'
}

export const authMethods = parseAuthMethods(import.meta.env.VITE_AUTH_METHODS)
export const refreshDelivery = parseDelivery(import.meta.env.VITE_AUTH_REFRESH_DELIVERY)

/** 소셜 제공자 설정(clientId 가 있는 것만) — 콜백 주소는 이 앱의 `/auth/callback` · `/account/link-callback` */
export function socialProviderConfigs(env: Record<string, unknown>, origin: string) {
  const providers: Record<string, { clientId: string; redirectUri: string }> = {}
  for (const { provider } of parseAuthMethods(env.VITE_AUTH_METHODS).social ?? []) {
    const clientId = env[`VITE_SOCIAL_${provider.toUpperCase()}_CLIENT_ID`]
    if (typeof clientId === 'string' && clientId)
      providers[provider] = { clientId, redirectUri: `${origin}/auth/callback` }
  }
  return providers
}
