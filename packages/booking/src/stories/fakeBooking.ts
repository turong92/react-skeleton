import { ApiRequestError } from '@skeleton/api-client'
import type { BookingApi } from '../bookingApi'
import type { Hold, Pool, Seat } from '../types'

const failure = (code: string, status: number, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't', data }, 't', 's', 'p')

export const fakePool: Pool = {
  id: 'pool-1',
  name: 'Small theatre',
  opensAt: '2026-11-03T00:00:00Z',
  currency: 'KRW',
  maxPerHold: 3,
  holdMinutes: 10,
  status: 'ACTIVE',
  seats: { total: 6, available: 6 },
}

const HOLD_MS = 10 * 60_000

/**
 * 스토리용 가짜 예약 서버 - 자리 6개(R석 4 · S석 2), 흐름은 진짜 SSE 클라이언트가 읽는 가짜 `fetch`.
 * `takeByOther` 가 다른 사람이 자리를 잡은 것처럼 사건을 흘린다. 모든 요청은 `requests` 에 쌓인다.
 */
export function createFakeBooking() {
  const seats = new Map<string, Seat>()
  const ids = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2']
  ids.forEach((id, index) => {
    seats.set(id, {
      id,
      section: id.startsWith('A') ? 'A' : 'B',
      row: '1',
      number: Number(id.slice(1)),
      grade: index < 4 ? 'R' : 'S',
      price: index < 4 ? 50_000 : 30_000,
      state: 'OPEN',
      v: 1,
    })
  })
  const mine = new Set<string>()
  let status: Hold['status'] = 'HELD'
  let checkoutStarted = false
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const requests: string[] = []
  const encoder = new TextEncoder()

  const send = (name: string, data: unknown) =>
    controller?.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`))
  const push = (id: string) => {
    const s = seats.get(id)!
    send('seats', { seats: [{ id, state: s.state, heldUntil: s.heldUntil, v: s.v }] })
  }
  const holdNow = (): Hold => ({
    holdId: 'hold-1',
    poolId: fakePool.id,
    status,
    seats: [...mine].map((id) => seats.get(id)!),
    expiresAt: new Date(Date.now() + HOLD_MS).toISOString(),
    amount: [...mine].reduce((sum, id) => sum + (seats.get(id)!.price ?? 0), 0),
  })
  const change = (id: string, patch: Partial<Seat>) => {
    const s = seats.get(id)!
    seats.set(id, { ...s, ...patch, v: s.v + 1 })
    push(id)
  }

  const api: Pick<
    BookingApi,
    | 'snapshot'
    | 'streamUrl'
    | 'addSeats'
    | 'removeSeat'
    | 'myHolds'
    | 'checkout'
    | 'release'
    | 'confirm'
  > = {
    snapshot: async () => ({ serverTime: new Date().toISOString(), seats: [...seats.values()] }),
    streamUrl: () => 'http://fake.test/stream',
    addSeats: async (_pool, wanted) => {
      requests.push(`add ${wanted.join(',')}`)
      if (checkoutStarted) throw failure('BOOKING.HOLD_LOCKED', 409)
      const taken = wanted.filter((id) => seats.get(id)!.state === 'TAKEN' && !mine.has(id))
      if (taken.length > 0) throw failure('BOOKING.SEAT_TAKEN', 409, { seatIds: taken })
      for (const id of wanted) {
        mine.add(id)
        change(id, { state: 'TAKEN', heldUntil: new Date(Date.now() + HOLD_MS).toISOString() })
      }
      return holdNow()
    },
    removeSeat: async (_pool, id) => {
      requests.push(`remove ${id}`)
      if (checkoutStarted) throw failure('BOOKING.HOLD_LOCKED', 409)
      mine.delete(id)
      change(id, { state: 'OPEN', heldUntil: undefined })
      return holdNow()
    },
    myHolds: async () => (mine.size > 0 ? [holdNow()] : []),
    checkout: async () => {
      requests.push('checkout')
      checkoutStarted = true
      return holdNow()
    },
    release: async () => {
      requests.push('release')
      const released = holdNow()
      for (const id of [...mine]) change(id, { state: 'OPEN', heldUntil: undefined })
      mine.clear()
      checkoutStarted = false
      return { ...released, seats: [], status: 'RELEASED' }
    },
    confirm: async () => {
      requests.push('confirm')
      status = 'CONFIRMED'
      return { ...holdNow(), amount: undefined }
    },
  }

  const fetchStream: typeof fetch = async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
        setTimeout(() => send('ready', { poolId: fakePool.id }), 0)
      },
    })
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }

  return {
    api,
    sse: { fetch: fetchStream },
    requests,
    /** 다른 사람이 이 자리를 잡았다(흐름으로 사건이 흐른다) */
    takeByOther: (id: string) =>
      change(id, { state: 'TAKEN', heldUntil: new Date(Date.now() + HOLD_MS).toISOString() }),
  }
}
