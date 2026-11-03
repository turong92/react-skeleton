import type { ApiClient } from '@skeleton/api-client'
import type { WaitingRoomStats } from './types'

type AdminClient = Pick<ApiClient, 'value' | 'noContent'>

export type WaitingRoomAdminApi = {
  /** `GET {base}/{id}/stats` (`waiting-room.manage`) */
  stats(roomId: string): Promise<WaitingRoomStats>
  /** `POST {base}/{id}/rate {perMinute}` - 0 이면 멈춘다. 이미 들어온 사람의 입장권은 그대로 */
  setRate(roomId: string, perMinute: number): Promise<void>
  /** `POST {base}/{id}/close` - 닫으면 되돌릴 수 없다 */
  close(roomId: string): Promise<void>
}

export type WaitingRoomAdminApiOptions = {
  /** 컨트롤러 경로(기본 `/admin/waiting-rooms`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 대기실 운영 HTTP 호출 - 서버는 `skeleton.waiting-room.admin.enabled` 가 켜져 있고 `waiting-room.manage` 권한이 있어야 연다 */
export function createWaitingRoomAdminApi(
  client: AdminClient,
  { basePath = '/admin/waiting-rooms' }: WaitingRoomAdminApiOptions = {},
): WaitingRoomAdminApi {
  const base = basePath.replace(/\/+$/, '')
  const room = (roomId: string) => `${base}/${encodeURIComponent(roomId)}`
  return {
    stats: (roomId) => client.value<WaitingRoomStats>(`${room(roomId)}/stats`),
    setRate: (roomId, perMinute) =>
      client.noContent(`${room(roomId)}/rate`, { method: 'POST', json: { perMinute } }),
    close: (roomId) => client.noContent(`${room(roomId)}/close`, { method: 'POST' }),
  }
}
