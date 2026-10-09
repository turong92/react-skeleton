import type { ApiClient, ApiCursorResponse } from '@skeleton/api-client'
import type { Cheer, CheerListParams, CheerOption } from './types'

export type CheerApi = {
  /** `GET {basePath}/options` — 서버가 정한 응원 금액 목록 */
  options(): Promise<CheerOption[]>
  /** `GET {basePath}/me?cursor&size` — 내 응원 내역(최신순, 커서) */
  mine(params?: CheerListParams): Promise<ApiCursorResponse<Cheer>>
}

/** 견본 앱의 응원 API(`apps/sample` 백엔드의 `cheer/`). 결제 자체는 `@skeleton/payment` 의 장부 API 가 맡고, 여기는 금액 목록과 내 응원 기록만 안다 */
export function createCheerApi(
  client: Pick<ApiClient, 'list' | 'cursor'>,
  { basePath = '/cheers' }: { basePath?: string } = {},
): CheerApi {
  const base = basePath.replace(/\/+$/, '')
  return {
    options: () => client.list<CheerOption>(`${base}/options`),
    mine: ({ cursor, size } = {}) =>
      client.cursor<Cheer>(`${base}/me`, {
        params: {
          ...(cursor !== undefined ? { cursor } : {}),
          ...(size !== undefined ? { size } : {}),
        },
      }),
  }
}
