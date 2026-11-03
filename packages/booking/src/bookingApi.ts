import type { ApiClient } from '@skeleton/api-client'
import { createEntryHeaders } from '@skeleton/waiting-room'
import type { Hold, Pool, SeatSnapshot } from './types'

type BookingClient = Pick<ApiClient, 'value' | 'list' | 'endpoint'>

export type BookingApi = {
  /** `GET {base}/pools/{id}` (공개) */
  pool(poolId: string): Promise<Pool>
  /** `GET {base}/pools/{id}/seats` (로그인) - 캐시하지 않는 스냅샷 */
  snapshot(poolId: string): Promise<SeatSnapshot>
  /** 배치도 흐름(SSE) 주소 - `GET {base}/pools/{id}/seats/stream`. 대기실을 단 풀은 연결 때 `X-Entry-Token` */
  streamUrl(poolId: string): string
  /** `POST {base}/pools/{id}/hold/seats {seatIds}` - 대기실을 단 풀은 `X-Entry-Token`. 409 `BOOKING.SEAT_TAKEN`(`data.seatIds`) · `LIMIT_REACHED` · `NOT_OPEN` · `HOLD_EXPIRED` · `HOLD_LOCKED`, 403 `WAITING_ROOM.ENTRY_REQUIRED` */
  addSeats(poolId: string, seatIds: string[], entryToken?: string | null): Promise<Hold>
  /** `DELETE {base}/pools/{id}/hold/seats/{seatId}` - 다시 눌러 풀기. 409 `HOLD_LOCKED` */
  removeSeat(poolId: string, seatId: string): Promise<Hold>
  /** `GET {base}/holds/me` - 내 열린 보류와 확정 목록 */
  myHolds(): Promise<Hold[]>
  /** `POST {base}/holds/{id}/checkout` - 결제 시작: 금액(자리 가격 합)을 박고 자리를 고정한다(멱등). 이어서 결제 주문(`itemType: "booking"`)을 만든다 */
  checkout(holdId: string): Promise<Hold>
  /** `POST {base}/holds/{id}/release` - 나가기: 모두 놓기(결제를 시작했어도 된다) */
  release(holdId: string): Promise<Hold>
  /** `POST {base}/holds/{id}/confirm` - 무료 확정 */
  confirm(holdId: string): Promise<Hold>
  /** `POST {base}/holds/{id}/cancel` - 무료 확정 취소(판매 끝 전까지) */
  cancel(holdId: string): Promise<Hold>
}

export type BookingApiOptions = {
  /** 컨트롤러 경로(기본 `/booking`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 예약 HTTP 호출. 로그인 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createBookingApi(
  client: BookingClient,
  { basePath = '/booking' }: BookingApiOptions = {},
): BookingApi {
  const base = basePath.replace(/\/+$/, '')
  const pool = (id: string) => `${base}/pools/${encodeURIComponent(id)}`
  const hold = (id: string) => `${base}/holds/${encodeURIComponent(id)}`
  const post = (path: string) => client.value<Hold>(path, { method: 'POST' })
  return {
    pool: (poolId) => client.value<Pool>(pool(poolId)),
    snapshot: (poolId) => client.value<SeatSnapshot>(`${pool(poolId)}/seats`),
    streamUrl: (poolId) => client.endpoint(`${pool(poolId)}/seats/stream`),
    addSeats: (poolId, seatIds, entryToken) =>
      client.value<Hold>(`${pool(poolId)}/hold/seats`, {
        method: 'POST',
        json: { seatIds },
        headers: createEntryHeaders(entryToken),
      }),
    removeSeat: (poolId, seatId) =>
      client.value<Hold>(`${pool(poolId)}/hold/seats/${encodeURIComponent(seatId)}`, {
        method: 'DELETE',
      }),
    myHolds: () => client.list<Hold>(`${base}/holds/me`),
    checkout: (holdId) => post(`${hold(holdId)}/checkout`),
    release: (holdId) => post(`${hold(holdId)}/release`),
    confirm: (holdId) => post(`${hold(holdId)}/confirm`),
    cancel: (holdId) => post(`${hold(holdId)}/cancel`),
  }
}
