import type { TokenStorage } from '@skeleton/auth'

/**
 * 토큰을 어디에 둘지는 프로젝트가 정한다. 기본은 이 탭이 닫히면 사라지는 sessionStorage —
 * 새로고침해도 로그인이 유지된다. 메모리만 쓰려면 `undefined`, 오래 두려면 `window.localStorage`.
 * 저장소 접근 자체가 막혀 있으면(시크릿 창 등) 메모리만 쓴다.
 */
export function browserTokenStorage(): TokenStorage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}
