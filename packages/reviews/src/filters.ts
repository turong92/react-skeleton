import { useCallback, useState } from 'react'
import type { Rating, ReviewListParams, ReviewSort } from './types'

/** 목록 조건이 바뀌면 첫 쪽으로 — 쪽만 옮길 때는 조건을 지킨다 */
const first = (params: ReviewListParams): ReviewListParams => ({ ...params, page: 0 })

export function withSort(params: ReviewListParams, sort: ReviewSort): ReviewListParams {
  return first({ ...params, sort })
}

/** 같은 별점을 다시 누르면 풀린다(분포 막대 · 칩이 같은 동작) */
export function toggleRating(params: ReviewListParams, rating: Rating): ReviewListParams {
  const { rating: current, ...rest } = params
  return first(current === rating ? rest : { ...rest, rating })
}

/** 꺼진 것은 `false` 가 아니라 없는 값으로 둔다 - 서버에는 아무 말도 가지 않는다 */
export function toggleFlag(params: ReviewListParams, flag: 'verified' | 'photo'): ReviewListParams {
  const { [flag]: current, ...rest } = params
  return first(current ? rest : { ...rest, [flag]: true })
}

export function setPage(params: ReviewListParams, page: number): ReviewListParams {
  return { ...params, page }
}

/** 정렬은 거르기가 아니다 */
export function hasFilters(params: ReviewListParams): boolean {
  return params.rating !== undefined || params.verified === true || params.photo === true
}

export function clearFilters(params: ReviewListParams): ReviewListParams {
  const rest = { ...params }
  delete rest.rating
  delete rest.verified
  delete rest.photo
  return first(rest)
}

export type ReviewFilters = {
  params: ReviewListParams
  setSort: (sort: ReviewSort) => void
  toggleRating: (rating: Rating) => void
  toggleFlag: (flag: 'verified' | 'photo') => void
  setPage: (page: number) => void
  clear: () => void
}

/**
 * 목록 조건 상태 한 벌 — `ReviewSummary`(분포 막대)와 `ReviewList`(칩 · 정렬 · 쪽)가 같은 것을 쥐도록 위에서 한 번 만들어 둘에 건넨다.
 * 안 넘기면 `ReviewList` 가 자기 것을 만든다.
 */
export function useReviewFilters(initial: ReviewListParams = { sort: 'recent' }): ReviewFilters {
  const [params, setParams] = useState<ReviewListParams>({ page: 0, ...initial })
  return {
    params,
    setSort: useCallback((sort) => setParams((p) => withSort(p, sort)), []),
    toggleRating: useCallback((rating) => setParams((p) => toggleRating(p, rating)), []),
    toggleFlag: useCallback((flag) => setParams((p) => toggleFlag(p, flag)), []),
    setPage: useCallback((page) => setParams((p) => setPage(p, page)), []),
    clear: useCallback(() => setParams((p) => clearFilters(p)), []),
  }
}
