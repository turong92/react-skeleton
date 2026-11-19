import type { WaitingRoomAdminApi } from './adminApi'
import type { WaitingRoomStats } from './types'

/** 스토리용 가짜 운영 서버 - 속도를 바꾸면 모두 들어가기까지의 시간이 따라 바뀐다(남은 300명 기준) */
export function createFakeAdmin() {
  let perMinute = 30
  let closed = false
  const stats = (): WaitingRoomStats => ({
    prequeue: 0,
    issued: 340,
    serving: 40,
    perMinute,
    estimatedDrainSeconds: perMinute === 0 ? null : Math.ceil(300 / perMinute) * 60,
  })
  const api: WaitingRoomAdminApi = {
    stats: async () => stats(),
    setRate: async (_room, next) => {
      if (closed) throw new Error('closed')
      perMinute = next
    },
    close: async () => {
      closed = true
    },
  }
  return { api }
}
