import { MutationCache, QueryCache, QueryClient, type Query } from '@tanstack/react-query'

/** 이 쿼리가 「정상으로 칠」 상태 코드를 `meta.quietStatuses` 로 적었는가 — 예: legal 모듈이 없는 백엔드의 404 · 401 은 오류가 아니라 「그 기능이 없다」 */
const isExpected = (error: unknown, source?: { meta?: Record<string, unknown> }) => {
  const quiet = source?.meta?.quietStatuses
  const status = (error as { apiError?: { status?: number } } | null)?.apiError?.status
  return Array.isArray(quiet) && status !== undefined && quiet.includes(status)
}

/**
 * 모든 쿼리/뮤테이션 에러를 `onError`(보통 토스트)로 모은다 — 컴포넌트마다 에러 처리를 쓰지 않아도 된다.
 * 특정 쿼리만 조용히 하려면 그 쿼리에서 `meta` 로 표시하고 `onError` 에서 거른다.
 */
export function createQueryClient({ onError }: { onError: (error: unknown) => void }): QueryClient {
  // 캐시는 onError 에 (error, query …) 여러 인자를 넘긴다 — 핸들러에는 에러만 건넨다(쿼리가 정상으로 친 상태 코드는 거른다)
  const forward = (
    error: unknown,
    _variables: unknown,
    _context: unknown,
    mutation?: { meta?: Record<string, unknown> },
  ) => {
    if (!isExpected(error, mutation)) onError(error)
  }
  const forwardQuery = (
    error: unknown,
    query: Query<unknown, unknown, unknown, readonly unknown[]>,
  ) => {
    if (!isExpected(error, query)) onError(error)
  }
  return new QueryClient({
    queryCache: new QueryCache({ onError: forwardQuery }),
    mutationCache: new MutationCache({ onError: forward }),
  })
}
