import { useSyncExternalStore } from 'react'

/** 서버(하이드레이션 전)에서는 false — 주소의 `#조각` 은 서버가 못 읽어, 토큰 화면을 서버에서 그리면 클라이언트와 어긋난다 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
}
