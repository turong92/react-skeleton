import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koReviewsLabels } from './labels'
import { RatingInput } from './RatingInput'
import { RatingStars } from './RatingStars'
import { starFills } from './ratingMath'

describe('starFills', () => {
  it('fills whole stars and a part of the next one, to one decimal like the server average', () => {
    expect(starFills(4.3, 5)).toEqual([1, 1, 1, 1, 0.3])
    expect(starFills(0, 5)).toEqual([0, 0, 0, 0, 0])
    expect(starFills(5, 5)).toEqual([1, 1, 1, 1, 1])
  })

  it('clamps a value outside 0..max instead of drawing a broken row', () => {
    expect(starFills(9, 5)).toEqual([1, 1, 1, 1, 1])
    expect(starFills(-2, 5)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('RatingStars', () => {
  it('is one image whose name says the score out of the max (the stars themselves are hidden from readers)', () => {
    const html = renderToStaticMarkup(<RatingStars value={4.3} labels={koReviewsLabels} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="5점 만점에 4.3점"')
    expect(html).toContain('aria-hidden="true"')
  })

  it('says there is no rating yet instead of 0 stars when there are no reviews', () => {
    const html = renderToStaticMarkup(<RatingStars value={null} labels={koReviewsLabels} />)
    expect(html).toContain('aria-label="아직 평점이 없어요"')
  })

  it('can show the number next to the stars', () => {
    const html = renderToStaticMarkup(
      <RatingStars value={4.3} showValue labels={koReviewsLabels} />,
    )
    expect(html).toContain('>4.3<')
  })
})

describe('RatingInput', () => {
  const render = (value: 1 | 2 | 3 | 4 | 5 | null, extra: object = {}) =>
    renderToStaticMarkup(
      <RatingInput value={value} onChange={() => undefined} labels={koReviewsLabels} {...extra} />,
    )

  it('is one group named 별점 holding five radios that share a name, each named by its score', () => {
    const html = render(null)
    expect(html).toContain('<fieldset')
    expect(html).toContain('<legend')
    expect(html).toContain('별점')
    expect(html.match(/type="radio"/g)).toHaveLength(5)
    for (const n of [1, 2, 3, 4, 5]) expect(html).toContain(`${n}점`)
    const names = new Set([...html.matchAll(/<input[^>]*name="([^"]+)"/g)].map((m) => m[1]))
    expect(names.size).toBe(1)
  })

  it('checks exactly the chosen score and fills the stars up to it', () => {
    const html = render(3)
    expect(html.match(/checked=""/g)).toHaveLength(1)
    expect(html).toMatch(/value="3"[^>]*checked=""|checked=""[^>]*value="3"/)
    expect(html.match(/data-filled="true"/g)).toHaveLength(3)
  })

  it('leaves every radio unchecked when nothing is chosen yet', () => {
    expect(render(null)).not.toContain('checked=""')
  })

  it('locks the radios and marks an invalid group', () => {
    const html = render(null, { disabled: true, invalid: true })
    expect(html.match(/<input[^>]*disabled=""/g)).toHaveLength(5)
    expect(html).toContain('aria-invalid="true"')
  })
})
