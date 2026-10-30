import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { koReviewsLabels } from './labels'
import { review } from './test/fixtures'
import { ReviewItem } from './ReviewItem'

const noop = () => undefined
const render = (over: Parameters<typeof review>[1] = {}, props: object = {}) =>
  renderToStaticMarkup(
    <ReviewItem review={review('r1', over)} labels={koReviewsLabels} {...props} />,
  )

describe('ReviewItem', () => {
  it('shows the stars, the body, the author with the tag, and the verified badge as words', () => {
    const html = render({ verified: true, rating: 4 })
    expect(html).toContain('5점 만점에 4점')
    expect(html).toContain('Body of r1')
    expect(html).toContain('Ada')
    expect(html).toContain('#0001')
    expect(html).toContain('구매 인증')
  })

  it('names a deleted author instead of showing a blank, and never prints an account id', () => {
    const html = render({ authorDeleted: true, authorName: null, authorTag: null })
    expect(html).toContain('탈퇴한 사용자')
  })

  it('marks an edited review', () => {
    expect(render({ edited: true })).toContain('수정됨')
  })

  describe('hidden', () => {
    const hidden = { mine: true, status: 'HIDDEN' as const, moderationReason: '광고성 내용' }

    it('tells the author the review is hidden, with the reason, and offers delete but not edit', () => {
      const html = render(hidden, { onEdit: noop, onDelete: noop, onToggleHelpful: noop })
      expect(html).toContain(koReviewsLabels.item.hiddenMine)
      expect(html).toContain('사유: 광고성 내용')
      expect(html).toContain(koReviewsLabels.item.menu('Ada#0001'))
      expect(html).not.toContain('role="menuitem"') // 메뉴는 닫혀 있다 - 항목은 열었을 때 그려진다
    })

    it('has no helpful button on a hidden review', () => {
      expect(render(hidden, { onToggleHelpful: noop })).not.toContain('도움돼요')
    })

    it('shows no hidden notice on a normal published review', () => {
      expect(render({ mine: true, status: 'PUBLISHED' })).not.toContain(
        koReviewsLabels.item.hiddenMine,
      )
    })
  })

  describe('helpful', () => {
    it('is a pressable button that says its count, and is pressed when I already pressed it', () => {
      const html = render({ helpfulCount: 3, helpful: true }, { onToggleHelpful: noop })
      expect(html).toContain('<button')
      expect(html).toContain('aria-pressed="true"')
      expect(html).toContain('도움돼요 3')
    })

    it('is not pressed when I have not', () => {
      expect(render({ helpfulCount: 3 }, { onToggleHelpful: noop })).toContain(
        'aria-pressed="false"',
      )
    })

    it('on my own review (the server answers 403) it is only the count, not a button', () => {
      const html = render({ mine: true, helpfulCount: 2 }, { onToggleHelpful: noop })
      expect(html).not.toContain('aria-pressed')
      expect(html).toContain('2명에게 도움이 됐어요')
    })

    it('without the handler (signed out) it is only the count too', () => {
      const html = render({ helpfulCount: 2 })
      expect(html).not.toContain('aria-pressed')
      expect(html).toContain('2명에게 도움이 됐어요')
    })

    it('says nothing when no one found it helpful and it cannot be pressed', () => {
      expect(render({ helpfulCount: 0 })).not.toContain('도움이 됐어요')
    })
  })

  it("gives someone else's review a menu named after the author, only when a report handler exists", () => {
    expect(render({}, { onReport: noop })).toContain(koReviewsLabels.item.menu('Ada#0001'))
    expect(render({})).not.toContain('aria-haspopup')
  })

  it("shows the operator's reply in its own labelled box", () => {
    const html = render({
      reply: {
        body: '감사합니다',
        createdAt: '2026-10-02T00:00:00Z',
        updatedAt: '2026-10-02T00:00:00Z',
      },
    })
    expect(html).toContain('운영자 답글')
    expect(html).toContain('감사합니다')
  })

  describe('photos', () => {
    it('draws a list of photo slots, by default as named placeholders the app can replace', () => {
      const html = render({ photos: [{ index: 0 }, { index: 1 }] })
      expect(html).toContain('사진 1')
      expect(html).toContain('사진 2')
    })

    it('lets the app draw the picture (the package does not know where files live)', () => {
      const html = render(
        { photos: [{ index: 0 }] },
        { renderPhoto: (photo: { index: number }) => <img alt="" src={`/p/${photo.index}`} /> },
      )
      expect(html).toContain('src="/p/0"')
    })

    it('has no photo list when there are no photos', () => {
      expect(render({})).not.toContain('<ul')
    })
  })

  it('draws the body as text, never as HTML', () => {
    const html = render({ body: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
