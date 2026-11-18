import { useLayoutEffect } from 'react'

/** 뒤 페이지가 휠로 스크롤되지 않게 문서 스크롤을 잠근다 — 닫으면 연 때 값으로 되돌린다(모달일 때만 [active]) */
export function useScrollLock(active: boolean): void {
  useLayoutEffect(() => {
    if (!active) return
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = before
    }
  }, [active])
}
