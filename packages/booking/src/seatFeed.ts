import type { RealtimeStatus } from '@skeleton/realtime'
import type { BookingApi } from './bookingApi'
import type { Seat, SeatPatch, SeatSnapshot } from './types'

/** 흐름 쪽이 이 피드에 알리는 길 - `createSseConnector` 가 진짜를, 시험이 가짜를 꽂는다 */
export type SeatStreamHandlers = {
  /** 연결이 (다시) 열렸다 */
  onOpen: () => void
  /** 사건 하나 - `ready`(구독이 등록됐다, 이제 스냅샷을 읽는다) 또는 `seats`(`{seats: SeatPatch[]}`) */
  onEvent: (name: string, data: unknown) => void
  onStatus: (status: RealtimeStatus) => void
}
export type SeatStreamConnect = (handlers: SeatStreamHandlers) => { start(): void; stop(): void }

/** 흐름 상태 - 한 번도 못 붙었으면 `connecting`, 붙었다가 끊겼으면 `reconnecting`(배치도 위에 「다시 연결하는 중」) */
export type FeedConnection = 'connecting' | 'live' | 'reconnecting'

export type SeatFeedSnapshot = {
  /** 지금 시각으로 본 자리들(보류 시간이 지난 자리는 이미 열림) - 처음 스냅샷을 읽기 전에는 비어 있다 */
  seats: Seat[]
  connection: FeedConnection
  /** 스냅샷을 한 번이라도 읽었다 */
  loaded: boolean
}

export type SeatFeed = {
  getSnapshot(): SeatFeedSnapshot
  subscribe(listener: () => void): () => void
  start(): void
  stop(): void
  /** 서버 시계로 지금(ms) - 스냅샷의 `serverTime` 으로 내 시계 차를 고친 값 */
  serverNow(): number
  /** 내 요청의 응답에 실린 자리를 합친다(`v` 가 큰 쪽) */
  merge(seats: Seat[]): void
  /** 서버가 「다른 분이 먼저 잡았다」고 한 자리 - 더 새로운 사건이 올 때까지 선택 불가 */
  markTaken(seatIds: string[]): void
  /** 내가 놓은 자리 - 사건이 오기 전에도 바로 열린 것으로 보인다 */
  markOpen(seatId: string): void
}

export type SeatFeedOptions = {
  poolId: string
  api: Pick<BookingApi, 'snapshot'>
  connect: SeatStreamConnect
  /** 테스트용 */
  now?: () => number
}

/** 스냅샷 읽기가 실패하면 다시 읽기까지(ms) */
const SNAPSHOT_RETRY_MS = 5000
const MAX_TIMER_MS = 2 ** 31 - 1

/**
 * 배치도 맞추기 - React 를 모른다. 흐름을 먼저 열고, `ready` 를 받으면 그동안 온 사건을 쥔 채 스냅샷을 읽고,
 * 자리마다 **`v` 가 큰 쪽**을 남긴다(연결 전 사건은 스냅샷에, 연결 뒤 사건은 흐름에 있으므로 빠지는 것이 없다).
 * 다시 열릴 때마다 같은 순서를 되풀이한다. `heldUntil` 이 지난 자리는 서버 시계 기준으로 스스로 열린다.
 */
export function createSeatFeed({
  poolId,
  api,
  connect,
  now = Date.now,
}: SeatFeedOptions): SeatFeed {
  const seats = new Map<string, Seat>()
  /** 스냅샷에 아직 없는 자리의 사건 - 스냅샷이 오면 합친다 */
  const pending = new Map<string, SeatPatch>()
  const listeners = new Set<() => void>()
  let connection: FeedConnection = 'connecting'
  let everLive = false
  let loaded = false
  let offset = 0
  let generation = 0
  let running = false
  let stream: { start(): void; stop(): void } | undefined
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let view: SeatFeedSnapshot = { seats: [], connection, loaded }

  const serverNow = () => now() + offset

  const effective = (seat: Seat): Seat =>
    seat.state === 'TAKEN' && seat.heldUntil && Date.parse(seat.heldUntil) <= serverNow()
      ? { ...seat, state: 'OPEN', heldUntil: undefined }
      : seat

  function publish() {
    view = { seats: [...seats.values()].map(effective), connection, loaded }
    clearTimeout(expiryTimer)
    const current = serverNow()
    const upcoming = [...seats.values()]
      .filter((seat) => seat.state === 'TAKEN' && seat.heldUntil)
      .map((seat) => Date.parse(seat.heldUntil!))
      .filter((at) => at > current)
    if (running && upcoming.length > 0) {
      const delay = Math.min(Math.min(...upcoming) - current + 20, MAX_TIMER_MS)
      expiryTimer = setTimeout(publish, delay)
    }
    for (const listener of [...listeners]) listener()
  }

  function applyPatch(patch: SeatPatch) {
    const existing = seats.get(patch.id)
    if (!existing) {
      const held = pending.get(patch.id)
      if (!held || patch.v > held.v) pending.set(patch.id, patch)
      return
    }
    if (patch.v > existing.v)
      seats.set(patch.id, {
        ...existing,
        state: patch.state,
        heldUntil: patch.heldUntil,
        v: patch.v,
      })
  }

  function applySeat(incoming: Seat) {
    const existing = seats.get(incoming.id)
    if (!existing || incoming.v > existing.v) seats.set(incoming.id, incoming)
  }

  function applySnapshot(snapshot: SeatSnapshot) {
    offset = Date.parse(snapshot.serverTime) - now()
    for (const seat of snapshot.seats) applySeat(seat)
    for (const [id, patch] of [...pending]) {
      if (!seats.has(id)) continue
      applyPatch(patch)
      pending.delete(id)
    }
  }

  async function readSnapshot() {
    const mine = generation
    try {
      const snapshot = await api.snapshot(poolId)
      applySnapshot(snapshot)
      if (mine === generation) loaded = true
      publish()
    } catch {
      if (running && mine === generation)
        retryTimer = setTimeout(() => void readSnapshot(), SNAPSHOT_RETRY_MS)
    }
  }

  const handlers: SeatStreamHandlers = {
    onOpen: () => {
      generation++
      clearTimeout(retryTimer)
    },
    onEvent: (name, data) => {
      if (name === 'ready') void readSnapshot()
      else if (name === 'seats') {
        const list = (data as { seats?: SeatPatch[] } | null)?.seats
        if (!Array.isArray(list)) return
        for (const patch of list) applyPatch(patch)
        publish()
      }
    },
    onStatus: (status) => {
      if (status === 'open') everLive = true
      connection = status === 'open' ? 'live' : everLive ? 'reconnecting' : 'connecting'
      publish()
    },
  }

  return {
    getSnapshot: () => view,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start: () => {
      if (running) return
      running = true
      stream = connect(handlers)
      stream.start()
    },
    stop: () => {
      running = false
      generation++
      clearTimeout(expiryTimer)
      clearTimeout(retryTimer)
      stream?.stop()
      stream = undefined
    },
    serverNow,
    merge: (incoming) => {
      for (const seat of incoming) applySeat(seat)
      publish()
    },
    markTaken: (ids) => {
      for (const id of ids) {
        const seat = seats.get(id)
        if (seat) seats.set(id, { ...seat, state: 'TAKEN', heldUntil: undefined })
      }
      publish()
    },
    markOpen: (id) => {
      const seat = seats.get(id)
      if (seat) seats.set(id, { ...seat, state: 'OPEN', heldUntil: undefined, v: seat.v + 1 })
      publish()
    },
  }
}
