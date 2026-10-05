import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

/**
 * 모든 쿼리/뮤테이션 에러를 `onError`(보통 토스트)로 모은다 — 컴포넌트마다 에러 처리를 쓰지 않아도 된다.
 * 특정 쿼리만 조용히 하려면 그 쿼리에서 `meta` 로 표시하고 `onError` 에서 거른다.
 */
export function createQueryClient({ onError }: { onError: (error: unknown) => void }): QueryClient {
  // 캐시는 onError 에 (error, query …) 여러 인자를 넘긴다 — 핸들러에는 에러만 건넨다
  const forward = (error: unknown) => onError(error)
  return new QueryClient({
    queryCache: new QueryCache({ onError: forward }),
    mutationCache: new MutationCache({ onError: forward }),
  })
}
