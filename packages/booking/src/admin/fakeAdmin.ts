import type { BookingApi } from '../bookingApi'
import type { Seat } from '../types'
import type { BookingAdminApi } from './adminApi'
import type { AdminPool } from './types'

/** 스토리용 가짜 운영 서버 - 풀 하나, 자리는 넣은 만큼 쌓인다 */
export function createFakeBookingAdmin() {
  let pool: AdminPool = {
    id: 'pool-1',
    name: '소극장 공연',
    opensAt: '2026-11-03T00:00:00Z',
    maxPerHold: 4,
    holdMinutes: 10,
    status: 'ACTIVE',
    createdAt: '2026-11-01T00:00:00Z',
  }
  const seats = new Map<string, Seat>()
  const blocked = new Set<string>()
  const calls: string[] = []
  const admin: BookingAdminApi = {
    list: async () => [pool],
    create: async (input) => ({ ...pool, ...input, id: 'pool-2', status: 'ACTIVE' }),
    update: async (_id, input) => {
      calls.push(`update ${JSON.stringify(input)}`)
      pool = { ...pool, ...input }
      return pool
    },
    addSeats: async (_id, list) => {
      for (const s of list) {
        const id = `${s.section}${s.row}-${s.number}`
        seats.set(id, { id, ...s, state: 'OPEN', v: 1 })
      }
      return { added: list.length }
    },
    block: async (_id, ids) => {
      calls.push(`block ${ids.join(',')}`)
      for (const id of ids) {
        blocked.add(id)
        seats.set(id, { ...seats.get(id)!, state: 'TAKEN', v: 2 })
      }
      return { changed: ids.length }
    },
    unblock: async (_id, ids) => {
      calls.push(`unblock ${ids.join(',')}`)
      for (const id of ids) {
        blocked.delete(id)
        seats.set(id, { ...seats.get(id)!, state: 'OPEN', v: 3 })
      }
      return { changed: ids.length }
    },
    stats: async () => ({
      total: seats.size,
      available: [...seats.values()].filter((s) => s.state === 'OPEN').length,
      held: 0,
      sold: 0,
      blocked: blocked.size,
      unfulfilled: 0,
    }),
  }
  const user: Pick<BookingApi, 'snapshot'> = {
    snapshot: async () => ({ serverTime: new Date().toISOString(), seats: [...seats.values()] }),
  }
  return { admin, user, calls }
}
