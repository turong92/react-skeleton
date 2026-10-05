import { describe, expect, it } from 'vitest'
import { paginationItems } from './paginationItems'

/* page 는 백엔드 PaginationMeta.page 처럼 0 부터 */
describe('paginationItems', () => {
  it('nothing to page through → no items; one page → just that page', () => {
    expect(paginationItems(0, 0)).toEqual([])
    expect(paginationItems(0, 1)).toEqual([0])
  })

  it('a few pages are all shown', () => {
    expect(paginationItems(2, 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('always keeps the first and last page and the current one with its siblings', () => {
    expect(paginationItems(0, 10)).toEqual([0, 1, 'gap', 9])
    expect(paginationItems(5, 10)).toEqual([0, 'gap', 4, 5, 6, 'gap', 9])
    expect(paginationItems(9, 10)).toEqual([0, 'gap', 8, 9])
  })

  it('a gap of exactly one page shows that page instead of an ellipsis', () => {
    expect(paginationItems(3, 10)).toEqual([0, 1, 2, 3, 4, 'gap', 9])
    expect(paginationItems(6, 10)).toEqual([0, 'gap', 5, 6, 7, 8, 9])
  })

  it('siblings is configurable and a page past the end is clamped', () => {
    expect(paginationItems(5, 12, 2)).toEqual([0, 'gap', 3, 4, 5, 6, 7, 'gap', 11])
    expect(paginationItems(99, 5)).toEqual([0, 'gap', 3, 4])
  })
})
