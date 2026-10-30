import { Button, EmptyState, Field, Pagination, Select } from '@skeleton/ui'
import type { PaginationMeta } from '@skeleton/api-client'
import type { ReviewFilters } from './filters'
import { hasFilters } from './filters'
import type { ReviewsLabels } from './labels'
import { ReviewItem, type ReviewItemProps } from './ReviewItem'
import { REVIEW_SORTS, type Review, type ReviewSort } from './types'
import styles from './ReviewListView.module.css'

/** `ReviewItem` 에 그대로 건네는 동작들 - 줄마다 다른 것은 뺀다 */
export type ReviewItemActions = Omit<ReviewItemProps, 'review' | 'labels' | 'helpfulPending'>

export type ReviewListViewProps = {
  reviews: Review[]
  /** 없으면 쪽 이동을 그리지 않는다 */
  pagination?: PaginationMeta
  filters: ReviewFilters
  labels: ReviewsLabels
  /** 다음 쪽 · 조건을 불러오는 중 - 앞 쪽을 흐리게 둔다 */
  fetching?: boolean
  item?: ReviewItemActions
  /** 도움돼요 요청이 가는 중인 리뷰 id */
  helpfulPendingId?: string | null
}

/** 리뷰 목록의 모양 - 정렬 · 거르기 칩 · 줄들 · 쪽 이동 · 빈 상태(데이터는 `ReviewList` 가 가져온다) */
export function ReviewListView({
  reviews,
  pagination,
  filters,
  labels,
  fetching = false,
  item,
  helpfulPendingId = null,
}: ReviewListViewProps) {
  const t = labels.list
  const { params } = filters
  const filtered = hasFilters(params)

  if (reviews.length === 0 && !filtered) return <EmptyState title={t.empty} />

  const chip = (pressed: boolean, label: string, onClick: () => void) => (
    <Button
      variant="secondary"
      size="sm"
      aria-pressed={pressed}
      className={styles.chip}
      onClick={onClick}
    >
      {pressed ? '✓ ' : ''}
      {label}
    </Button>
  )

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Field label={t.sortLabel}>
          {(control) => (
            <Select
              {...control}
              value={params.sort ?? 'recent'}
              onChange={(event) => filters.setSort(event.target.value as ReviewSort)}
            >
              {REVIEW_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {t.sorts[sort]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className={styles.chips} role="group" aria-label={t.filters}>
          {chip(params.verified === true, t.verifiedOnly, () => filters.toggleFlag('verified'))}
          {chip(params.photo === true, t.photoOnly, () => filters.toggleFlag('photo'))}
          {params.rating !== undefined &&
            chip(true, t.ratingChip(params.rating), () => filters.toggleRating(params.rating!))}
          {filtered && (
            <Button variant="ghost" size="sm" onClick={filters.clear}>
              {t.clearFilters}
            </Button>
          )}
        </div>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          title={t.emptyFiltered}
          action={
            <Button variant="secondary" onClick={filters.clear}>
              {t.clearFilters}
            </Button>
          }
        />
      ) : (
        <ul className={styles.list} aria-busy={fetching || undefined} data-fetching={fetching}>
          {reviews.map((review) => (
            <li key={review.id} className={styles.row}>
              <ReviewItem
                {...item}
                review={review}
                labels={labels}
                helpfulPending={helpfulPendingId === review.id}
              />
            </li>
          ))}
        </ul>
      )}

      {pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={filters.setPage}
          label={t.pagination}
          previousLabel={t.previous}
          nextLabel={t.next}
          pageLabel={t.page}
        />
      )}
    </div>
  )
}
