import { Alert, Button, Skeleton } from '@skeleton/ui'
import { useReviewFilters, type ReviewFilters } from './filters'
import { defaultReviewsLabels, type ReviewsLabels } from './labels'
import { useRemoveReview, useReportReview, useReviews, useSetHelpful } from './queries'
import type { ReviewsApi } from './reviewsApi'
import type { ReviewItemProps } from './ReviewItem'
import { ReviewListView, type ReviewListViewProps } from './ReviewListView'
import type { ReportReason, ReviewTarget } from './types'

export type ReviewListProps = {
  api: Pick<ReviewsApi, 'listReviews' | 'setHelpful' | 'reportReview' | 'removeReview'>
  target: ReviewTarget
  labels?: ReviewsLabels
  /**
   * 목록 조건. `ReviewSummary` 의 분포 막대와 같은 것을 쓰려면 위에서 `useReviewFilters()` 로 만들어 둘에 건넨다.
   * 안 주면 자기 것을 쥔다
   */
  filters?: ReviewFilters
  /** 로그인했는가 - 아니면 도움돼요 · 신고 단추를 그리지 않는다(서버가 401). 기본 아니다 */
  signedIn?: boolean
  /** 서버 설정의 신고 사유(`useReviewConfig().data.reportReasons`) */
  reportReasons?: ReportReason[]
  /** 내 리뷰 고치기를 누르면 - 폼(`ReviewForm`)을 여는 것은 앱의 몫 */
  onEdit?: ReviewItemProps['onEdit']
  renderPhoto?: ReviewItemProps['renderPhoto']
  locale?: string
  /** 한 쪽의 개수 */
  pageSize?: number
  /** 빈 상태 제목 단계(기본 3) */
  emptyHeadingLevel?: ReviewListViewProps['emptyHeadingLevel']
}

/** 대상 하나의 리뷰 목록 — 서버에서 가져와 정렬 · 거르기 · 쪽 이동 · 도움돼요 · 신고 · 지우기까지 이어 준다 */
export function ReviewList({
  api,
  target,
  labels = defaultReviewsLabels,
  filters: given,
  signedIn = false,
  reportReasons,
  onEdit,
  renderPhoto,
  locale,
  pageSize,
  emptyHeadingLevel,
}: ReviewListProps) {
  const own = useReviewFilters()
  const filters = given ?? own
  const params = pageSize === undefined ? filters.params : { ...filters.params, size: pageSize }
  const query = useReviews(api, target, params)
  const helpful = useSetHelpful(api)
  const report = useReportReview(api)
  const remove = useRemoveReview(api)

  if (query.isPending) return <Skeleton lines={4} label={labels.loading} />
  if (query.isError)
    return (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {labels.retry}
          </Button>
        }
      >
        {labels.loadFailed}
      </Alert>
    )
  return (
    <ReviewListView
      reviews={query.data.values}
      pagination={query.data.pagination}
      filters={filters}
      labels={labels}
      fetching={query.isFetching}
      emptyHeadingLevel={emptyHeadingLevel}
      helpfulPendingId={helpful.isPending ? (helpful.variables?.id ?? null) : null}
      item={{
        locale,
        renderPhoto,
        onEdit,
        onDelete: (review) => remove.mutateAsync(review.id),
        ...(signedIn
          ? {
              reportReasons,
              onToggleHelpful: (review, next) => helpful.mutate({ id: review.id, helpful: next }),
              onReport: (review, input) => report.mutateAsync({ id: review.id, input }),
            }
          : {}),
      }}
    />
  )
}
