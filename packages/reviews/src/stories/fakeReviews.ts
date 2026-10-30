import { ApiRequestError, type ApiPageResponse } from '@skeleton/api-client'
import type { ReviewsApi } from '../reviewsApi'
import { review } from '../test/fixtures'
import type {
  HelpfulState,
  Rating,
  Review,
  ReviewConfig,
  ReviewListParams,
  ReviewTarget,
  TargetSummary,
  WriteBlockedReason,
} from '../types'

/** 스토리 · 시험용 메모리 안의 가짜 리뷰 API — 서버가 하는 일(걸러 세기 · 정렬 · 쪽 나누기 · 평균 · 내 리뷰 하나 · 숨김 표시)만 흉내 낸다 */

export const fail = (status: number, code: string) =>
  new ApiRequestError({ code, title: code, status } as never, 'trace', 'span', 'parent')

export const fakeConfig: ReviewConfig = {
  targetTypes: ['product'],
  bodyMinLength: 10,
  bodyMaxLength: 2000,
  maxPhotos: 3,
  reportReasons: ['SPAM', 'ABUSE', 'PRIVACY', 'OFF_TOPIC', 'OTHER'],
  canModerate: false,
  canReply: false,
}

const names = ['Ada', 'Bea', 'Cy', 'Dee', 'Eli', 'Fay', 'Gus', 'Hana']
const bodies = [
  '배송이 빠르고 포장이 꼼꼼했어요. 다시 살 것 같아요.',
  '사진과 같아요. 기대한 만큼 만족합니다.',
  '가격 대비 괜찮은 편이에요. 조금 아쉬운 점도 있어요.',
  '쓰던 것보다 훨씬 좋네요. 추천합니다!',
  '보통이에요. 특별히 좋지도 나쁘지도 않아요.',
  '설명서가 부족해서 처음엔 헤맸지만 쓰다 보니 익숙해졌어요.',
]

/** 서른 개 남짓 - 별점 분포가 고르지 않게 */
function seed(): Review[] {
  return Array.from({ length: 24 }, (_, i) => {
    const rating = ([5, 5, 4, 5, 3, 4, 2, 5, 4, 1] as Rating[])[i % 10]
    return review(`r${i + 1}`, {
      rating,
      body: bodies[i % bodies.length],
      authorName: names[i % names.length],
      authorTag: String(1000 + i),
      verified: i % 3 !== 0,
      helpfulCount: (i * 7) % 11,
      photos: i % 5 === 0 ? [{ index: 0 }, { index: 1 }] : [],
      createdAt: new Date(Date.UTC(2026, 9, 28, 12) - i * 36e5 * 7).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 9, 28, 12) - i * 36e5 * 7).toISOString(),
      ...(i === 1
        ? {
            reply: {
              body: '소중한 후기 감사합니다. 더 좋은 제품으로 보답할게요.',
              createdAt: '2026-10-29T01:00:00Z',
              updatedAt: '2026-10-29T01:00:00Z',
            },
          }
        : {}),
    })
  })
}

export type FakeReviewsOptions = {
  /** 리뷰가 하나도 없는 대상 */
  empty?: boolean
  /** 이 사람이 쓸 수 없는 까닭 - 요약이 이 코드를 준다 */
  blocked?: WriteBlockedReason
  /** 내 리뷰가 이미 하나 있다(ALREADY_WRITTEN 에 맞춰 요약이 `myReviewId` 를 준다) */
  mine?: boolean
  /** 내 리뷰가 운영자에게 숨겨진 상태 */
  hiddenMine?: boolean
  /** 한 쪽의 개수 기본 5 */
  size?: number
}

