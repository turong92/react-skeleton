import { useSyncExternalStore } from 'react'
import type { ConsentState, ConsentStore } from './consentStore'

/** 동의 상태를 읽는다 — 서버 · 하이드레이션 첫 그림은 `unknown`(방문자의 선택을 모른다), 이어받은 뒤 진짜 값 */
export function useConsent(store: ConsentStore): ConsentState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getServerState)
}
