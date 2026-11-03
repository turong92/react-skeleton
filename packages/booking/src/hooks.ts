import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { BookingApi } from './bookingApi'
import { createHoldController } from './holdController'
import { createSeatFeed } from './seatFeed'
import { createSseConnector, type SeatStreamOptions } from './seatStream'

export type UseSeatFeedOptions = {
  api: Pick<BookingApi, 'snapshot' | 'streamUrl'>
  /** 대기실을 단 풀의 입장권 - 흐름을 열 때 헤더로 보낸다 */
  entryToken?: string | null
  sse?: SeatStreamOptions['sse']
}

/**
 * 배치도 상태 - 흐름을 열고 스냅샷과 맞춘다(`createSeatFeed`). 마운트하면 연결하고 언마운트하면 끊는다.
 * 같은 `api` · `sse` 는 렌더마다 새로 만들지 말고 한 번 만들어 둔다.
 */
export function useSeatFeed(poolId: string, { api, entryToken, sse }: UseSeatFeedOptions) {
  const tokenRef = useRef(entryToken)
  useEffect(() => {
    tokenRef.current = entryToken
  })
  const getToken = useCallback(() => tokenRef.current, [])
  const feed = useMemo(
    () =>
      createSeatFeed({
        poolId,
        api,
        // eslint-disable-next-line react-hooks/refs -- 입장권 ref 는 연결할 때(이벤트)만 읽는다. 렌더 중에 읽지 않는다
        connect: createSseConnector({
          url: api.streamUrl(poolId),
          getEntryToken: getToken,
          sse,
        }),
      }),
    [poolId, api, sse, getToken],
  )
  useEffect(() => {
    feed.start()
    return () => feed.stop()
  }, [feed])
  const snapshot = useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot)
  return { ...snapshot, feed }
}

export type UseSeatHoldOptions = {
  api: Pick<BookingApi, 'addSeats' | 'removeSeat' | 'myHolds' | 'checkout' | 'release' | 'confirm'>
  feed: Parameters<typeof createHoldController>[0]['feed']
  /** 대기실을 단 풀이다 */
  requiresEntry: boolean
  entryToken?: string | null
}

/** 내 보류 - 자리 누르기 · 결제 시작 · 나가기 · 확정. 마운트하면 내 열린 보류를 읽어 이어 간다 */
export function useSeatHold(
  poolId: string,
  { api, feed, requiresEntry, entryToken }: UseSeatHoldOptions,
) {
  const tokenRef = useRef(entryToken)
  useEffect(() => {
    tokenRef.current = entryToken
  })
  const getToken = useCallback(() => tokenRef.current, [])
  const controller = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- 입장권 ref 는 누를 때(이벤트)만 읽는다. 렌더 중에 읽지 않는다
      createHoldController({
        poolId,
        api,
        feed,
        requiresEntry,
        getEntryToken: getToken,
      }),
    [poolId, api, feed, requiresEntry, getToken],
  )
  useEffect(() => {
    void controller.load()
  }, [controller])
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  return { ...snapshot, controller }
}

/** 목표 시각(ISO)까지 남은 ms - 1초마다 갱신, 서버 시계(`serverNow`)로 센다. 서버 렌더에는 시계가 없어 null */
export function useRemainingMs(targetIso: string | null | undefined, serverNow: () => number) {
  const [now, setNow] = useState<number | null>(null)
  const nowRef = useRef(serverNow)
  useEffect(() => {
    nowRef.current = serverNow
  })
  useEffect(() => {
    if (!targetIso) return
    const tick = () => setNow(nowRef.current())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso])
  return targetIso && now !== null ? Date.parse(targetIso) - now : null
}
