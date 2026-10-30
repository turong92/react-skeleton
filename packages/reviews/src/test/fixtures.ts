import type { Review, TargetSummary } from '../types'

/*
 * 테스트 · 스토리가 함께 쓰는 만들기 도우미(공개 표면 아님 — index.ts 가 내보내지 않는다).
 */
export const at = '2026-10-01T03:00:00Z'

export const review = (id: string, over: Partial<Review> = {}): Review => ({
  id,
  rating: 5,
  body: `Body of ${id}`,
  verified: false,
  helpfulCount: 0,
  helpful: false,
  mine: false,
  authorName: 'Ada',
  authorTag: '0001',
  authorDeleted: false,
  edited: false,
  photos: [],
  reply: null,
  createdAt: at,
  updatedAt: at,
  ...over,
})

export const targetSummary = (over: Partial<TargetSummary> = {}): TargetSummary => ({
  count: 10,
  average: 4.3,
  distribution: { 1: 0, 2: 1, 3: 1, 4: 3, 5: 5 },
  myReviewId: null,
  canWrite: true,
  writeBlockedReason: null,
  ...over,
})
