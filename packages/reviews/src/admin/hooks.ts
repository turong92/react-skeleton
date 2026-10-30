import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reviewKeys } from '../queries'
import type { ReviewsAdminApi } from './adminApi'
import type { AdminReviewQueueName, ModerationInput } from './types'

export const adminReviewKeys = {
  all: [...reviewKeys.all, 'admin'] as const,
  queue: (queue: AdminReviewQueueName) => [...adminReviewKeys.all, 'queue', queue] as const,
}

/**
 * 운영 큐 — 커서로 이어 받는다. 다시 시도하지 않고, 404(그 모듈의 `admin.enabled` 가 꺼진 서버)는 오류 토스트로 알리지 않는다
 * (화면이 제자리에서 말한다 - 앱의 `createQueryClient` 가 `meta.quietStatuses` 를 읽는다)
 */
export function useAdminReviewQueue(
  api: Pick<ReviewsAdminApi, 'listReviews'>,
  queue: AdminReviewQueueName,
) {
  return useInfiniteQuery({
    queryKey: adminReviewKeys.queue(queue),
    queryFn: ({ pageParam }) => api.listReviews({ queue, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined,
    retry: false,
    meta: { quietStatuses: [404] },
  })
}

/**
 * 숨기기 · 되살리기 · 문제없음 · 답글 — 성공하면 운영 큐와 공개 리뷰(목록 · 요약 · 평균)를 다시 읽는다.
 * 숨기면 집계에서 빠지고, 답글은 공개 목록에 실리기 때문에 `reviewKeys.all` 전체를 무효화한다
 */
function useAfterChange() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: reviewKeys.all })
}

export function useModerateReview(api: Pick<ReviewsAdminApi, 'moderate'>) {
  const after = useAfterChange()
  return useMutation({
    mutationFn: (v: { id: string; input: ModerationInput }) => api.moderate(v.id, v.input),
    onSuccess: after,
  })
}

export function useDismissReports(api: Pick<ReviewsAdminApi, 'dismissReports'>) {
  const after = useAfterChange()
  return useMutation({ mutationFn: (id: string) => api.dismissReports(id), onSuccess: after })
}

export function useSetReply(api: Pick<ReviewsAdminApi, 'setReply'>) {
  const after = useAfterChange()
  return useMutation({
    mutationFn: (v: { id: string; body: string }) => api.setReply(v.id, v.body),
    onSuccess: after,
  })
}

export function useRemoveReply(api: Pick<ReviewsAdminApi, 'removeReply'>) {
  const after = useAfterChange()
  return useMutation({ mutationFn: (id: string) => api.removeReply(id), onSuccess: after })
}
