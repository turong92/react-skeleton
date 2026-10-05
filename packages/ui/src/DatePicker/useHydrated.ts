import { useSyncExternalStore } from 'react'

const subscribe = () => () => undefined

/** 서버 렌더와 첫 하이드레이션에서는 false, 브라우저에서 이어받은 뒤 true — 브라우저의 로케일에 기대는 글자를 그 뒤에 그리려고 */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
