import { useCallback, useSyncExternalStore, type RefObject } from 'react'
import type { PreviewFrameBridge } from './source'

const unsubscribeNothing = () => undefined

/*
 * 다리 → React 상태. 다리가 없거나(직접 렌더) 그 멤버가 없으면 null / false 이고 구독하지 않는다.
 * 서버 스냅숏은 같은 게터다(다리의 마지막 값이 서버 그림에도 그대로 나온다).
 */

/** 안쪽 문서 높이 — 모르면 null */
export function useBridgeHeight(bridge: PreviewFrameBridge | null): number | null {
  const subscribe = useCallback(
    (notify: () => void) => bridge?.onHeight?.(notify) ?? unsubscribeNothing,
    [bridge],
  )
  const get = () => bridge?.contentHeight ?? null
  return useSyncExternalStore(subscribe, get, get)
}

/** 안쪽에 모달이 열려 있는가 */
export function useBridgeModal(bridge: PreviewFrameBridge | null): boolean {
  const subscribe = useCallback(
    (notify: () => void) => bridge?.onModal?.(notify) ?? unsubscribeNothing,
    [bridge],
  )
  const get = () => bridge?.modal ?? false
  return useSyncExternalStore(subscribe, get, get)
}

/** 바꿔 끼운 뒤라 둘째(뒤 층) iframe 이 앞인가 */
export function useBridgeFront(
  bridge: PreviewFrameBridge | null,
  spareRef: RefObject<HTMLIFrameElement | null>,
): boolean {
  const subscribe = useCallback(
    (notify: () => void) => bridge?.onSwap?.(notify) ?? unsubscribeNothing,
    [bridge],
  )
  const get = () => spareRef.current !== null && bridge?.front === spareRef.current
  return useSyncExternalStore(subscribe, get, () => false)
}
