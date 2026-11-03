import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSeatFeed, type SeatStreamHandlers } from './seatFeed'
import type { BookingApi } from './bookingApi'
import type { Seat, SeatSnapshot } from './types'

const seat = (id: string, over: Partial<Seat> = {}): Seat => ({
  id,
  section: 'A',
  row: '1',
  number: Number(id.slice(1)) || 1,
  grade: 'R',
  state: 'OPEN',
  v: 1,
  ...over,
})

/** 흐름 쪽 가짜 - 시험이 열림 · 사건 · 상태를 직접 낸다 */
function fakeStream() {
  let handlers: SeatStreamHandlers | undefined
  return {
    connect: (h: SeatStreamHandlers) => {
      handlers = h
      return { start: () => undefined, stop: () => undefined }
    },
    open: () => handlers!.onOpen(),
    ready: () => handlers!.onEvent('ready', { poolId: 'p' }),
    seats: (
      ...seats: Array<{ id: string; state: 'OPEN' | 'TAKEN'; heldUntil?: string; v: number }>
    ) => handlers!.onEvent('seats', { seats }),
    status: (s: Parameters<SeatStreamHandlers['onStatus']>[0]) => handlers!.onStatus(s),
  }
}

/** 스냅샷을 시험이 열어 줄 때까지 붙잡아 두는 가짜 서버 */
function fakeApi() {
  const pending: Array<(snapshot: SeatSnapshot) => void> = []
  const api: Pick<BookingApi, 'snapshot'> = {
    snapshot: () => new Promise((resolve) => pending.push(resolve)),
  }
  return {
    api,
    reads: () => pending.length,
    answer: (index: number, s: SeatSnapshot) => pending[index](s),
  }
}

