import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined

/** 서버 렌더와 하이드레이션 첫 그림에서는 false, 이어받은 뒤 true — 기기의 시간대 · 로케일에 기대는 글자를 그 뒤에 그리려고 */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
