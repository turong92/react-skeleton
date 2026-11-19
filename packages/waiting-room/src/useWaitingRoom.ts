import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { WaitingRoomApi } from './waitingRoomApi'
import { createWaitingRoomQueue, type WaitingRoomStorage } from './waitingRoomQueue'

export type UseWaitingRoomOptions = {
  api: WaitingRoomApi
  /** 순번표를 두는 곳(기본 `sessionStorage`) - 새로고침해도 순서가 그대로인 것은 이 덕이다 */
  storage?: WaitingRoomStorage
  /** 화면이 열리자마자 줄을 선다(페이지 앞 문). 기본 false - 버튼 앞 문은 `enter()` 를 부를 때 선다 */
  autoJoin?: boolean
}

/**
 * 한 방의 줄 서기. 서버가 정한 간격으로 물어 `status` 를 갱신한다(첫 답 전에는 null).
 * `enter()` 는 줄을 서고 입장권(`entryToken`)을 기다렸다 돌려준다 - 줄이 닫히거나 입장 시간이 끝나면 `WaitingRoomEntryError`,
 * `rejoin()` 은 입장 시간이 끝난 뒤 맨 뒤에서 다시 선다. 화면을 떠나면 묻기를 멈춘다.
 * 같은 `api` · `storage` 는 렌더마다 새로 만들지 말고 한 번 만들어 둔다.
 */
export function useWaitingRoom(
  roomId: string,
  { api, storage, autoJoin = false }: UseWaitingRoomOptions,
) {
  const queue = useMemo(
    () => createWaitingRoomQueue({ api, roomId, storage }),
    [api, roomId, storage],
  )
  useEffect(() => {
    if (autoJoin) queue.start()
    return () => queue.stop()
  }, [queue, autoJoin])
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot)
  return {
    /** 줄 서기를 시작했는가 */
    started: snapshot.started,
    status: snapshot.status,
    /** 마지막 확인이 실패했다(자동으로 다시 시도한다) */
    error: snapshot.error,
    enter: queue.entry,
    rejoin: queue.rejoin,
  }
}