const states = (feed: ReturnType<typeof createSeatFeed>) =>
  Object.fromEntries(feed.getSnapshot().seats.map((s) => [s.id, `${s.state}${s.v}`]))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('seat feed', () => {
  it('holds the events that come before and during the snapshot read and keeps the larger v per seat', async () => {
    const stream = fakeStream()
    const server = fakeApi()
    const feed = createSeatFeed({ poolId: 'p', api: server.api, connect: stream.connect })
    feed.start()
    stream.open()
    // 연결은 열렸고 아직 ready 도 스냅샷도 없다 - 먼저 온 사건은 쥐고 있는다
    stream.seats({ id: 'A1', state: 'TAKEN', v: 5 })
    stream.ready()
    expect(server.reads()).toBe(1)
    // 스냅샷을 읽는 동안 온 사건
    stream.seats({ id: 'A2', state: 'OPEN', v: 6 })
    server.answer(0, {
      serverTime: new Date().toISOString(),
      seats: [
        seat('A1', { state: 'OPEN', v: 4 }),
        seat('A2', { state: 'TAKEN', v: 3 }),
        seat('A3', { state: 'TAKEN', v: 2 }),
      ],
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(states(feed)).toEqual({ A1: 'TAKEN5', A2: 'OPEN6', A3: 'TAKEN2' })
    // 스냅샷 뒤에 온 낡은 사건(작은 v)은 버리고, 큰 v 는 받는다
    stream.seats({ id: 'A3', state: 'OPEN', v: 1 }, { id: 'A1', state: 'OPEN', v: 7 })
    expect(states(feed)).toEqual({ A1: 'OPEN7', A2: 'OPEN6', A3: 'TAKEN2' })
    feed.stop()
  })

  it('reads the snapshot again every time the stream opens again, and says it is reconnecting in between', async () => {
    const stream = fakeStream()
    const server = fakeApi()
    const feed = createSeatFeed({ poolId: 'p', api: server.api, connect: stream.connect })
    feed.start()
    stream.status('connecting')
    expect(feed.getSnapshot().connection).toBe('connecting')
    stream.status('open')
    stream.open()
    stream.ready()
    server.answer(0, { serverTime: new Date().toISOString(), seats: [seat('A1', { v: 1 })] })
    await vi.advanceTimersByTimeAsync(0)
    expect(feed.getSnapshot().connection).toBe('live')

    stream.status('reconnecting')
    expect(feed.getSnapshot().connection).toBe('reconnecting')
    // 끊긴 동안 배치도는 마지막으로 안 모습 그대로 남는다
    expect(states(feed)).toEqual({ A1: 'OPEN1' })
    stream.status('open')
    stream.open()
    stream.ready()
    expect(server.reads()).toBe(2)
    server.answer(1, {
      serverTime: new Date().toISOString(),
      seats: [seat('A1', { state: 'TAKEN', v: 9 })],
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(feed.getSnapshot().connection).toBe('live')
    expect(states(feed)).toEqual({ A1: 'TAKEN9' })
    feed.stop()
  })

  it('opens a held seat by itself at heldUntil, by the server clock rather than the local one', async () => {
    const stream = fakeStream()
    const server = fakeApi()
    const feed = createSeatFeed({ poolId: 'p', api: server.api, connect: stream.connect })
    feed.start()
    stream.open()
    stream.ready()
    // 서버 시계가 로컬보다 1분 빠르다 - 서버 시각 기준 10초 뒤에 열린다
    const serverNow = Date.now() + 60_000
    server.answer(0, {
      serverTime: new Date(serverNow).toISOString(),
      seats: [
        seat('A1', { state: 'TAKEN', heldUntil: new Date(serverNow + 10_000).toISOString(), v: 2 }),
      ],
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(states(feed)).toEqual({ A1: 'TAKEN2' })
    await vi.advanceTimersByTimeAsync(9_000)
    expect(states(feed)).toEqual({ A1: 'TAKEN2' })
    await vi.advanceTimersByTimeAsync(2_000)
    expect(states(feed)).toEqual({ A1: 'OPEN2' })
    feed.stop()
  })

  it('shows a seat the server refused as taken at once, until a newer event says otherwise', async () => {
    const stream = fakeStream()
    const server = fakeApi()
    const feed = createSeatFeed({ poolId: 'p', api: server.api, connect: stream.connect })
    feed.start()
    stream.open()
    stream.ready()
    server.answer(0, { serverTime: new Date().toISOString(), seats: [seat('A1', { v: 3 })] })
    await vi.advanceTimersByTimeAsync(0)
    feed.markTaken(['A1'])
    expect(states(feed)).toEqual({ A1: 'TAKEN3' })
    // 같은 v 의 낡은 모습(이 단추를 누르기 전에 읽은 것)이 와도 되돌아가지 않는다
    stream.seats({ id: 'A1', state: 'OPEN', v: 3 })
    expect(states(feed)).toEqual({ A1: 'TAKEN3' })
    stream.seats({ id: 'A1', state: 'OPEN', v: 4 })
    expect(states(feed)).toEqual({ A1: 'OPEN4' })
    feed.stop()
  })
  it('keeps the seat taken by someone else when the open event beat our own release response', async () => {
    const stream = fakeStream()
    const server = fakeApi()
    const feed = createSeatFeed({ poolId: 'p', api: server.api, connect: stream.connect })
    feed.start()
    stream.open()
    stream.ready()
    server.answer(0, {
      serverTime: new Date().toISOString(),
      seats: [seat('A1', { state: 'TAKEN', heldUntil: '2999-01-01T00:00:00Z', v: 2 })],
    })
    await vi.advanceTimersByTimeAsync(0)
    // 내가 놓은 서버 사건(OPEN v3)이 HTTP 응답보다 먼저 온다
    stream.seats({ id: 'A1', state: 'OPEN', v: 3 })
    feed.markOpen('A1')
    // 그 뒤 남이 잡은 진짜 사건(v4)은 버려지면 안 된다
    stream.seats({ id: 'A1', state: 'TAKEN', heldUntil: '2999-01-01T00:00:00Z', v: 4 })
    expect(states(feed)).toEqual({ A1: 'TAKEN4' })
    feed.stop()
  })
})
