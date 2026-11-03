export const WAITING_ROOM_STATES = ['PREQUEUE', 'WAITING', 'ADMITTED', 'EXPIRED', 'CLOSED'] as const
export type WaitingRoomState = (typeof WAITING_ROOM_STATES)[number]

/**
 * `GET /waiting-rooms/{id}/status` 와 `POST …/tickets` 의 답(같은 모양).
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
  /** 순번표 토큰(서명됨, 계정에 묶임) - 있으면 저장한 것을 이것으로 바꾼다. 순번표를 받는 답에는 늘 있다 */
  ticket?: string
}
