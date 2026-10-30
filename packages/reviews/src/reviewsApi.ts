import {
  newIdempotencyKey,
  type ApiClient,
  type ApiCursorResponse,
  type ApiPageResponse,
} from '@skeleton/api-client'
import type {
  HelpfulState,
  MyReview,
  ReportInput,
  Review,
  ReviewConfig,
  ReviewInput,
  ReviewListParams,
  ReviewPatch,
  ReviewTarget,
  TargetRating,
  TargetSummary,
} from './types'

type ReviewsClient = Pick<ApiClient, 'value' | 'list' | 'page' | 'cursor' | 'noContent'>

/** 만들기에 붙는 `Idempotency-Key` — 같은 제출을 다시 보낼 때(더블클릭 · 재시도)만 같은 키를 넘긴다. 안 주면 새 키 */
export type CreateReviewOptions = { idempotencyKey?: string }

export type ReviewsApi = {
  /** `GET {basePath}/config` */
  getConfig(): Promise<ReviewConfig>
  /** `GET {basePath}/targets/{type}/{id}/summary` — 평균 · 분포 · 내 리뷰 · 쓸 수 있는지 */
  getSummary(target: ReviewTarget): Promise<TargetSummary>
  /** `GET {basePath}/summaries?targets=type:id,…` — 한 번에 50 개까지(목록 화면의 별점 한 줄) */
  listSummaries(targets: ReviewTarget[]): Promise<TargetRating[]>
  /** `GET {basePath}/targets/{type}/{id}/reviews` — 페이지 envelope. 남에게는 공개 리뷰만 */
  listReviews(target: ReviewTarget, params?: ReviewListParams): Promise<ApiPageResponse<Review>>
  /** `POST …/reviews` — 계정 × 대상 하나(두 번째는 409 `REVIEW.ALREADY_WRITTEN`) */
  createReview(
    target: ReviewTarget,
    input: ReviewInput,
    options?: CreateReviewOptions,
  ): Promise<Review>
  /** `PATCH {basePath}/{id}` — 작성자만. 보낸 칸만 바뀐다 */
  updateReview(id: string, patch: ReviewPatch): Promise<Review>
  /** `DELETE {basePath}/{id}` — 204, 작성자만 */
  removeReview(id: string): Promise<void>
  /** `PUT`(누름) · `DELETE`(뗌) `{basePath}/{id}/helpful` — 응답은 서버가 센 값 */
  setHelpful(id: string, helpful: boolean): Promise<HelpfulState>
  /** `POST {basePath}/{id}/reports` — 204, 계정당 한 번(두 번째도 같은 204) */
  reportReview(id: string, input: ReportInput): Promise<void>
  /** `GET {basePath}/me?cursor` — 내 리뷰(대상 · 상태 · 숨김 사유 포함). 첫 쪽은 cursor 없이 */
  myReviews(cursor?: string): Promise<ApiCursorResponse<MyReview>>
  /**
   * 사진 한 칸의 경로 `{basePath}/{id}/photos/{index}` — 서버가 `302` 로 짧은 서명 주소에 넘긴다(`Cache-Control: private`).
   * 인증 헤더가 필요하니 `<img src>` 에 그대로 쓸 수 있는지는 앱의 인증 방식에 달렸다(쿠키 세션이면 바로, 토큰이면 앱이 가져와 blob 으로)
   */
  photoPath(id: string, index: number): string
}

export type ReviewsApiOptions = {
  /** 리뷰 컨트롤러의 경로(기본 `/reviews`, `/api/v1` 은 클라이언트의 baseUrl). 백엔드 `skeleton.review.http.base-path` 와 맞춘다 */
  basePath?: string
}

/** 값이 있는 조건만 보낸다 — 정하지 않은 정렬 · 걸러 보기 해제는 서버에 아무 말도 하지 않는다 */
const defined = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  )

/** 리뷰 HTTP 호출 모음. 토큰은 클라이언트의 `getAuthHeaders` 가 붙인다 */
export function createReviewsApi(
  client: ReviewsClient,
  { basePath = '/reviews' }: ReviewsApiOptions = {},
): ReviewsApi {
  const base = basePath.replace(/\/+$/, '')
  const enc = encodeURIComponent
  const targetBase = (target: ReviewTarget) =>
    `${base}/targets/${enc(target.type)}/${enc(target.id)}`
  const one = (id: string) => `${base}/${enc(id)}`

  return {
    getConfig: () => client.value<ReviewConfig>(`${base}/config`),
    getSummary: (target) => client.value<TargetSummary>(`${targetBase(target)}/summary`),
    listSummaries: (targets) =>
      client.list<TargetRating>(`${base}/summaries`, {
        params: { targets: targets.map((t) => `${t.type}:${t.id}`).join(',') },
      }),
    listReviews: (target, params = {}) =>
      client.page<Review>(`${targetBase(target)}/reviews`, { params: defined(params) }),
    createReview: (target, input, options) =>
      client.value<Review>(`${targetBase(target)}/reviews`, {
        method: 'POST',
        json: input,
        idempotencyKey: options?.idempotencyKey ?? newIdempotencyKey(),
      }),
    updateReview: (id, patch) => client.value<Review>(one(id), { method: 'PATCH', json: patch }),
    removeReview: (id) => client.noContent(one(id), { method: 'DELETE' }),
    setHelpful: (id, helpful) =>
      client.value<HelpfulState>(`${one(id)}/helpful`, { method: helpful ? 'PUT' : 'DELETE' }),
    reportReview: (id, input) =>
      client.noContent(`${one(id)}/reports`, { method: 'POST', json: input }),
    myReviews: (cursor) =>
      client.cursor<MyReview>(`${base}/me`, { params: cursor === undefined ? {} : { cursor } }),
    photoPath: (id, index) => `${one(id)}/photos/${index}`,
  }
}
