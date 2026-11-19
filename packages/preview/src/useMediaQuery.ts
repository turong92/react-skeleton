import { useSyncExternalStore } from 'react'

/** 넓은 결 — 막대 · 위아래 안내 줄(CSS `@media (min-width: 1024px)` 와 같은 값) */
export const WIDE_QUERY = '(min-width: 1024px)'
/** 폰 폭 — CSS 의 `@media (max-width: 720px)` 와 같은 값. JS 로 폰을 가를 때는 이 상수만 쓴다 */
export const PHONE_QUERY = '(max-width: 720px)'
/** 폰 가로 — 폭은 넓어도 높이가 낮아(≤500) 주소창이 세로를 다 먹는 화면. 태블릿은 가로여도 500 보다 높아 여기 들지 않는다 */
export const SHORT_LANDSCAPE_QUERY = '(orientation: landscape) and (max-height: 500px)'
/** 굵은 포인터(터치) */
export const COARSE_QUERY = '(pointer: coarse)'

const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/** CSS 미디어 질의가 맞는지 — 폭이 바뀌면 다시 그린다. 서버 · `matchMedia` 가 없으면 늘 false */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!hasMatchMedia()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => hasMatchMedia() && window.matchMedia(query).matches,
    () => false,
  )
}
