import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** 사용자가 움직임 줄이기를 켰는가. 서버 · `matchMedia` 가 없는 환경은 false */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false
}

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** 움직임 줄이기 설정을 따라가는 값(설정이 바뀌면 다시 그린다). 서버에서는 false */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false)
}
