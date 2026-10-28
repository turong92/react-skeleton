import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { rewardsRoot } from '../queryKeys'
import type { PointApi } from './pointApi'

export const pointKeys = {
  all: [...rewardsRoot, 'points'] as const,
  balance: () => [...pointKeys.all, 'balance'] as const,
  history: () => [...pointKeys.all, 'history'] as const,
}

/** 잔액과 곧 소멸할 포인트 */
export function usePoints(api: Pick<PointApi, 'points'>) {
  return useQuery({ queryKey: pointKeys.balance(), queryFn: () => api.points() })
}

/** 포인트 내역 — 커서로 이어 받는다(`fetchNextPage` · `hasNextPage`) */
export function usePointHistory(api: Pick<PointApi, 'pointHistory'>) {
  return useInfiniteQuery({
    queryKey: pointKeys.history(),
    queryFn: ({ pageParam }) => api.pointHistory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined,
  })
}
