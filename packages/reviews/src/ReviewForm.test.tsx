import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koReviewsLabels } from './labels'
import { ReviewForm } from './ReviewForm'
import { validateReview } from './validateReview'

const config = { bodyMinLength: 10, bodyMaxLength: 100, maxPhotos: 3 }

describe('validateReview', () => {
  const L = koReviewsLabels.form
  it('needs a rating', () => {
    expect(validateReview({ rating: null, body: 'x'.repeat(10) }, config, L).rating).toBe(
      L.ratingRequired,
    )
  })

  it('counts the trimmed body against the min and the max like the server (which only strips control characters)', () => {
    expect(validateReview({ rating: 5, body: `   ${'x'.repeat(9)}  ` }, config, L).body).toBe(
      L.bodyTooShort(10),
    )
    expect(validateReview({ rating: 5, body: 'x'.repeat(101) }, config, L).body).toBe(
      L.bodyTooLong(100),
    )
    expect(validateReview({ rating: 5, body: 'x'.repeat(10) }, config, L)).toEqual({})
    expect(validateReview({ rating: 5, body: 'x'.repeat(100) }, config, L)).toEqual({})
  })
})

describe('ReviewForm', () => {
  const render = (props: object = {}) =>
    renderToStaticMarkup(
      <ReviewForm config={config} labels={koReviewsLabels} onSubmit={() => undefined} {...props} />,
    )

  it('has the rating group, a labelled body field with the length hint, and a primary submit button', () => {
    const html = render()
    expect(html).toContain('<fieldset')
    expect(html).toContain('리뷰 내용')
    expect(html).toContain('10자 이상 100자 이하')
    expect(html).toContain('리뷰 등록')
  })

  it('editing starts from the saved values and the button says save', () => {
    const html = render({ initial: { rating: 4, body: '맛있어요 정말로요', photos: [] } })
    expect(html).toContain('맛있어요 정말로요')
    expect(html).toContain('수정 저장')
    expect(html).not.toContain('리뷰 등록')
  })

  it('leaves a place for photos only when the app gives renderPhotos and the server allows photos', () => {
    const slot = (p: { max: number }) => <div data-slot={p.max}>slot</div>
    expect(render({ renderPhotos: slot })).toContain('data-slot="3"')
    expect(render()).not.toContain('data-slot')
    expect(render({ renderPhotos: slot, config: { ...config, maxPhotos: 0 } })).not.toContain(
      'data-slot',
    )
  })

  it('shows a cancel button only when the app can close the form', () => {
    expect(render()).not.toContain('취소')
    expect(render({ onCancel: () => undefined })).toContain('취소')
  })
})
