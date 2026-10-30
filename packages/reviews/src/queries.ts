import type { ApiPageResponse } from '@skeleton/api-client'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { patchHelpful } from './helpfulCache'
import type { CreateReviewOptions, ReviewsApi } from './reviewsApi'
import type {
  Review,
  ReviewInput,
  ReviewListParams,
  ReviewPatch,
  ReviewTarget,
  ReportInput,
} from './types'

/** 리뷰 쿼리 키의 뿌리 — 쓰기 · 고치기 · 지우기 · 신고는 이 접두어로 한꺼번에 다시 가져온다 */
export const reviewKeys = {
  all: ['reviews'] as const,
  config: () => [...reviewKeys.all, 'config'] as const,
  summary: (target: ReviewTarget) =>
    [...reviewKeys.all, 'summary', target.type, target.id] as const,
  summaries: (targets: ReviewTarget[]) =>
    [...reviewKeys.all, 'summaries', targets.map((t) => `${t.type}:${t.id}`).join(',')] as const,
  lists: () => [...reviewKeys.all, 'list'] as const,
  list: (target: ReviewTarget, params: ReviewListParams) =>
    [...reviewKeys.lists(), target.type, target.id, params] as const,
  mine: () => [...reviewKeys.all, 'me'] as const,
}

/** 서버 설정 — 어떤 대상 종류가 열려 있는지 · 길이 한도 · 사진 수 · 신고 사유 · 내 권한 */
export function useReviewConfig(api: Pick<ReviewsApi, 'getConfig'>) {
  return useQuery({
    queryKey: reviewKeys.config(),
    queryFn: () => api.getConfig(),
    staleTime: 60_000,
  })
}

/** 한 대상의 평균 · 분포 · 내 리뷰 · 쓸 수 있는지 */
export function useReviewSummary(api: Pick<ReviewsApi, 'getSummary'>, target: ReviewTarget) {
  return useQuery({ queryKey: reviewKeys.summary(target), queryFn: () => api.getSummary(target) })
}

/** 여러 대상의 별점 한 줄(≤ 50) — 목록 화면용 */
export function useTargetRatings(api: Pick<ReviewsApi, 'listSummaries'>, targets: ReviewTarget[]) {
  return useQuery({
    queryKey: reviewKeys.summaries(targets),
    queryFn: () => api.listSummaries(targets),
    enabled: targets.length > 0,
  })
}

/** 한 쪽의 리뷰 — 조건을 바꾸는 동안 앞 쪽을 그대로 보여 준다(깜빡임 없이) */
export function useReviews(
  api: Pick<ReviewsApi, 'listReviews'>,
  target: ReviewTarget,
  params: ReviewListParams,
) {
  return useQuery({
    queryKey: reviewKeys.list(target, params),
    queryFn: () => api.listReviews(target, params),
    placeholderData: keepPreviousData,
  })
}

/** 내 리뷰 — 커서로 이어 받는다 */
export function useMyReviews(api: Pick<ReviewsApi, 'myReviews'>) {
  return useInfiniteQuery({
    queryKey: reviewKeys.mine(),
    queryFn: ({ pageParam }) => api.myReviews(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.cursor.hasNext ? (last.cursor.nextCursor ?? undefined) : undefined,
  })
}

/** 리뷰가 바뀌면 요약(평균 · 분포) · 목록 · 내 리뷰가 다 낡는다 */
function useInvalidateReviews() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: reviewKeys.all })
}

export function useCreateReview(api: Pick<ReviewsApi, 'createReview'>, target: ReviewTarget) {
  const invalidate = useInvalidateReviews()
  return useMutation({
    mutationFn: ({ input, options }: { input: ReviewInput; options?: CreateReviewOptions }) =>
      api.createReview(target, input, options),
    onSuccess: invalidate,
  })
}

export function useUpdateReview(api: Pick<ReviewsApi, 'updateReview'>) {
  const invalidate = useInvalidateReviews()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ReviewPatch }) => api.updateReview(id, patch),
    onSuccess: invalidate,
  })
}

export function useRemoveReview(api: Pick<ReviewsApi, 'removeReview'>) {
  const invalidate = useInvalidateReviews()
  return useMutation({
    mutationFn: (id: string) => api.removeReview(id),
    onSuccess: invalidate,
  })
}

/**
 * 도움돼요 누르기 · 떼기 — 응답이 서버가 센 값이라 목록 캐시의 그 줄에 그대로 꽂는다(다시 가져오지 않는다).
 * 정렬이 도움돼요순이어도 순서는 다음에 가져올 때 바뀐다 - 누른 줄이 눈앞에서 튀지 않게
 */
export function useSetHelpful(api: Pick<ReviewsApi, 'setHelpful'>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, helpful }: { id: string; helpful: boolean }) => api.setHelpful(id, helpful),
    onSuccess: (state, { id }) => {
      client.setQueriesData<ApiPageResponse<Review>>({ queryKey: reviewKeys.lists() }, (page) =>
        patchHelpful(page, id, state),
      )
    },
  })
}

/** 신고 — 보이는 것이 바뀌지 않는다(운영자가 본다) */
export function useReportReview(api: Pick<ReviewsApi, 'reportReview'>) {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReportInput }) => api.reportReview(id, input),
  })
}
