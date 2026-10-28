import type { ApiClient, ApiCursorResponse } from '@skeleton/api-client'
import type { PointBalanceValue, PointEntry } from '../types'

export type PointApi = {
  /** `GET {points}` */
  points(): Promise<PointBalanceValue>
  /** `GET {points}/history?cursor` — 첫 쪽은 cursor 없이 */
  pointHistory(cursor?: string): Promise<ApiCursorResponse<PointEntry>>
}

/** 포인트를 쓰는 길은 서버 API 뿐이라 여기에는 읽기만 있다 */
export function createPointApi(
  client: Pick<ApiClient, 'value' | 'cursor'>,
  { points = '/points' }: { points?: string } = {},
): PointApi {
  const base = points.replace(/\/+$/, '')
  return {
    points: () => client.value<PointBalanceValue>(base),
    pointHistory: (cursor) =>
      client.cursor<PointEntry>(`${base}/history`, {
        params: cursor === undefined ? {} : { cursor },
      }),
  }
}
