import { ApiRequestError } from '@skeleton/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWaitingRoomQueue, type WaitingRoomStorage } from './waitingRoomQueue'
import type { WaitingRoomApi } from './waitingRoomApi'
import type { WaitingRoomStatus } from './types'

const waiting = (over: Partial<WaitingRoomStatus> = {}): WaitingRoomStatus => ({
  state: 'WAITING',
  position: 40,
  ahead: 10,
  estimatedWaitSeconds: 60,
  opensAt: '2026-11-03T00:00:00Z',
  pollAfterSeconds: 7,
  ...over,
})

function memoryStorage(initial: Record<string, string> = {}): WaitingRoomStorage & {
  data: Record<string, string>
} {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => void (data[key] = value),
    removeItem: (key) => void delete data[key],
  }
}

function fakeApi(replies: WaitingRoomStatus[]) {
  const taken: string[] = []
  const asked: string[] = []
  let next = 0
  const api: WaitingRoomApi = {
    takeTicket: async () => {
      taken.push('POST')
      return { ticketToken: `tk${taken.length}` }
    },
    status: async (_room, token) => {
      asked.push(token)
      return replies[Math.min(next++, replies.length - 1)]
    },
  }
  return { api, taken, asked }
}

const rejected = (status: number) =>
  new ApiRequestError(
    { code: 'WAITING_ROOM.TICKET_INVALID', title: 'x', status, timestamp: '2026-11-03T00:00:00Z' },
    't',
    's',
    'p',
  )

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('waiting room queue', () => {
  it('asks again after exactly the seconds the server said, every time', async () => {
    const { api, asked } = fakeApi([
      waiting({ pollAfterSeconds: 7 }),
      waiting({ pollAfterSeconds: 20 }),
      waiting({ pollAfterSeconds: 5 }),
    ])
    const queue = createWaitingRoomQueue({ api, roomId: 'wr_1', storage: memoryStorage() })
    queue.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(asked).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(6_999)
    expect(asked).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(asked).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(19_999)
    expect(asked).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(asked).toHaveLength(3)
    queue.stop()
  })

  it('stops asking once the room is closed or the entry has expired', async () => {
    const { api, asked } = fakeApi([waiting({ state: 'CLOSED', pollAfterSeconds: 5 })])
    const queue = createWaitingRoomQueue({ api, roomId: 'wr_1', storage: memoryStorage() })
    queue.start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(asked).toHaveLength(1)
    queue.stop()
  })

  it('keeps the ticket across a reload: a stored ticket is used and no new one is taken', async () => {
    const storage = memoryStorage()
    const first = fakeApi([waiting()])
    const a = createWaitingRoomQueue({ api: first.api, roomId: 'wr_1', storage })
    a.start()
    await vi.advanceTimersByTimeAsync(0)
    a.stop()
    expect(first.taken).toHaveLength(1)

    const second = fakeApi([waiting()])
    const b = createWaitingRoomQueue({ api: second.api, roomId: 'wr_1', storage })
    b.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(second.taken).toHaveLength(0)
    expect(second.asked).toEqual(['tk1'])
    b.stop()
  })

  it('drops a stored ticket the server refuses (another account) and takes a fresh one', async () => {
    const storage = memoryStorage({ 'waiting-room:wr_1': 'old-account-ticket' })
    const taken: string[] = []
    const api: WaitingRoomApi = {
      takeTicket: async () => {
        taken.push('POST')
        return { ticketToken: 'mine' }
      },
      status: async (_room, token) => {
        if (token !== 'mine') throw rejected(403)
        return waiting()
      },
    }
    const queue = createWaitingRoomQueue({ api, roomId: 'wr_1', storage })
    queue.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(taken).toHaveLength(1)
    expect(storage.data['waiting-room:wr_1']).toBe('mine')
    expect(queue.getSnapshot().status?.state).toBe('WAITING')
    queue.stop()
  })
})
