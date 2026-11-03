import type { WaitingRoomApi } from '../waitingRoomApi'
import type { WaitingRoomStorage } from '../waitingRoomQueue'
import type { WaitingRoomStatus } from '../types'

/** 스토리용 상태 - 필요한 것만 덮어쓴다 */
export function fakeStatus(over: Partial<WaitingRoomStatus> = {}): WaitingRoomStatus {
  return {
    state: 'WAITING',
    position: 40,
    ahead: 10,
    estimatedWaitSeconds: 300,
    opensAt: '2026-11-03T00:00:00Z',
    pollAfterSeconds: 1,
    ...over,
  }
}

/** 스토리용 가짜 서버 - 물을 때마다 `script` 를 차례로 돌려주고 마지막 것에 머문다 */
export function createFakeWaitingRoom(script: WaitingRoomStatus[]) {
  let next = 0
  const api: WaitingRoomApi = {
    takeTicket: async () => ({ ticketToken: 'ticket-1' }),
    status: async () => script[Math.min(next++, script.length - 1)],
  }
  return { api }
}

/** 스토리가 브라우저의 저장소를 건드리지 않게 - 스토리마다 새것 */
export function memoryStorage(): WaitingRoomStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}
