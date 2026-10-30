import type { ApiClient, ApiCursorResponse } from '@skeleton/api-client'
import type { AdminReview, AdminReviewQuery, ModerationInput } from './types'

type AdminClient = Pick<ApiClient, 'cursor' | 'noContent'>

export type ReviewsAdminApi = {
  /** `GET {basePath}?queue=reported|hidden|all&targetType&cursor` (`review.moderate`) — 최근 신고 순 */
  listReviews(query: AdminReviewQuery): Promise<ApiCursorResponse<AdminReview>>
  /** `PUT {basePath}/{id}/moderation {status, reason}` — 숨기기(사유 필수) · 되살리기. 204 */
  moderate(id: string, input: ModerationInput): Promise<void>
  /** `POST {basePath}/{id}/reports/dismiss` — 「문제없음」, 신고를 본 것으로 친다. 204 */
  dismissReports(id: string): Promise<void>
  /** `PUT {basePath}/{id}/reply {body}` (`review.reply`) — 리뷰당 답글 하나(있으면 고친다). 204 */
  setReply(id: string, body: string): Promise<void>
  /** `DELETE {basePath}/{id}/reply` (`review.reply`). 204 */
  removeReply(id: string): Promise<void>
}

export type ReviewsAdminApiOptions = {
  /** 운영 컨트롤러의 경로(기본 `/admin/reviews`, `/api/v1` 은 클라이언트의 baseUrl). 백엔드 `skeleton.review.admin.enabled=true` 가 있어야 열린다 */
  basePath?: string
}

/** 리뷰 운영 HTTP 호출 모음. 토큰은 클라이언트가 붙인다 */
export function createReviewsAdminApi(
  client: AdminClient,
  { basePath = '/admin/reviews' }: ReviewsAdminApiOptions = {},
): ReviewsAdminApi {
  const base = basePath.replace(/\/+$/, '')
  const one = (id: string) => `${base}/${encodeURIComponent(id)}`
  return {
    listReviews: ({ queue, targetType, cursor }) =>
      client.cursor<AdminReview>(base, {
        params: {
          queue,
          ...(targetType ? { targetType } : {}),
          ...(cursor ? { cursor } : {}),
        },
      }),
    moderate: (id, input) =>
      client.noContent(`${one(id)}/moderation`, { method: 'PUT', json: input }),
    dismissReports: (id) => client.noContent(`${one(id)}/reports/dismiss`, { method: 'POST' }),
    setReply: (id, body) => client.noContent(`${one(id)}/reply`, { method: 'PUT', json: { body } }),
    removeReply: (id) => client.noContent(`${one(id)}/reply`, { method: 'DELETE' }),
  }
}
