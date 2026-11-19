/** 화면에 보이는 자리 상태는 둘뿐이다 - 잡힌 · 팔린 · 막힌 자리는 모두 `TAKEN`, 보류 중이면 `heldUntil`(그 시각에 열린다)이 붙는다 */
export type SeatState = 'OPEN' | 'TAKEN'

/** 스냅샷 · 보류 응답의 자리 한 칸. `v` 는 그 자리 상태가 바뀔 때마다 오르는 버전 - 합칠 때 큰 쪽을 남긴다 */
export type Seat = {
  id: string
  section: string
  row: string
  number: number
  grade: string
  /** 통화 최소 단위 정수. 없으면 무료 */
  price?: number
  state: SeatState
  /** ISO 시각 */
  heldUntil?: string
  v: number
}

/** 흐름의 `seats` 사건 한 칸 */
export type SeatPatch = { id: string; state: SeatState; heldUntil?: string; v: number }

export type SeatSnapshot = { serverTime: string; seats: Seat[] }

export type PoolStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED'

export type Pool = {
  id: string
  name: string
  opensAt: string
  closesAt?: string
  currency?: string
  maxPerHold: number
  perAccountLimit?: number
  holdMinutes: number
  waitingRoomId?: string
  status: PoolStatus
  seats: { total: number; available: number }
}

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED' | 'CANCELED' | 'UNFULFILLED'

/** 내 보류(장바구니) 또는 확정된 예약. 금액은 유료일 때만 - 없으면 무료 */
export type Hold = {
  holdId: string
  poolId: string
  status: HoldStatus
  seats: Seat[]
  expiresAt: string
  amount?: number
}
