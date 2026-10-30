import type { ReportReason, ReviewStatus } from '../types'
import type { AdminReviewQueueName } from './types'

export type ReviewsAdminLabels = {
  loading: string
  loadFailed: string
  retry: string
  cancel: string
  close: string
  /** 서버에서 운영 도구가 꺼져 있다(404) */
  notEnabled: string
  errors: { notFound: string; forbidden: string; validation: string; generic: string }
  queue: {
    title: string
    caption: string
    queueLabel: string
    queues: Record<AdminReviewQueueName, string>
    more: string
    /** 큐별 빈 상태 */
    empty: Record<AdminReviewQueueName, string>
    columns: {
      review: string
      reports: string
      status: string
      when: string
      actions: string
    }
    /** 「5점 만점에 4점」 */
    rating: (value: number) => string
    status: Record<ReviewStatus, string>
    reasons: Record<ReportReason, string>
    /** 「스팸 · 광고 2」 */
    reasonCount: (reason: string, count: number) => string
    reportCount: (count: number) => string
    lastReported: (when: string) => string
    noReports: string
    hiddenReason: (reason: string) => string
    reply: string
    hasReply: string
    hide: string
    dismiss: string
    restore: string
    /** 행 단추의 읽는 이름 — 「숨기기: 리뷰 본문 앞부분」 */
    hideFor: (summary: string) => string
    dismissFor: (summary: string) => string
    restoreFor: (summary: string) => string
    replyFor: (summary: string) => string
    targetLink: (type: string, id: string) => string
  }
  hide: {
    title: string
    reason: string
    reasonHint: string
    submit: string
  }
  replyEditor: {
    title: string
    body: string
    bodyHint: string
    save: string
    remove: string
    removeConfirmTitle: string
    removeConfirmBody: string
    existing: string
    empty: string
  }
}

export { defaultReviewsAdminLabels } from './labels.en'
export { koReviewsAdminLabels } from './labels.ko'
