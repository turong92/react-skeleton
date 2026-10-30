/** 리뷰를 다는 대상 — 종류(`product` …)와 그 종류 안의 id. 어떤 종류가 열려 있는지는 서버 설정(`targetTypes`)이 안다 */
export type ReviewTarget = { type: string; id: string }

/** 신고 사유 코드 — 서버 `reportReasons` 가 알려 준다(문구는 labels) */
export type ReportReason = 'SPAM' | 'ABUSE' | 'PRIVACY' | 'OFF_TOPIC' | 'OTHER'
export const REPORT_REASONS: readonly ReportReason[] = [
  'SPAM',
  'ABUSE',
  'PRIVACY',
  'OFF_TOPIC',
  'OTHER',
]

/** 이 사람이 지금 리뷰를 쓸 수 없는 까닭(서버가 `summary.writeBlockedReason` 으로 알려 준다) */
export type WriteBlockedReason = 'PURCHASE_REQUIRED' | 'ALREADY_WRITTEN' | 'LOCKED' | 'SIGN_IN'

/** `GET /config` */
export type ReviewConfig = {
  targetTypes: string[]
  bodyMinLength: number
  bodyMaxLength: number
  maxPhotos: number
  reportReasons: ReportReason[]
  canModerate: boolean
  canReply: boolean
}

export type Rating = 1 | 2 | 3 | 4 | 5
export const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5]

/** `GET /targets/{type}/{id}/summary` — `average` 는 소수 한 자리(리뷰가 없으면 null) */
export type TargetSummary = {
  count: number
  average: number | null
  distribution: Record<Rating, number>
  myReviewId: string | null
  canWrite: boolean
  writeBlockedReason: WriteBlockedReason | null
}

/** `GET /summaries` 의 한 줄 — 목록 화면의 별점 한 줄용 */
export type TargetRating = {
  targetType: string
  targetId: string
  count: number
  average: number | null
}

export type ReviewSort = 'recent' | 'helpful' | 'rating_high' | 'rating_low'
export const REVIEW_SORTS: readonly ReviewSort[] = [
  'recent',
  'helpful',
  'rating_high',
  'rating_low',
]

export type ReviewListParams = {
  sort?: ReviewSort
  /** 이 별점만 */
  rating?: Rating
  /** 구매 인증만 */
  verified?: boolean
  /** 사진 있는 것만 */
  photo?: boolean
  /** 0 부터 */
  page?: number
  size?: number
}

/** 운영자 답글(리뷰당 하나) */
export type ReviewReply = { body: string; createdAt: string; updatedAt: string }

/** 리뷰 상태 — 남에게는 `PUBLISHED` 만 온다. 작성자 본인 · 운영자에게만 `status` 가 실린다 */
export type ReviewStatus = 'PUBLISHED' | 'HIDDEN' | 'DELETED'

/**
 * 사진 한 칸. 보려면 `reviewsApi.photoPath(reviewId, index)` (서버가 짧은 서명 주소로 302).
 * 저장 키 `key` 는 작성자 본인 줄에만 실린다 - 고치기 폼이 기존 사진을 유지하려면 이 키가 필요하다
 */
export type ReviewPhoto = { index: number; key?: string }

/** 리뷰 한 줄 — 계정 id 는 어떤 응답에도 없다 */
export type Review = {
  id: string
  rating: Rating
  body: string
  verified: boolean
  helpfulCount: number
  /** 내가 도움돼요를 눌렀다 */
  helpful: boolean
  /** 내 리뷰다(서버가 판정) */
  mine: boolean
  authorName: string | null
  authorTag: string | null
  authorDeleted: boolean
  edited: boolean
  photos: ReviewPhoto[]
  reply: ReviewReply | null
  createdAt: string
  updatedAt: string
  /** 본인 · 운영자에게만 */
  status?: ReviewStatus
  moderationReason?: string | null
}

/** `GET /me` 의 한 줄 — 어느 대상의 리뷰인지가 더 실린다 */
export type MyReview = Review & { targetType: string; targetId: string }

/** 쓰기 · 고치기 입력. `photos` 는 앱이 `@skeleton/storage` 로 올려 얻은 저장 키 */
export type ReviewInput = { rating: Rating; body: string; photos?: string[] }
export type ReviewPatch = Partial<ReviewInput>

export type HelpfulState = { helpfulCount: number; helpful: boolean }

export type ReportInput = { reason: ReportReason; detail?: string }
