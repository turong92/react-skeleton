import { useContext, useSyncExternalStore } from 'react'
import { AuthRestoredContext } from './restoredContext'

const never = () => () => undefined
const notRestored = () => false

/**
 * 브라우저가 저장소의 토큰을 세션에 올렸는가. 서버 렌더와 하이드레이션 첫 그림에서는 항상 false
 * (`getServerSnapshot`) — 끝나면 `AuthRoot` 의 effect 가 `restore()` 를 불러 true 가 된다.
 */
export function useSessionRestored(): boolean {
  const auth = useContext(AuthRestoredContext)
  return useSyncExternalStore(
    auth ? auth.subscribeRestored : never,
    auth ? auth.isRestored : notRestored,
    notRestored,
  )
}
