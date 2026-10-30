import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koReviewsLabels } from './labels'
import { review } from './test/fixtures'
import { ReviewListView } from './ReviewListView'
import type { ReviewFilters } from './filters'
import type { ReviewListParams } from './types'

const noop = () => undefined
const filtersOf = (params: ReviewListParams): ReviewFilters => ({
  params,
  setSort: noop,
  toggleRating: noop,
  toggleFlag: noop,
  setPage: noop,
  clear: noop,
})
const pagination = {
  page: 0,
  size: 10,
  totalElements: 25,
  totalPages: 3,
  hasNext: true,
  hasPrevious: false,
}

const render = (params: ReviewListParams = { sort: 'recent', page: 0 }, props: object = {}) =>
  renderToStaticMarkup(
    <ReviewListView
      reviews={[review('a'), review('b')]}
      pagination={pagination}
      filters={filtersOf(params)}
      labels={koReviewsLabels}
      {...props}
    />,
  )

describe('ReviewListView', () => {
  it('has a labelled sort select with the four orders and the current one chosen', () => {
    const html = render({ sort: 'helpful', page: 0 })
    expect(html).toContain('<select')
    for (const word of ['최신순', '도움돼요순', '별점 높은순', '별점 낮은순'])
      expect(html).toContain(word)
    expect(html).toMatch(/<option value="helpful" selected=""/)
  })

  it('has filter chips that look pressable and say whether they are on', () => {
    const html = render({ sort: 'recent', verified: true, page: 0 })
    expect(html).toContain('구매 인증')
    expect(html).toContain('사진 리뷰')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(1)
  })

  it('shows the star filter as a chip that can be undone, and a clear button when any filter is on', () => {
    const html = render({ sort: 'recent', rating: 4, page: 0 })
    expect(html).toContain('4점')
    expect(html).toContain('거르기 풀기')
    expect(render()).not.toContain('거르기 풀기')
  })

  it('lists every review and the page links', () => {
    const html = render()
    expect(html).toContain('Body of a')
    expect(html).toContain('Body of b')
    expect(html).toContain('aria-label="리뷰 쪽 이동"')
    expect(html).toContain('aria-current="page"')
  })

  it('says there are no reviews yet, or that nothing matches the filters (and offers to clear them)', () => {
    const empty = { reviews: [], pagination: { ...pagination, totalElements: 0, totalPages: 0 } }
    expect(render({ sort: 'recent', page: 0 }, empty)).toContain('아직 리뷰가 없어요.')
    const filtered = render({ sort: 'recent', photo: true, page: 0 }, empty)
    expect(filtered).toContain('조건에 맞는 리뷰가 없어요.')
    expect(filtered).toContain('거르기 풀기')
  })

  it('dims the list while the next page is loading (the old page stays, no flash)', () => {
    expect(render(undefined, { fetching: true })).toContain('aria-busy="true"')
    expect(render()).not.toContain('aria-busy="true"')
  })
})