/** 대상 종류 · id 는 무시한다 - 가짜는 대상 하나뿐 */
export function createFakeReviews({
  empty = false,
  blocked,
  mine = false,
  hiddenMine = false,
  size = 5,
}: FakeReviewsOptions = {}) {
  let reviews: Review[] = empty ? [] : seed()
  const reported: string[] = []
  const written: Array<{ rating: Rating; body: string; photos?: string[] }> = []
  if ((mine || hiddenMine) && !empty)
    reviews = [
      review('mine', {
        mine: true,
        rating: 4,
        body: '제가 쓴 리뷰예요. 오래 써 봤는데 만족합니다.',
        authorName: 'Me',
        authorTag: '0000',
        verified: true,
        createdAt: '2026-10-29T00:00:00Z',
        updatedAt: '2026-10-29T00:00:00Z',
        status: hiddenMine ? 'HIDDEN' : 'PUBLISHED',
        moderationReason: hiddenMine ? '광고성 내용이 포함되어 있어요' : null,
      }),
      ...reviews,
    ]
  const visible = () => reviews.filter((r) => r.status !== 'DELETED')

  const summary = (): TargetSummary => {
    const counted = visible().filter((r) => r.status !== 'HIDDEN')
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<Rating, number>
    for (const r of counted) distribution[r.rating] += 1
    const sum = counted.reduce((total, r) => total + r.rating, 0)
    const myReviewId = reviews.find((r) => r.mine && r.status !== 'DELETED')?.id ?? null
    const reason: WriteBlockedReason | null =
      blocked ?? (hiddenMine ? 'LOCKED' : myReviewId ? 'ALREADY_WRITTEN' : null)
    return {
      count: counted.length,
      average: counted.length === 0 ? null : Math.round((sum / counted.length) * 10) / 10,
      distribution,
      myReviewId,
      canWrite: reason === null,
      writeBlockedReason: reason,
    }
  }

  const page = (params: ReviewListParams): ApiPageResponse<Review> => {
    let rows = visible().filter((r) => r.status !== 'HIDDEN' || r.mine)
    if (params.rating) rows = rows.filter((r) => r.rating === params.rating)
    if (params.verified) rows = rows.filter((r) => r.verified)
    if (params.photo) rows = rows.filter((r) => r.photos.length > 0)
    const by: Record<string, (a: Review, b: Review) => number> = {
      recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
      helpful: (a, b) => b.helpfulCount - a.helpfulCount,
      rating_high: (a, b) => b.rating - a.rating,
      rating_low: (a, b) => a.rating - b.rating,
    }
    rows = [...rows].sort(by[params.sort ?? 'recent'])
    const current = params.page ?? 0
    const pageSize = params.size ?? size
    const totalPages = Math.ceil(rows.length / pageSize)
    return {
      values: rows.slice(current * pageSize, (current + 1) * pageSize),
      pagination: {
        page: current,
        size: pageSize,
        totalElements: rows.length,
        totalPages,
        hasNext: current + 1 < totalPages,
        hasPrevious: current > 0,
      },
      meta: { timestamp: 't' } as never,
    }
  }

  const api: ReviewsApi = {
    getConfig: async () => fakeConfig,
    getSummary: async () => summary(),
    listSummaries: async (targets: ReviewTarget[]) =>
      targets.map((t) => ({
        targetType: t.type,
        targetId: t.id,
        count: summary().count,
        average: summary().average,
      })),
    listReviews: async (_target, params = {}) => page(params),
    createReview: async (_target, input) => {
      if (summary().myReviewId) throw fail(409, 'REVIEW.ALREADY_WRITTEN')
      written.push(input)
      const created = review(`new${written.length}`, {
        ...input,
        photos: (input.photos ?? []).map((_, index) => ({ index })),
        mine: true,
        authorName: 'Me',
        authorTag: '0000',
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      reviews = [created, ...reviews]
      return created
    },
    updateReview: async (id, patch) => {
      const found = reviews.find((r) => r.id === id)
      if (!found) throw fail(404, 'REVIEW.NOT_FOUND')
      if (found.status === 'HIDDEN') throw fail(403, 'REVIEW.FORBIDDEN')
      const { photos: keys, ...rest } = patch
      const next: Review = {
        ...found,
        ...rest,
        ...(keys ? { photos: keys.map((_, index) => ({ index })) } : {}),
        edited: true,
      }
      reviews = reviews.map((r) => (r.id === id ? next : r))
      return next
    },
    removeReview: async (id) => {
      reviews = reviews.map((r) => (r.id === id ? { ...r, status: 'DELETED' as const } : r))
    },
    setHelpful: async (id, helpful): Promise<HelpfulState> => {
      const found = reviews.find((r) => r.id === id)
      if (!found) throw fail(404, 'REVIEW.NOT_FOUND')
      if (found.mine) throw fail(403, 'REVIEW.OWN_REVIEW')
      const state = {
        helpful,
        helpfulCount: found.helpfulCount + (helpful === found.helpful ? 0 : helpful ? 1 : -1),
      }
      reviews = reviews.map((r) => (r.id === id ? { ...r, ...state } : r))
      return state
    },
    reportReview: async (id) => {
      reported.push(id)
    },
    myReviews: async () =>
      ({
        values: [],
        cursor: { hasNext: false, nextCursor: null },
        meta: { timestamp: 't' },
      }) as never,
    photoPath: (id, index) => `/reviews/${id}/photos/${index}`,
  }
  return { api, reported, written }
}
