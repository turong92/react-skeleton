/** `GET /admin/waiting-rooms/{id}/stats` - 숫자 현황. 입장이 멈춰 있으면 `estimatedDrainSeconds` 는 null */
export type WaitingRoomStats = {
  /** 오픈 전 줄에 선 사람 수 */
  prequeue: number
  /** 지금까지 나간 순번표 수 */
  issued: number
  /** 지금까지 들여보낸 번호(입장 번호) */
  serving: number
  perMinute: number
  estimatedDrainSeconds: number | null
}
