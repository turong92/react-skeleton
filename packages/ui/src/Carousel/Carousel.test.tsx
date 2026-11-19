import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Carousel } from './Carousel'

const render = (count: number, props: Partial<Parameters<typeof Carousel>[0]> = {}) =>
  renderToStaticMarkup(
    <Carousel label="Plans" {...props}>
      {Array.from({ length: count }, (_, i) => (
        <p key={i}>slide {i + 1}</p>
      ))}
    </Carousel>,
  )

describe('Carousel (WAI-ARIA APG carousel)', () => {
  it('is a labelled carousel region whose slides are named "n / total"', () => {
    const html = render(3)
    expect(html).toContain('aria-roledescription="carousel"')
    expect(html).toContain('aria-label="Plans"')
    for (const n of [1, 2, 3]) {
      expect(html).toContain(`role="group" aria-roledescription="slide" aria-label="${n} / 3"`)
    }
  })

  it('starts on the first slide: previous is aria-disabled, next is not, position reads 1 / 3', () => {
    const html = render(3)
    expect(html).toMatch(/aria-label="Previous slide" aria-disabled="true"/)
    expect(html).not.toMatch(/aria-label="Next slide" aria-disabled/)
    expect(html).toContain('>1 / 3</span>')
    expect(html).not.toContain('disabled=""') // 막는 것은 네이티브 disabled 가 아니라 aria-disabled
  })

  it('announces the changing position politely (no auto-rotation)', () => {
    expect(render(3)).toMatch(
      /<span class="[^"]*" aria-live="polite" aria-atomic="true">1 \/ 3<\/span>/,
    )
  })

  it('labels are props', () => {
    const html = render(2, {
      previousLabel: '이전',
      nextLabel: '다음',
      slideLabel: (n, total) => `${total}장 중 ${n}`,
    })
    expect(html).toContain('aria-label="이전"')
    expect(html).toContain('aria-label="다음"')
    expect(html).toContain('aria-label="2장 중 1"')
  })

  it('the scroll track is keyboard focusable, and a single slide has no controls', () => {
    expect(render(2)).toMatch(/<div class="[^"]*" tabindex="0">/)
    expect(render(1)).not.toContain('<button')
  })

  it('renders nothing without slides', () => {
    expect(render(0)).toBe('')
  })
})
