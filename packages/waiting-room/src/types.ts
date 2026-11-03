export const WAITING_ROOM_STATES = ['PREQUEUE', 'WAITING', 'ADMITTED', 'EXPIRED', 'CLOSED'] as const
export type WaitingRoomState = (typeof WAITING_ROOM_STATES)[number]

/** `POST /waiting-rooms/{id}/tickets` - 순번표 토큰(서명됨, 계정에 묶임). 같은 계정이 또 받으면 같은 순번표 */
export type WaitingRoomTicket = { ticketToken: string }

/**
 * `GET /waiting-rooms/{id}/status`.
 * `position` · `ahead` 는 오픈 전 줄(`PREQUEUE`)에서는 아직 번호가 없어 null, `estimatedWaitSeconds` 는 입장이 멈춰 있으면 null.
 * `entryToken` 은 `ADMITTED` 일 때만 - 자리를 더하는 요청마다 헤더(`createEntryHeaders`)로 보낸다
 */
export type WaitingRoomStatus = {
  state: WaitingRoomState
  position: number | null
  ahead: number | null
  estimatedWaitSeconds: number | null
  /** 오픈 시각(ISO) */
  opensAt: string
  /** 다음에 묻기까지 기다릴 초 - 서버가 앞 사람 수로 정한다 */
  pollAfterSeconds: number
  entryToken?: string
}
