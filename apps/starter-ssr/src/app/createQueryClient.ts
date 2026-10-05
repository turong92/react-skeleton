import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

/**
 * 모든 쿼리/뮤테이션 에러를 `onError`(보통 토스트)로 모은다 — 컴포넌트마다 에러 처리를 쓰지 않아도 된다.
 * 서버 렌더는 `onError` 가 필요 없다(토스트는 브라우저의 것) — 생략하면 에러는 조용히 캐시에만 남는다.
 * `staleTime` 이 있으면 그 시간 동안 데이터를 신선하게 본다 — 서버가 채워 보낸 데이터를 하이드레이션 직후에 다시 부르지 않는다.
 */
export function createQueryClient({
  onError,
  staleTime,
}: {
  onError?: (error: unknown) => void
  staleTime?: number
} = {}): QueryClient {
  // 캐시는 onError 에 (error, query …) 여러 인자를 넘긴다 — 핸들러에는 에러만 건넨다
  const forward = (error: unknown) => onError?.(error)
  return new QueryClient({
    queryCache: new QueryCache({ onError: forward }),
    mutationCache: new MutationCache({ onError: forward }),
    defaultOptions: staleTime === undefined ? undefined : { queries: { staleTime } },
  })
}
