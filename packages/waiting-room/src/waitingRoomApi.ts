import type { ApiClient } from '@skeleton/api-client'
import type { WaitingRoomStatus } from './types'

type WaitingRoomClient = Pick<ApiClient, 'value'>

export type WaitingRoomApi = {
  /** `POST {base}/{id}/tickets` - 로그인한 계정의 순번표(답의 `ticket`). 같은 계정이 또 받으면 같은 순번표, 입장 시간이 끝났으면 맨 뒤의 새것. 409 `WAITING_ROOM.NOT_OPEN` · `CLOSED` */
  takeTicket(roomId: string): Promise<WaitingRoomStatus>
  /** `GET {base}/{id}/status` (헤더 `X-Ticket`) - 순번표가 위조 · 남의 것이면 403 `WAITING_ROOM.TICKET_INVALID` */
  status(roomId: string, ticketToken: string): Promise<WaitingRoomStatus>
}

export type WaitingRoomApiOptions = {
  /** 컨트롤러 경로(기본 `/waiting-rooms`, `/api/v1` 은 클라이언트의 baseUrl) */
  basePath?: string
}

/** 대기열 HTTP 호출. 로그인 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createWaitingRoomApi(
  client: WaitingRoomClient,
  { basePath = '/waiting-rooms' }: WaitingRoomApiOptions = {},
): WaitingRoomApi {
  const base = basePath.replace(/\/+$/, '')
  const room = (roomId: string) => `${base}/${encodeURIComponent(roomId)}`
  return {
    takeTicket: (roomId) =>
      client.value<WaitingRoomStatus>(`${room(roomId)}/tickets`, { method: 'POST' }),
    status: (roomId, ticketToken) =>
      client.value<WaitingRoomStatus>(`${room(roomId)}/status`, {
        headers: { 'X-Ticket': ticketToken },
      }),
  }
}
