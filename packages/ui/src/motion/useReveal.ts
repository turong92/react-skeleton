import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { prefersReducedMotion } from './prefersReducedMotion'

export type RevealOptions = {
  /** 차례(0 부터) — 지연은 `index × staggerMs`. 여러 개를 차례로 보일 때 목록 번호를 준다 */
  index?: number
  /** 차례 사이 간격(ms, 기본 60) */
  staggerMs?: number
}

export type RevealProps<T extends HTMLElement> = {
  ref: RefObject<T | null>
  style: CSSProperties
}

/**
 * 화면에 들어올 때 한 번 나타난다(위로 올라오며 페이드, 0.3초 ease-out — 모양은 `base.css` 의 `[data-reveal]`).
 * 요소에 그대로 펼친다: `<li {...useReveal<HTMLLIElement>({ index })}>`. 움직임 줄이기 설정 · IntersectionObserver 가 없는 환경 ·
 * 서버 · 자바스크립트 전에는 처음부터 보인다(숨기는 것은 마운트 뒤에만 한다)
 */
export function useReveal<T extends HTMLElement = HTMLElement>({
  index = 0,
  staggerMs = 60,
}: RevealOptions = {}): RevealProps<T> {
  const ref = useRef<T>(null)

  // 숨김 · 보임은 React 가 그리는 속성이 아니라 요소에 직접 거는 속성이다 — 마운트 뒤에 숨기고, 들어오면 보인다
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    element.dataset.reveal = 'hidden'
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      element.dataset.reveal = 'shown'
      observer.disconnect()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { ref, style: { transitionDelay: `${index * staggerMs}ms` } }
}
