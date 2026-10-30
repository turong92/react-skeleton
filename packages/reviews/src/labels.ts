import type { ReportReason, ReviewSort, WriteBlockedReason } from './types'
import { defaultReviewsLabels } from './labels.en'

export type ReviewsLabels = {
  loading: string
  loadFailed: string
  retry: string
  rating: {
    /** 읽는 이름 — 「5점 만점에 4.3점」 */
    outOf: (value: string, max: number) => string
    /** 평점이 아직 없다 */
    none: string
    /** 별점 고르는 묶음의 이름 */
    group: string
    /** 라디오 한 칸의 이름 — 「3점」 */
    point: (value: number) => string
  }
  summary: {
    /** 「리뷰 12개」 */
    count: (count: number) => string
    empty: string
    /** 눌리지 않는 분포 한 줄의 읽는 이름 - 「5점 12개」 */
    row: (rating: number, count: number) => string
    /** 분포 막대 한 줄 — 「5점 12개 · 이 별점만 보기」 */
    bar: (rating: number, count: number) => string
    barActive: (rating: number, count: number) => string
  }
  list: {
    sortLabel: string
    sorts: Record<ReviewSort, string>
    filters: string
    verifiedOnly: string
    photoOnly: string
    /** 별점으로 거르는 중인 칩 — 누르면 풀린다 */
    ratingChip: (rating: number) => string
    clearFilters: string
    empty: string
    emptyFiltered: string
    pagination: string
    previous: string
    next: string
    page: (page: number) => string
  }
  item: {
    verified: string
    edited: string
    /** 도움돼요 단추 - 「도움돼요 3」 */
    helpful: (count: number) => string
    /** 내 리뷰에는 못 누른다 — 숫자만 보인다 */
    helpfulCount: (count: number) => string
    /** 줄 메뉴 단추의 이름 - 「Ada 리뷰 더보기」 */
    menu: (author: string) => string
    report: string
    edit: string
    remove: string
    removeTitle: string
    removeBody: string
    removeConfirm: string
    cancel: string
    close: string
    /** 내 리뷰가 운영자에게 숨겨졌다 */
    hiddenMine: string
    hiddenReason: (reason: string) => string
    anonymous: string
    authorDeleted: string
    reply: string
    photos: string
    photo: (n: number) => string
  }
  report: {
    title: string
    reason: string
    reasons: Record<ReportReason, string>
    detail: string
    detailHint: string
    submit: string
    reasonRequired: string
    sent: string
  }
  form: {
    rating: string
    ratingRequired: string
    body: string
    bodyHint: (min: number, max: number) => string
    bodyTooShort: (min: number) => string
    bodyTooLong: (max: number) => string
    photos: string
    submit: string
    save: string
    cancel: string
    sending: string
  }
  /** 쓸 수 없는 까닭 — `summary.writeBlockedReason` */
  writeBlocked: Record<WriteBlockedReason, string>
}

/** 앱이 준 일부 문구(안쪽도 일부만 가능) */
export type ReviewsLabelsInput = {
  [K in keyof ReviewsLabels]?: ReviewsLabels[K] extends (...args: never[]) => unknown
    ? ReviewsLabels[K]
    : ReviewsLabels[K] extends object
      ? Partial<ReviewsLabels[K]>
      : ReviewsLabels[K]
}

export { defaultReviewsLabels } from './labels.en'
export { koReviewsLabels } from './labels.ko'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function merge<T>(base: T, over: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(over)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over))
    if (value !== undefined) out[key] = merge(base[key], value)
  return out as T
}

export function resolveReviewsLabels(input: ReviewsLabelsInput = {}): ReviewsLabels {
  return merge<ReviewsLabels>(defaultReviewsLabels, input)
}
