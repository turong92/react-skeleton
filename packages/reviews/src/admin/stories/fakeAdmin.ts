import type { ApiCursorResponse } from '@skeleton/api-client'
import { ApiRequestError } from '@skeleton/api-client'
import type { ReviewsAdminApi } from '../adminApi'
import type { AdminReview, AdminReviewQueueName } from '../types'

const fail = (status: number, code: string) =>
  new ApiRequestError({ code, title: code, status } as never, 'trace', 'span', 'parent')

/** 스토리 · 시험용 메모리 안의 가짜 운영 API — 큐 걸러 보기 · 숨김 · 되살림 · 문제없음 · 답글만 흉내 낸다 */
function seed(): AdminReview[] {
  const base = {
    targetType: 'product',
    targetId: 'basic',
    moderationReason: null,
    accountLabel: null,
    reply: null,
    status: 'PUBLISHED' as const,
  }
  return [
    {
      ...base,
      id: 'a1',
      rating: 1,
      body: '광고 링크가 들어 있는 리뷰입니다 http://example.invalid',
      reportCount: 3,
      reportReasons: { SPAM: 2, ABUSE: 1 },
      lastReportedAt: '2026-10-29T03:00:00Z',
      createdAt: '2026-10-28T03:00:00Z',
    },
    {
      ...base,
      id: 'a2',
      rating: 4,
      body: '배송이 빠르고 포장이 꼼꼼했어요. 또 살게요.',
      reportCount: 1,
      reportReasons: { OFF_TOPIC: 1 },
      lastReportedAt: '2026-10-29T02:00:00Z',
      createdAt: '2026-10-27T03:00:00Z',
    },
    {
      ...base,
      id: 'a3',
      rating: 2,
      body: '이미 가려진 리뷰의 본문이에요.',
      status: 'HIDDEN' as const,
      moderationReason: '욕설',
      reportCount: 0,
      reportReasons: {},
      lastReportedAt: null,
      createdAt: '2026-10-26T03:00:00Z',
    },
    {
      ...base,
      id: 'a4',
      rating: 5,
      body: '신고는 없지만 답글을 달 수 있는 리뷰예요.',
      reportCount: 0,
      reportReasons: {},
      lastReportedAt: null,
      createdAt: '2026-10-25T03:00:00Z',
    },
  ]
}

export type FakeAdminOptions = {
  /** 모든 호출이 이 상태로 실패한다 (404 = 서버에서 도구가 꺼짐) */
  failWith?: number
  /** 숨기기가 이 상태로 실패한다 */
  moderateFailsWith?: number
}

export function createFakeAdmin({ failWith, moderateFailsWith }: FakeAdminOptions = {}) {
  let rows = seed()
  const log: string[] = []
  const inQueue = (row: AdminReview, queue: AdminReviewQueueName) =>
    queue === 'all' ||
    (queue === 'hidden'
      ? row.status === 'HIDDEN'
      : row.status === 'PUBLISHED' && row.reportCount > 0)
  const change = (id: string, patch: Partial<AdminReview>) => {
    rows = rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
  }
  const api: ReviewsAdminApi = {
    listReviews: async ({ queue }) => {
      if (failWith) throw fail(failWith, 'REVIEW.X')
      const values = rows.filter((row) => inQueue(row, queue))
      return {
        values,
        cursor: { hasNext: false, nextCursor: null },
      } as unknown as ApiCursorResponse<AdminReview>
    },
    moderate: async (id, input) => {
      if (moderateFailsWith) throw fail(moderateFailsWith, 'REVIEW.NOT_FOUND')
      log.push(`moderate ${id} ${input.status} ${input.reason ?? ''}`.trim())
      change(
        id,
        input.status === 'HIDDEN'
          ? { status: 'HIDDEN', moderationReason: input.reason, reportCount: 0, reportReasons: {} }
          : { status: 'PUBLISHED', moderationReason: null },
      )
    },
    dismissReports: async (id) => {
      log.push(`dismiss ${id}`)
      change(id, { reportCount: 0, reportReasons: {}, lastReportedAt: null })
    },
    setReply: async (id, body) => {
      log.push(`reply ${id} ${body}`)
      const now = '2026-10-30T00:00:00Z'
      change(id, { reply: { body, createdAt: now, updatedAt: now } })
    },
    removeReply: async (id) => {
      log.push(`unreply ${id}`)
      change(id, { reply: null })
    },
  }
  return { api, log }
}
