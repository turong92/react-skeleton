import type { ApiClient } from '@skeleton/api-client'
import type { AdminPool, NewPool, NewSeat, PoolStats, PoolUpdate } from './types'

type AdminClient = Pick<ApiClient, 'value' | 'list'>

export type BookingAdminApi = {
  /** `GET {base}` (`booking.read`) - 최신순 */
  list(): Promise<AdminPool[]>
  /** `POST {base}` (`booking.manage`) */
  create(input: NewPool): Promise<AdminPool>
  /** `PATCH {base}/{id}` - 넣은 값만 바뀐다 */
  update(poolId: string, input: PoolUpdate): Promise<AdminPool>
  /** `POST {base}/{id}/seats {seats}` - 같은 구역 · 열 · 번호가 있으면 409 `BOOKING.SEAT_EXISTS`(아무것도 안 들어간다) */
  addSeats(poolId: string, seats: NewSeat[]): Promise<{ added: number }>
  /** `POST {base}/{id}/seats/block {seatIds}` - 잡히거나 팔린 자리는 409 `BOOKING.SEAT_IN_USE` */
  block(poolId: string, seatIds: string[]): Promise<{ changed: number }>
  /** `POST {base}/{id}/seats/unblock {seatIds}` */
  unblock(poolId: string, seatIds: string[]): Promise<{ changed: number }>
  /** `GET {base}/{id}/stats` (`booking.read`) */
  stats(poolId: string): Promise<PoolStats>
}

export type BookingAdminApiOptions = {
  /** 컨트롤러 경로(기본 `/admin/booking/pools`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 예약 운영 HTTP 호출 - 서버는 `skeleton.booking.admin.enabled` 가 켜져 있고 `booking.manage` · `booking.read` 권한이 있어야 연다 */
export function createBookingAdminApi(
  client: AdminClient,
  { basePath = '/admin/booking/pools' }: BookingAdminApiOptions = {},
): BookingAdminApi {
  const base = basePath.replace(/\/+$/, '')
  const pool = (id: string) => `${base}/${encodeURIComponent(id)}`
  return {
    list: () => client.list<AdminPool>(base),
    create: (input) => client.value<AdminPool>(base, { method: 'POST', json: input }),
    update: (poolId, input) =>
      client.value<AdminPool>(pool(poolId), { method: 'PATCH', json: input }),
    addSeats: (poolId, seats) =>
      client.value<{ added: number }>(`${pool(poolId)}/seats`, { method: 'POST', json: { seats } }),
    block: (poolId, seatIds) =>
      client.value<{ changed: number }>(`${pool(poolId)}/seats/block`, {
        method: 'POST',
        json: { seatIds },
      }),
    unblock: (poolId, seatIds) =>
      client.value<{ changed: number }>(`${pool(poolId)}/seats/unblock`, {
        method: 'POST',
        json: { seatIds },
      }),
    stats: (poolId) => client.value<PoolStats>(`${pool(poolId)}/stats`),
  }
}
