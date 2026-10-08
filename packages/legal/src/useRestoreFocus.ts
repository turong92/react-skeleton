import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * 막(전면 화면)이 열려 있는 동안 `open` 이 true 다. 열리는 순간 포커스가 있던 곳을 기억했다가 닫히면 돌려준다 - 막 안에서 제목으로 옮긴 포커스가 사라진 화면 때문에 문서 맨 앞(body)으로 날아가지 않게.
 * 기억은 막 안의 효과가 포커스를 옮기기 전(레이아웃 효과)에 하고, 되돌리는 것은 아래 화면의 `inert` 가 풀린 뒤(일반 효과)에 한다.
 * 닫힌 뒤에 포커스가 이미 다른 곳에 있거나 그 요소가 사라졌으면(화면을 떠났다) 건드리지 않는다
 */
export function useRestoreFocus(open: boolean) {
  const saved = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  useLayoutEffect(() => {
    if (!open || wasOpen.current) return
    const active = document.activeElement
    saved.current = active instanceof HTMLElement && active !== document.body ? active : null
  }, [open])
  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    const element = saved.current
    saved.current = null
    if (
      element?.isConnected &&
      (!document.activeElement || document.activeElement === document.body)
    )
      element.focus()
  }, [open])
}
