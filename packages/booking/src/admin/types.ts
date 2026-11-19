import type { Pool, PoolStatus } from '../types'

export type AdminPool = Omit<Pool, 'seats'> & { createdAt: string }

export type NewPool = {
  name: string
  /** ISO 시각 */
  opensAt: string
  closesAt?: string
  /** 한 번에 잡는 자리 상한 - 기본값이 없다(없으면 한 사람이 다 잡는다) */
  maxPerHold: number
  perAccountLimit?: number
  /** 유료 자리가 있으면 필요 */
  currency?: string
  holdMinutes?: number
  waitingRoomId?: string
}

export type PoolUpdate = { name?: string; closesAt?: string; status?: PoolStatus }

export type NewSeat = {
  section: string
  row: string
  number: number
  grade: string
  price?: number
}

/** 자리 상태별 개수. `unfulfilled` 는 돈은 받았는데 자리를 못 준 보류 수(환불 작업이 걸려 있다) */
export type PoolStats = {
  total: number
  available: number
  held: number
  sold: number
  blocked: number
  unfulfilled: number
}
