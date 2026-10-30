import type { Rating, ReportReason, ReviewReply, ReviewStatus } from '../types'

/** 운영 목록의 큐 — 신고(아직 안 본 것) · 숨긴 것 · 전부 */
export type AdminReviewQueueName = 'reported' | 'hidden' | 'all'
export const ADMIN_QUEUES: readonly AdminReviewQueueName[] = ['reported', 'hidden', 'all']

export type AdminReviewQuery = {
  queue: AdminReviewQueueName
  targetType?: string
  cursor?: string
}

/**
 * `GET /admin/reviews` 의 한 줄 — 운영자가 보는 리뷰(신고 수 · 사유별 수 · 최근 신고 포함).
 * 계정 id 는 없다. `accountLabel` 은 서버가 `account.read` 도 가진 운영자에게만 준다(아니면 null)
 */
export type AdminReview = {
  id: string
  targetType: string
  targetId: string
  rating: Rating
  body: string
  status: ReviewStatus
  moderationReason: string | null
  reportCount: number
  /** 사유별 신고 수 — 없는 사유는 빠져 있다 */
  reportReasons: Partial<Record<ReportReason, number>>
  lastReportedAt: string | null
  accountLabel: string | null
  reply: ReviewReply | null
  createdAt: string
}

/** `PUT /admin/reviews/{id}/moderation` — 숨길 때만 사유(필수) */
export type ModerationInput =
  | { status: 'HIDDEN'; reason: string }
  | { status: 'PUBLISHED'; reason?: undefined }
