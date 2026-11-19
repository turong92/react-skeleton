import { ApiRequestError } from '@skeleton/api-client'
import { describe, expect, it, vi } from 'vitest'
import type { BookingApi } from './bookingApi'
import { createHoldController } from './holdController'
import type { Hold, Seat } from './types'

const seat = (id: string): Seat => ({
  id,
  section: 'A',
  row: '1',
  number: 1,
  grade: 'R',
  state: 'TAKEN',
  heldUntil: '2026-11-03T00:10:00Z',
  v: 2,
})
const hold = (ids: string[], over: Partial<Hold> = {}): Hold => ({
  holdId: 'bkh_1',
  poolId: 'p',
  status: 'HELD',
  seats: ids.map(seat),
  expiresAt: '2026-11-03T00:10:00Z',
  ...over,
})
const failure = (code: string, status: number, data?: unknown) =>
  new ApiRequestError({ code, title: code, status, timestamp: 't', data }, 't', 's', 'p')

type Calls = { add: Array<[string[], string | null | undefined]>; remove: string[] }
function setup(
  over: Partial<BookingApi> = {},
  entry: { requiresEntry?: boolean; token?: string | null } = {},
) {
  const calls: Calls = { add: [], remove: [] }
  const api: Pick<
    BookingApi,
    'addSeats' | 'removeSeat' | 'myHolds' | 'checkout' | 'release' | 'confirm'
  > = {
    addSeats: async (_pool, ids, token) => {
      calls.add.push([ids, token])
      return hold(ids)
    },
    removeSeat: async (_pool, id) => {
      calls.remove.push(id)
      return hold([])
    },
    myHolds: async () => [],
    checkout: async () => hold(['A1'], { amount: 5000 }),
    release: async () => hold([], { status: 'RELEASED' }),
    confirm: async () => hold(['A1'], { status: 'CONFIRMED' }),
    ...over,
  }
  const feed = { merge: vi.fn(), markTaken: vi.fn(), markOpen: vi.fn() }
  const controller = createHoldController({
    poolId: 'p',
    api,
    feed,
    requiresEntry: entry.requiresEntry ?? false,
    getEntryToken: () => entry.token,
  })
  return { controller, feed, calls }
}

describe('hold controller', () => {
  it('sends one request when the same seat is pressed twice before the answer comes', async () => {
    let answer: ((h: Hold) => void) | undefined
    const { controller, calls } = setup({
      addSeats: (_p, ids) => {
        calls.add.push([ids, undefined])
        return new Promise<Hold>((resolve) => (answer = resolve))
      },
    })
    void controller.pick('A1')
    void controller.pick('A1')
    expect(controller.getSnapshot().pending).toEqual(['A1'])
    await vi.waitFor(() => expect(answer).toBeDefined())
    answer!(hold(['A1']))
    await vi.waitFor(() => expect(controller.getSnapshot().pending).toEqual([]))
    expect(calls.add).toHaveLength(1)
    expect(controller.getSnapshot().hold?.seats.map((s) => s.id)).toEqual(['A1'])
  })

  it('shows a seat that someone else took as taken at once, and says so', async () => {
    const { controller, feed } = setup({
      addSeats: async () => {
        throw failure('BOOKING.SEAT_TAKEN', 409, { seatIds: ['A1'] })
      },
    })
    await controller.pick('A1')
    expect(feed.markTaken).toHaveBeenCalledWith(['A1'])
    expect(controller.getSnapshot().problem).toBe('seatTaken')
    expect(controller.getSnapshot().pending).toEqual([])
  })

  it('presses a seat of my own hold to let it go, and shows it open again', async () => {
    const { controller, feed, calls } = setup()
    await controller.pick('A1')
    await controller.pick('A1')
    expect(calls.add).toHaveLength(1)
    expect(calls.remove).toEqual(['A1'])
    expect(feed.markOpen).toHaveBeenCalledWith('A1')
  })

  it('cannot add or remove a seat once the checkout started, but can still leave', async () => {
    const { controller, calls } = setup()
    await controller.pick('A1')
    await controller.checkout()
    expect(controller.getSnapshot().locked).toBe(true)
    await controller.pick('A2')
    await controller.pick('A1')
    expect(calls.add).toHaveLength(1)
    expect(calls.remove).toEqual([])
    await controller.release()
    expect(controller.getSnapshot().hold).toBeNull()
    expect(controller.getSnapshot().locked).toBe(false)
  })

  it('shows the confirmed hold, and opens no seat, when leaving answers that the payment already went through', async () => {
    const { controller, feed } = setup({
      release: async () => hold(['A1'], { status: 'CONFIRMED' }),
    })
    await controller.pick('A1')
    await controller.release()
    expect(controller.getSnapshot().hold?.status).toBe('CONFIRMED')
    expect(feed.markOpen).not.toHaveBeenCalled()
  })

  it('learns that the hold is locked from the server, and tells the person', async () => {
    const { controller } = setup({
      addSeats: async () => {
        throw failure('BOOKING.HOLD_LOCKED', 409)
      },
    })
    await controller.pick('A1')
    expect(controller.getSnapshot().locked).toBe(true)
    expect(controller.getSnapshot().problem).toBe('holdLocked')
  })

  it('sends the entry token with the seat, and takes no seat without it in a pool with a waiting room', async () => {
    const withToken = setup({}, { requiresEntry: true, token: 'entry' })
    await withToken.controller.pick('A1')
    expect(withToken.calls.add).toEqual([[['A1'], 'entry']])
    const without = setup({}, { requiresEntry: true, token: null })
    await without.controller.pick('A1')
    expect(without.calls.add).toEqual([])
  })
})
