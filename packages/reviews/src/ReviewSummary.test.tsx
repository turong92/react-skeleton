import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koReviewsLabels } from './labels'
import { targetSummary } from './test/fixtures'
import { ReviewSummary } from './ReviewSummary'

const render = (props: object = {}) =>
  renderToStaticMarkup(
    <ReviewSummary summary={targetSummary()} labels={koReviewsLabels} {...props} />,
  )

describe('ReviewSummary', () => {
  it('shows the average, the stars and the review count', () => {
    const html = render()
    expect(html).toContain('4.3')
    expect(html).toContain('5점 만점에 4.3점')
    expect(html).toContain('리뷰 10개')
  })

  it('draws one pressable bar per star, highest first, each saying what pressing it does', () => {
    const html = render({ onToggleRating: () => undefined })
    const labels = [...html.matchAll(/aria-label="([^"]*이 별점만 보기)"/g)].map((m) => m[1])
    expect(labels[0]).toBe('5점 5개, 이 별점만 보기')
    expect(html).toContain('4점 3개, 이 별점만 보기')
    expect(html).toContain('<button')
  })

  it('marks the bar that is filtering the list as pressed, and says pressing it again shows all', () => {
    const html = render({ onToggleRating: () => undefined, rating: 4 })
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toContain('4점 3개, 이 별점만 보는 중, 누르면 전체 보기')
  })

  it('a bar with no reviews cannot be pressed (an empty list is not a useful filter)', () => {
    const html = render({ onToggleRating: () => undefined })
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*aria-label="1점 0개|<button[^>]*aria-label="1점 0개[^>]*disabled=""/,
    )
  })

  it('without a handler the bars are plain rows, not buttons that do nothing', () => {
    expect(render()).not.toContain('<button')
  })

  it('says there are no reviews yet instead of a 0.0 average', () => {
    const html = render({
      summary: targetSummary({
        count: 0,
        average: null,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      }),
    })
    expect(html).toContain('아직 리뷰가 없어요')
    expect(html).not.toContain('0.0')
  })
})
