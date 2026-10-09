import type { ApiCursorResponse } from '@skeleton/api-client'
import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { cheerApi } from './api'
import type { CheerApi } from './cheerApi'
import type { Cheer, CheerListParams } from './types'

/** 키는 `cheers` 한 뿌리 아래 — 결제가 끝나면 한 번에 무효화한다 */
export const cheerKeys = {
  all: ['cheers'] as const,
  options: () => [...cheerKeys.all, 'options'] as const,
  mine: (params: Omit<CheerListParams, 'cursor'> = {}) =>
    [...cheerKeys.all, 'mine', params] as const,
}

export const cheerOptionsQuery = (api: CheerApi) => ({
  queryKey: cheerKeys.options(),
  queryFn: () => api.options(),
})

export const myCheersQuery = (api: CheerApi, params: Omit<CheerListParams, 'cursor'> = {}) => ({
  queryKey: cheerKeys.mine(params),
  queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
    api.mine({ ...params, ...(pageParam !== undefined ? { cursor: pageParam } : {}) }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last: ApiCursorResponse<Cheer>): string | undefined =>
    last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined,
})

export function invalidateCheers(client: QueryClient) {
  return client.invalidateQueries({ queryKey: cheerKeys.all })
}

/** 금액 목록 — 서버가 정한 것. 자주 안 바뀌어서 한 번 받은 것을 한동안 그대로 쓴다 */
export function useCheerOptions() {
  return useQuery({ ...cheerOptionsQuery(cheerApi), staleTime: 5 * 60_000 })
}

/** 내 응원 내역(커서 이어받기) */
export function useMyCheers(params: Omit<CheerListParams, 'cursor'> = {}) {
  return useInfiniteQuery(myCheersQuery(cheerApi, params))
}
