import type { ApiPageResponse } from '@skeleton/api-client'
import { describe, expect, it } from 'vitest'
import { patchHelpful } from './helpfulCache'
import { review } from './test/fixtures'
import type { Review } from './types'

const page = (...values: Review[]): ApiPageResponse<Review> =>
  ({ values, pagination: { page: 0 }, meta: {} }) as unknown as ApiPageResponse<Review>

describe('patchHelpful', () => {
  it("writes the server's count into the one review and leaves the others untouched", () => {
    const a = review('a')
    const before = page(a, review('b', { helpfulCount: 2 }))
    const after = patchHelpful(before, 'b', { helpfulCount: 3, helpful: true })!
    expect(after.values[0]).toBe(a)
    expect(after.values[1]).toMatchObject({ id: 'b', helpfulCount: 3, helpful: true })
    expect(after.pagination).toBe(before.pagination)
  })

  it('returns the very same object when the review is not on this page (no needless re-render)', () => {
    const before = page(review('a'))
    expect(patchHelpful(before, 'zzz', { helpfulCount: 1, helpful: true })).toBe(before)
  })

  it('passes an empty cache through', () => {
    expect(patchHelpful(undefined, 'a', { helpfulCount: 1, helpful: true })).toBeUndefined()
  })
})
