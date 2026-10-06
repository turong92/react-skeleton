import type { TokenStorage } from '@skeleton/auth'

/**
 * 토큰을 어디에 둘지는 프로젝트가 정한다. 기본은 `localStorage` — 새로고침 · 탭 여러 개에서도 로그인이 유지되고,
 * 한 탭의 로그인 · 로그아웃 · 토큰 갱신이 다른 탭에 따라간다(`crossTab`, 갱신은 `navigator.locks` 로 한 줄).
 * 탭마다 따로 로그인하려면 `window.sessionStorage`(탭 복제가 같은 리프레시 토큰을 둘이 쥐게 되는 점에 주의), 메모리만 쓰려면 `undefined`.
 * 저장소 접근 자체가 막혀 있으면(시크릿 창 등) 메모리만 쓴다.
 */
export function browserTokenStorage(): TokenStorage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}
